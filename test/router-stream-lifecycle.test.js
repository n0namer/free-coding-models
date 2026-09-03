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

function config(streamStallTimeoutMs = 1000) {
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
  it('routes CLOSED healthy models before higher-priority HALF_OPEN probes', async () => {
    await withRouter(config(), async ({ runtime }) => {
      const primaryKey = `groq/${GROQ_MODEL}`
      const fallbackKey = `nvidia/${NVIDIA_MODEL}`
      runtime.circuit.get(primaryKey).state = 'HALF_OPEN'
      runtime.circuit.get(fallbackKey).state = 'CLOSED'
      const order = runtime.getRoutingCandidates(runtime.getSet('stream-test'))
      assert.equal(order[0].key, fallbackKey)
      assert.equal(order[1].key, primaryKey)
    })
  })

  it('records a partial-stream idle timeout and does not splice a second model', async () => {
    await withProvider(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n')
      setTimeout(() => res.destroy(), 2500).unref?.()
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: {"choices":[{"delta":{"content":"fallback"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(), async ({ runtime, baseUrl }) => {
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
      setTimeout(() => res.destroy(), 2500).unref?.()
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: {"choices":[{"delta":{"content":"fallback"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(), async ({ baseUrl }) => {
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

  it('atomically retries tool streams that stall after upstream partial output', async () => {
    await withProvider(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":"{\\\"path\\\":\\\"a"}}]},"finish_reason":null}]}\n\n')
      setTimeout(() => res.destroy(), 2500).unref?.()
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: {"choices":[{"delta":{"content":"fallback-ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(), async ({ runtime, baseUrl }) => {
            const response = await post(baseUrl, {
              tools: [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object', properties: { path: { type: 'string' } } } } }],
              tool_choice: 'auto',
            })
            const text = await response.text()
            assert.equal(response.status, 200)
            assert.doesNotMatch(text, /call_1/)
            assert.match(text, /fallback-ok/)
            assert.equal(groq.requests.length, 1)
            assert.equal(nvidia.requests.length, 1)
            const failed = runtime.requestLog.find((item) => item.model === `groq/${GROQ_MODEL}` && item.error === 'stream_stall_timeout')
            assert.ok(failed)
            assert.equal(failed.stream_outcome, 'idle_timeout')
            const completed = runtime.requestLog.find((item) => item.model === `nvidia/${NVIDIA_MODEL}` && item.stream_outcome === 'completed')
            assert.ok(completed)
          })
        })
      })
    })
  })

  it('finishes an atomic stream on a terminal marker even if upstream stays open', async () => {
    await withProvider(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      setTimeout(() => res.destroy(), 2500).unref?.()
    }, async (groq) => {
      await withProvider(async (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end('data: [DONE]\n\n')
      }, async (nvidia) => {
        await withSourceUrls({ groq: groq.url, nvidia: nvidia.url }, async () => {
          await withRouter(config(), async ({ runtime, baseUrl }) => {
            const response = await post(baseUrl, { response_format: { type: 'json_object' } })
            const text = await response.text()
            assert.equal(response.status, 200)
            assert.match(text, /done/)
            assert.equal(groq.requests.length, 1)
            assert.equal(nvidia.requests.length, 0)
            assert.ok(runtime.requestLog.find((item) => item.model === `groq/${GROQ_MODEL}` && item.stream_outcome === 'completed'))
          })
        })
      })
    })
  })
})
