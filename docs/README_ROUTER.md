# Smart Model Router

> ⚠️ **ALPHA** — The router is functional but still under active development. APIs and behavior may change between versions.

The **FCM Router** is a local OpenAI-compatible daemon that keeps running after the TUI closes. Point your coding tool at one localhost endpoint and let FCM route each request to the best available model from your favorites.

## Quick Start

```bash
# Start the router in the background (or press 'S' in the Router Dashboard)
free-coding-models --daemon-bg

# Check status
free-coding-models --daemon-status

# Stop it cleanly
free-coding-models --daemon-stop
```

## Configuration

Open the Router Dashboard with **Shift+R** from the main table. The dashboard shows:

1. **Status Banner** — red (stopped), green (running), or orange (starting)
2. **Quick Setup** — copy these into your coding tool:

| Field | Value |
|-------|-------|
| Base URL | `http://localhost:19280/v1` |
| Model | `fcm` |
| API key | `fcm-local` |

3. **Router Models** — your favorited models from the main table, in fallback order

### Managing Router Models

Your **favorites** (star models with `F` in the main table) automatically become the router's model pool. The order determines fallback priority:

- **#1** is tried first for every request
- **#2** is the first fallback if #1 fails
- And so on...

Use **Shift+↑/↓** in the Router Dashboard to reorder models.

### Health Check Speed

Press **I** in the Router Dashboard to cycle through health check speeds:
- **Slow** (eco) — minimal background probing
- **Normal** (balanced) — default
- **Fast** (aggressive) — frequent health checks

## Routing Behavior

- Priority order works immediately on cold start, then probes refine health scores over time.
- Transient failures (`429`, `500`, `502`, `503`, timeouts) fail over to the next model.
- Authentication problems (`401`, `403`, missing keys) are marked separately so bad credentials do not poison the health tracking; after one provider returns an auth error, the router skips the rest of that provider for the current request.
- Upstream HTML maintenance pages and malformed successful JSON are treated as retryable provider failures instead of being forwarded to your coding tool.
- Quota and rate-limit failures include retry headers in the final router `503` payload when providers expose them.
- If a coding tool disconnects mid-request, the daemon aborts the upstream request without counting it as a provider failure.
- Streaming requests retry before the first byte; after partial output starts, the daemon records the failure and lets the current stream finish as safely as possible.
- **Per-provider schema normalization.** Before forwarding to a provider, the router runs a small normalizer keyed on the provider. Today, `zai` (GLM) and `mistral` / `codestral` are normalized: unsupported parameters (`parallel_tool_calls`, `n`, `top_k`, `logprobs`, `echo`, `user`, `metadata`, `store`) are stripped, orphan `tool` role messages that lack a matching assistant `tool_calls` entry are dropped, and `temperature` is clamped to the provider's accepted range. This dramatically reduces the 400/422 surface that ZCode, Claude Code, and Cline hit when their tool-call flow is enabled. Other OpenAI-compatible providers (Groq, Cerebras, NVIDIA, …) pass through unchanged.

### Shared broker architecture (Pareto baseline)

For a server-hosted FCM used by multiple applications, keep clients on one stable OpenAI-compatible contract instead of exposing provider-specific credentials or model IDs.

**Invariants**

- One stable internal base URL, e.g. `http://fcm-dev-internal:19280/v1`.
- One virtual default model: `fcm`. Client applications do not pin Gonka/OpenRouter/LLM7/Kilo model IDs.
- One broker client credential boundary: clients authenticate to FCM; upstream provider keys remain inside the FCM deployment only.
- Router ordering, health, quotas, retries, circuit breakers, and provider failover remain broker-owned concerns.
- Client applications consume three logical variables: `FCM_BASE_URL`, `FCM_API_KEY`, and `FCM_MODEL`.
- A client may map those variables to SDK-specific names (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`) at the application boundary, but provider secrets must not be copied into downstream projects.

**Pareto rollout**

1. Keep the existing internal Docker/Coolify DNS name stable.
2. Add broker-side Bearer authentication before broad multi-project adoption.
3. Define shared deployment variables once at the Coolify project/environment level and reference them from each client resource.
4. Migrate one client first, verify chat/stream/tools and rollback, then repeat the same contract for SWE, PR-AF, and later projects.
5. Defer client SDK packages, service discovery, Vault integration, and multiple virtual profiles (`fcm-code`, `fcm-fast`, etc.) until usage evidence shows they are needed.

**Readiness gate for central-broker adoption**

- `GET /health` is healthy and `inFlight` returns to zero after load tests.
- Normal chat, streaming, tool calling, and cross-container consumer requests pass.
- Overload is bounded (the router returns controlled `503` instead of crashing).
- Broker source identity is pinned to an exact commit for reproducibility.
- Client auth rejects missing/invalid credentials before the broker is treated as a shared platform dependency.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/chat/completions` | Route through the active model pool |
| `GET /v1/models` | Return virtual models (`fcm`) |
| `GET /health` | Daemon status JSON |
| `GET /stats` | Routing, health, request log, and token stats |
| `GET /stream/events` | Live SSE endpoints |
| `POST /daemon/probe-mode` | Set health check speed: `{ "probeMode": "eco" | "balanced" | "aggressive" }` |
| `GET /` | Web dashboard (same port) |
| `GET /api/models` | Model data with latency stats |
| `GET /api/config` | Provider config (keys masked) |
| `GET /api/events` | Live SSE for dashboard |
| `POST /api/settings` | Save API keys and provider toggles |
