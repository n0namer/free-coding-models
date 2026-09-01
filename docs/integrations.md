# Tool Integrations

Every tool follows the same pattern:

1. Run `free-coding-models --<tool>` (or press `Z` to cycle)
2. Wait for models to ping (green ✅)
3. Navigate with ↑↓, press **Enter**
4. If the tool CLI is missing, FCM offers a tiny install confirmation and runs the official global install command
5. FCM writes the selected model into the tool's config and launches it

---

## Tool → Config mapping

Every tool writes the selected provider + model into its native config (or sets env vars for CLI-only tools), then launches it. Missing CLIs are detected and offered for one-line install automatically.

| Tool | Flag | Config written |
|------|------|----------------|
| OpenCode CLI | `--opencode` | `~/.config/opencode/opencode.json` |
| OpenCode Desktop | `--opencode-desktop` | `~/.config/opencode/opencode.json` (then opens the app) |
| OpenCode WebUI | `--opencode-web` | `~/.config/opencode/opencode.json` (then opens the web dashboard) |
| OpenClaw | `--openclaw` | `~/.openclaw/openclaw.json` |
| Crush | `--crush` | `~/.config/crush/crush.json` |
| Goose | `--goose` | `~/.config/goose/config.yaml` + `custom_providers/<id>.json` + `secrets.yaml` |
| Aider | `--aider` | `~/.aider.conf.yml` (+ passes `--model`) |
| Kilo CLI | `--kilo` | `~/.config/kilo/opencode.json` |
| Qwen Code | `--qwen` | `~/.qwen/settings.json` (+ `~/.qwen/models.json`) |
| OpenHands | `--openhands` | `LLM_MODEL` env var |
| Amp | `--amp` | `~/.config/amp/settings.json` |
| Pi | `--pi` | `~/.pi/agent/models.json` + `~/.pi/agent/settings.json` |
| Continue | `--continue` | `~/.continue/config.yaml` |
| Cline | `--cline` | `~/.cline/globalState.json` |
| Hermes | `--hermes` | `~/.hermes/config.yaml` (via `hermes config set` + `hermes gateway restart`) |
| ForgeCode | `--forgecode` | `~/.forge/.forge.toml` (`[[providers]]` block) |
| ZCode | `--zcode` | `~/.zcode/v2/config.json` + `bots-model-cache.v2.json` |
| Xcode Intelligence | `--xcode` | None — launches Xcode; configure the endpoint in Xcode settings |
| Copilot CLI | `--copilot` | `COPILOT_*` BYOK env vars (`COPILOT_PROVIDER_BASE_URL`, `COPILOT_MODEL`, `COPILOT_PROVIDER_API_KEY`) |
| FCM Router | `--fcm-router` | Connects the tool to the local router daemon (`http://localhost:19280/v1`, model `fcm`) |

> Default (no tool flag) = OpenCode CLI. Press **`Z`** in the TUI to cycle tools without restarting. Entries installed via the **`Y`** flow are namespaced under `fcm-*` in the target config.

---

## Shared server broker contract

When several server applications use one FCM deployment, downstream projects should depend on the broker contract, not on individual providers.

Use the same three logical variables in every project:

```env
FCM_BASE_URL=http://fcm-dev-internal:19280/v1
FCM_API_KEY=<broker-client-token>
FCM_MODEL=fcm
```

Applications that expect OpenAI-style environment names should map the shared values at their boundary:

```env
OPENAI_BASE_URL=${FCM_BASE_URL}
OPENAI_API_KEY=${FCM_API_KEY}
OPENAI_MODEL=${FCM_MODEL}
```

Rules:

- `FCM_BASE_URL` is the stable internal service address; do not pin a container IP.
- `FCM_API_KEY` authenticates the client to FCM. It is not a Gonka/OpenRouter/LLM7/Kilo provider key.
- Provider API keys stay only in the FCM deployment.
- `FCM_MODEL=fcm` keeps provider/model selection centralized in the router.
- Do not copy provider-specific model IDs into SWE, PR-AF, or later clients unless a project has a documented exception.
- Rollback for a migrated client is only its previous LLM base URL/token/model mapping; the broker and unrelated clients are not changed.

### Coolify shared-variable pattern

Coolify shared variables can be defined at team, project, or environment scope and referenced from a resource. They are references, not automatic inheritance: each application must explicitly reference the shared variable, then restart or redeploy as required for the new value to materialize.

Recommended shared names:

```env
FCM_BASE_URL=http://fcm-dev-internal:19280/v1
FCM_API_KEY=<secret>
FCM_MODEL=fcm
```

Then each client resource references those values using its native environment-variable mapping. This gives one control-plane value for rotation while keeping the application contract stable.

### Migration acceptance

For each project, migrate one at a time and require:

1. DNS/connectivity from the client container to `FCM_BASE_URL`.
2. Missing/invalid broker token is rejected once broker-side auth is enabled.
3. Non-streaming chat succeeds.
4. Streaming succeeds if the client uses it.
5. Tool calling succeeds if the client uses tools.
6. The client receives a valid answer through `model=fcm`.
7. Rollback to the previous LLM configuration is known and bounded.

---

## OpenCode

```bash
free-coding-models --opencode
```

FCM auto-detects your configured providers, writes the selected model to `opencode.json`, and launches `opencode`.

### tmux sub-agent panes

When launched inside `tmux`, FCM auto-adds `--port` so OpenCode can spawn sub-agent panes:

- Priority 1: reuse `OPENCODE_PORT` if valid and free
- Priority 2: auto-pick first free port in `4096–5095`

```bash
OPENCODE_PORT=4098 free-coding-models --opencode
```

### ZAI + OpenCode (transparent proxy)

ZAI uses `/api/coding/paas/v4/*` instead of standard `/v1/*`. When you pick a ZAI model in OpenCode mode, FCM automatically starts a localhost proxy that rewrites ZAI paths to OpenCode's expected format. It starts on a random port and shuts down when OpenCode exits. No manual config needed.

### Manual setup (optional)

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "provider": {
    "nvidia": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NVIDIA NIM",
      "options": {
        "baseURL": "https://integrate.api.nvidia.com/v1",
        "apiKey": "{env:NVIDIA_API_KEY}"
      }
    }
  },
  "model": "nvidia/deepseek-ai/deepseek-v3.2"
}
```

> ⚠️ Free models have usage limits — check [build.nvidia.com](https://build.nvidia.com) for quotas.

---

## OpenClaw

```bash
free-coding-models --openclaw
```

FCM writes the selected model as primary into `~/.openclaw/openclaw.json` and launches `openclaw`.

### What gets written

```json
{
  "models": {
    "providers": {
      "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "api": "openai-completions"
      }
    }
  },
  "env": { "NVIDIA_API_KEY": "nvapi-xxxx" },
  "agents": {
    "defaults": {
      "model": { "primary": "nvidia/deepseek-ai/deepseek-v3.2" },
      "models": { "nvidia/deepseek-ai/deepseek-v3.2": {} }
    }
  }
}
```

> ⚠️ `providers` must be nested under `models.providers` — a root-level `providers` key is ignored.
>
> ⚠️ The model must also be listed in `agents.defaults.models` (the allowlist), or OpenClaw rejects it with *"not allowed"*.

---

## Install Endpoints (`Y` key)

`Y` opens a step-by-step flow to install a full provider catalog into a tool's config — so you can pick the model **inside** the tool instead of from FCM.

Steps:

1. **Provider** — pick one with a configured API key
2. **Tool** — config-based (`OpenCode`, `OpenClaw`, `Crush`, `Goose`, `Pi`, `Aider`, `Amp`, `Qwen`) or env-based (`OpenHands`)
3. **Scope** — all models or selected models only
4. **Models** (if selected) — multi-select from the provider catalog

Notes:

- Entries are namespaced under `fcm-*` in the target config
- `OpenCode CLI` and `OpenCode Desktop` share `opencode.json`
- For `OpenHands`, FCM writes `~/.fcm-openhands-env` — source it before launching
