import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rmSync } from 'node:fs'
import { createRouterRuntimeForTest } from '../src/core/router-daemon.js'
import { normalizeRouterConfig, DEFAULT_ROUTER_SETTINGS } from '../src/core/config.js'

function listenOnRandomPort(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()))
}

test('broker client bearer auth protects /v1 while keeping /health public', async () => {
  const previousToken = process.env.FCM_CLIENT_TOKEN
  process.env.FCM_CLIENT_TOKEN = 'fcm-client-test-token'

  const router = normalizeRouterConfig({
    ...DEFAULT_ROUTER_SETTINGS,
    enabled: true,
    onboardingSeen: true,
  })
  const tokenPath = join(tmpdir(), `fcm-router-auth-test-${process.pid}-${Date.now()}.json`)
  const runtime = createRouterRuntimeForTest({
    config: { telemetry: { enabled: false }, apiKeys: {}, router },
    tokenPath,
  })
  const server = createServer((req, res) => void runtime.handleHttp(req, res))
  const port = await listenOnRandomPort(server)
  runtime.port = port
  runtime.server = server
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const health = await fetch(`${baseUrl}/health`)
    assert.equal(health.status, 200)

    const missing = await fetch(`${baseUrl}/v1/models`)
    const missingPayload = await missing.json()
    assert.equal(missing.status, 401)
    assert.equal(missing.headers.get('www-authenticate'), 'Bearer')
    assert.equal(missingPayload.error.code, 'invalid_api_key')

    const wrong = await fetch(`${baseUrl}/v1/models`, {
      headers: { authorization: 'Bearer wrong-token' },
    })
    assert.equal(wrong.status, 401)

    const valid = await fetch(`${baseUrl}/v1/models`, {
      headers: { authorization: 'Bearer fcm-client-test-token' },
    })
    const validPayload = await valid.json()
    assert.equal(valid.status, 200)
    assert.ok(validPayload.data.some((entry) => entry.id === 'fcm'))
  } finally {
    try { runtime.tokenTracker.flush({ force: true }) } catch {}
    await closeServer(server)
    rmSync(tokenPath, { force: true })
    if (previousToken === undefined) delete process.env.FCM_CLIENT_TOKEN
    else process.env.FCM_CLIENT_TOKEN = previousToken
  }
})
