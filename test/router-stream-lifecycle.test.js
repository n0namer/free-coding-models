import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rmSync } from 'node:fs'

import { sources } from '../sources.js'
import { DEFAULT_ROUTER_SETTINGS, normalizeRouterConfig } from '../src/core/config.js'
import { createRouterRuntimeForTest } from '../src/core/router-daemon.js'

const GROQ_MODEL = 'openai/gpt-oss-120b'
const NVIDIA_MODEL = 'deepseek-ai/deepseek-v4-flash-0731'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve(server.address().port)
    })
  })
}

async function close(server) {
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(() => resolve()))
}

async function withProvider(responder, fn) {
  const requests = []
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requests.push({ body: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
    await responder(req, res)
  })
  const port = await listen(server)
  try {
    return await fn({ requests, url: `http://127.0.0.1:${port}/v1/chat/completions` })
  } finally {
    await close(server)
  }
}

async function withSourceUrls(overrides, fn) {
  const originals = new Map()
  for (const [provider, url] of Object.entries(overrides)) {
    originals.set(provider, sources[provider].url)
    sources[provider].url = url
  }
  try {
    return await fn()
  } finally {
    for (const [provider, url] of originals) sources[provider].url = url
  }
}

function config(streamStallTimeoutMs = 60) {
  return {
    telemetry: { enabled: false },
    apiKeys: { groq: 'test-groq', nvidia: 'test-nvidia' },
    router: normalizeRouterConfig({
      ...DEFAULT_ROUTER_SETTINGS,
      enabled: true,
      onboardingSeen: true,
      activeSet: 'stream-test',
      sets: {
        'stream-test': {
          name: 'stream-test',
          created: '2026-09-02T00:00:00.000Z',
          models: [
            { provider: 'groq', model: GROQ_MODEL, priority: 1 },
            { provider: 'nvidia', model: NVIDIA_MODEL, priority: 2 },
          ],
        },
      },
      failover: {
        ...DEFAULT_ROUTER_SETTINGS.failover,
        maxRetries: 1,
        requestTimeoutMs: 1000,
        streamStallTimeoutMs,
      },
      circuitBreaker: {
        ...DEFAULT_ROUTER_SETTINGS.circuitBreaker,
        failureThreshold: 1,
      },
    }),
  }
}

async function withRouter(routerConfig, fn) {
  const tokenPath = join(tmpdir(), `fcm-stream-lifecycle-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
  const runtime = createRouterRuntimeForTest({ config: routerConfig, tokenPath })
  const server = createServer((req, res) => void runtime.handleHttp(req, res))
  const port = await listen(server)
  runtime.port = port
  runtime.server = server
  try {
    return await fn({ runtime, baseUrl: `http://127.0.0.1:${port}` })
  } finally {
    try { runtime.tokenTracker.flush({ force: true }) } catch {}
    await close(server)
    rmSync(tokenPath, { force: true })
  }
}

function post(baseUrl, extra = {}) {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'fcm',
      stream: true,
      messages: [{ role: 'user', content: 'continue a long answer' }],
      ...extra,
    }),
  })
}

describe('router long-stream lifecycle', () => {
  it('records a partial-stream idle timeout and does not splice a second model', async () => {
    await withProvider(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n')
      setTimeout(() => res.destroy(), 250).unref?.()
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: {"choices":[{"delta":{"content":"fallback"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(40), async ({ runtime, baseUrl }) => {
            const response = await post(baseUrl)
            const text = await response.text()
            assert.equal(response.status, 200)
            assert.match(text, /partial/)
            assert.doesNotMatch(text, /fallback/)
            assert.equal(groq.requests.length, 1)
            assert.equal(nvidia.requests.length, 0)
            const entry = runtime.requestLog.find((item) => item.error === 'stream_stall_timeout')
            assert.ok(entry)
            assert.equal(entry.stream_outcome, 'idle_timeout')
            assert.equal(typeof entry.duration_ms, 'number')
          })
        })
      })
    })
  })

  it('marks clean EOF without a terminal SSE signal as truncated', async () => {
    await withProvider(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.end('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n')
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(), async ({ runtime, baseUrl }) => {
            const response = await post(baseUrl)
            await response.text()
            assert.equal(nvidia.requests.length, 0)
            const entry = runtime.requestLog.find((item) => item.error === 'upstream_stream_ended_without_terminal')
            assert.ok(entry)
            assert.equal(entry.stream_outcome, 'truncated')
            assert.equal(typeof entry.duration_ms, 'number')
          })
        })
      })
    })
  })

  it('preserves transparent failover when the first model fails before the first byte', async () => {
    await withProvider(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.flushHeaders()
      setTimeout(() => res.destroy(), 250).unref?.()
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: {"choices":[{"delta":{"content":"fallback"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(40), async ({ baseUrl }) => {
            const response = await post(baseUrl)
            const text = await response.text()
            assert.equal(response.status, 200)
            assert.match(text, /fallback/)
            assert.equal(groq.requests.length, 1)
            assert.equal(nvidia.requests.length, 1)
          })
        })
      })
    })
  })
})
