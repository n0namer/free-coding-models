import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { sources } from '../sources.js'
import { normalizeRouterConfig, DEFAULT_ROUTER_SETTINGS } from '../src/core/config.js'
import { createRouterRuntimeForTest } from '../src/core/router-daemon.js'

const MODELS = {
  primary: 'openai/gpt-oss-120b',
  fallback: 'deepseek-ai/deepseek-v4-flash-0731',
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve(server.address().port)
    })
  })
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function withSourceUrls(overrides, fn) {
  const originals = new Map()
  for (const [provider, url] of Object.entries(overrides)) {
    originals.set(provider, sources[provider]?.url)
    sources[provider].url = url
  }
  try {
    return await fn()
  } finally {
    for (const [provider, url] of originals) sources[provider].url = url
  }
}

async function withMockProvider(responder, fn) {
  const requests = []
  const server = createHttpServer(async (req, res) => {
    const bodyText = await readBody(req)
    const request = { body: bodyText ? JSON.parse(bodyText) : null }
    requests.push(request)
    const response = await responder(request, res)
    if (!response || res.writableEnded || res.destroyed) return
    res.writeHead(response.status ?? 200, response.headers || { 'content-type': 'application/json' })
    if (Array.isArray(response.chunks)) {
      for (const chunk of response.chunks) res.write(chunk)
      res.end()
      return
    }
    res.end(JSON.stringify(response.body ?? { id: 'chatcmpl-test', choices: [] }))
  })
  const port = await listen(server)
  try {
    return await fn({ requests, url: `http://127.0.0.1${port}/v1/chat/completions` })
  } finally {
    await close(server)
  }
}

function config() {
  return {
    telemetry: { enabled: false },
    apiKeys: { groq: 'gsk-test', nvidia: 'nvapi-test' },
    router: normalizeRouterConfig({
      ...DEFAULT_ROUTER_SETTINGS,
      enabled: true,
      onboardingSeen: true,
      activeSet: 'schema-test',
      sets: {
        'schema-test': {
          name: 'schema-test',
          created: '2026-09-04T00:00:00.000Z',
          models: [
            { provider: 'groq', model: MODELS.primary, priority: 1 },
            { provider: 'nvidia', model: MODELS.fallback, priority: 2 },
          ],
        },
      },
      failover: {
        ...DEFAULT_ROUTER_SETTINGS.failover,
        maxRetries: 2,
        requestTimeoutMs: 500,
        streamStallTimeoutMs: 100,
      },
      circuitBreaker: {
        ...DEFAULT_ROUTER_SETTINGS.circuitBreaker,
        failureThreshold: 1,
      },
    }),
  }
}

async function withRouter(fn) {
  const tokenPath = join(tmpdir(), `fcm-json-schema-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
  const runtime = createRouterRuntimeForTest({config: config(), tokenPath, logger: { level: 'error', error() {}, warn() {}, info() {}, debug() {} } })
  const server = createHttpServer((req, res) => void runtime.handleHttp(req, res))
  const port = await listen(server)
  runtime.port = port
  runtime.server = server
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    try { runtime.tokenTracker.flush({ force: true }) } catch {}
    await close(server)
    rmSync(tokenPath, { force: true })
  }
}

function responseFormat() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'result',
      schema: {
        type: 'object',
        required: ['answer'],
        additionalProperties: false,
        properties: { answer: { type: 'string' } },
      },
    },
  }
}

function post(baseUrl, overrides = {}) {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'fcm',
      messages: [{ role: 'user', content: 'return JSON' }],
      ...overrides,
  }),
  })
}

describe('router json_schema contract validation', () => {
  it('fails over before client commit when non-streaming structured output violates the requested schema', async () => {
    await withMockProvider(() => ({
      body: { id: 'bad', choices: [{ message: { role: 'assistant', content: '{"foo":123}' } }] },
    }), async (primary) => {
      await withMockProvider(() => ({
        body: { id: 'good', choices: [{ message: { role: 'assistant', content: '{"answer":"ok"}' } }] },
      }), async (fallback) => {
        await withSourceUrls({ groq: primary.url, nvidia: fallback.url }, async () => {
          await withRouter(async (baseUrl) => {
            const response = await post(baseUrl, { response_format: responseFormat() })
            const payload = await response.json()
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('x-fcm-router-model'), `nvidia/${MODELS.fallback}`)
            assert.equal(payload.id, 'good')
            assert.equal(primary.requests.length, 1)
            assert.equal(fallback.requests.length, 1)
          })
        })
      })
    })
  })

  it('keeps streaming json_schema failover atomic and never leaks the rejected attempt', async () => {
    const sse = (content) => ({
      headers: { 'content-type': 'text/event-stream' },
      chunks: [
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
        'data: [DONE]\n\n',
      ],
    })
    await withMockProvider(() => sse('{"foo":123}'), async (primary) => {
      await withMockProvider(() => sse('{"answer":"ok"}'), async (fallback) => {
        await withSourceUrls({ groq: primary.url, nvidia: fallback.url }, async () => {
          await withRouter(async (baseUrl) => {
            const response = await post(baseUrl, { stream: true, response_format: responseFormat() })
            const text = await response.text()
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('x-fcm-router-model'), `nvidia/${MODELS.fallback}`)
            assert.match(text, /answer/)
            assert.doesNotMatch(text, /foo/)
            assert.equal(primary.requests.length, 1)
            assert.equal(fallback.requests.length, 1)
          })
        })
      })
    })
  })

  it('fails closed when every routed model violates the requested schema and never leaks rejected payloads', async () => {
    await withMockProvider(() => ({
      body: { id: 'bad-primary', choices: [{ message: { role: 'assistant', content: '{"foo":123}' } }] },
    }), async (primary) => {
      await withMockProvider(() => ({
        body: { id: 'bad-fallback', choices: [{ message: { role: 'assistant', content: '{"answer":456}' } }] },
      }), async (fallback) => {
        await withSourceUrls({ groq: primary.url, nvidia: fallback.url }, async () => {
          await withRouter(async (baseUrl) => {
            const response = await post(baseUrl, { response_format: responseFormat() })
            const text = await response.text()
            const payload = JSON.parse(text)
            assert.equal(response.status, 503)
            assert.equal(payload.error?.code, 'all_models_failed')
            assert.equal(primary.requests.length, 1)
            assert.equal(fallback.requests.length, 1)
            assert.doesNotMatch(text, /bad-primary|bad-fallback|\"foo\"|456/)
          })
        })
      })
    })
  })

  it('fails over when an upstream returns syntactically invalid JSON before client commit', async () => {
    await withMockProvider(() => ({
      headers: { 'content-type': 'application/json' },
      chunks: ['{not-json'],
    }), async (primary) => {
      await withMockProvider(() => ({
        body: { id: 'good-after-invalid-json', choices: [{ message: { role: 'assistant', content: '{"answer":"ok"}' } }] },
      }), async (fallback) => {
        await withSourceUrls({ groq: primary.url, nvidia: fallback.url }, async () => {
          await withRouter(async (baseUrl) => {
            const response = await post(baseUrl, { response_format: responseFormat() })
            const payload = await response.json()
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('x-fcm-router-model'), `nvidia/${MODELS.fallback}`)
            assert.equal(payload.id, 'good-after-invalid-json')
            assert.equal(primary.requests.length, 1)
            assert.equal(fallback.requests.length, 1)
          })
        })
      })
    })
  })

  it('rejects a malformed json_schema request before contacting an upstream', async () => {
    await withMockProvider(() => ({
      body: { id: 'should-not-run', choices: [] },
    }), async (primary) => {
      await withSourceUrls({ groq: primary.url }, async () => {
        await withRouter(async (baseUrl) => {
          const response = await post(baseUrl, {
            response_format: { type: 'json_schema', json_schema: { name: 'result' } },
          })
          const payload = await response.json()
          assert.equal(response.status, 400)
          assert.equal(payload.error?.code, 'invalid_json_schema')
          assert.equal(primary.requests.length, 0)
        })
      })
    })
  })
})
