# FCM Broker — Project Plan

**Status:** In Progress — publish reviewed canonical source
**Last verified:** 2026-09-06
**Target repository:** `n0namer/free-coding-models`
**Canonical project SoT:** this `PLAN.md` owns project stage, decisions, DoD, anti-drift state, and next move. Product/router details remain in the existing README/PRD/source owners.

## North Star

FCM on Windows is one autonomous OpenAI-compatible broker at `http://127.0.0.1:19280/v1` that requires no routine manual model picking:

catalog/configured providers → live probes → strongest usable coding models ordered first → active named set → per-model circuit breakers/failover → periodic set refresh → persistent evidence across restarts.

Clients depend only on FCM. No second model router/control plane is introduced.

## Scope

- **Target:** local Windows FCM only.
- **Runtime:** Docker Desktop container `fcm`, image `free-coding-models:local`.
- **Persistent owner:** Docker volume `free-coding-models_fcm-data` mounted at `/home/fcm`.
- **Non-target:** Outreach and all consumer business logic. Consumers are black-box clients only.
- Debug/fix live runtime first. Do not use GitHub code edit → redeploy as a diagnostic primitive.
- Canonicalize accepted code deltas only after live Windows verification.
- Never expose credentials or delete/reset the FCM volume.

## CURRENT facts

- GitHub code baseline inspected on 2026-09-05: `6c3015737ebd6b204178cbd61550f0b8b17be23c`.
- `PLAN.md` was refreshed on `main` with documentation-only commits after that code baseline. These commits changed no runtime code; re-read CURRENT `main` HEAD before any future source canonicalization.
- Windows container `fcm` is healthy, version `0.5.81`, bound to `127.0.0.1:19280`, restart policy `unless-stopped`.
- Runtime config is `/home/fcm/.free-coding-models.json`.
- Current active set is `fast-coding`; two named sets coexist.
- Last verified runtime before the 20-route course correction is a managed 8-model `fast-coding` set with `autoHeal=true` and `userCustomized=false`: `opencode-zen/big-pickle`, `opencode-zen/nemotron-3-ultra-free`, `ollama-cloud/nemotron-3-ultra`, `groq/openai/gpt-oss-120b`, `ollama-cloud/gpt-oss:120b`, `zai/zai/glm-4.5-flash`, `ollama-cloud/nemotron-3-super`, `groq/openai/gpt-oss-20b`.
- User-approved target course correction (2026-09-06): `fast-coding` must expose a 20-route fallback contour with Gonka pinned first: (1) `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`, (2) `gonka/MiniMaxAI/MiniMax-M2.7`, then in order `llm7/minimax-m2.7`, `googleai/gemini-3-flash-preview`, `opencode-zen/big-pickle`, `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`, `requesty/nvidia/nemotron-3-ultra-550b-a55b`, `openrouter/poolside/laguna-xs-2.1:free`, `googleai/gemini-3.1-flash-lite`, `openrouter/nvidia/nemotron-3-super-120b-a12b:free`, `requesty/nvidia/nemotron-3-super-120b-a12b`, `zai/zai/glm-4.5-flash`, `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, `requesty/google/gemma-4-31b-it`, `requesty/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, `llm7/codestral-latest`, `googleai/gemini-3.7-flash`, `opencode-zen/mimo-v2.5-free`, `opencode-zen/nemotron-3.5-lightning-free`, `openrouter/cohere/north-mini-code:free`.
- The 20-route list is intended state until live Windows readback/application succeeds; do not report it as CURRENT actual state prematurely. Regular automation must not shrink it back to the previous 8-model target or move Gonka below positions 1–2.
- `/api/models` exposes ~206 catalog models / 22 providers; 16 providers currently have credentials available without printing them.
- `/v1/models` exposes `fcm` and named virtual models.
- Real Windows daemon logs prove failover after 429, 502/503, timeout, and network failures, including circuit opening.
- `docker restart fcm` now preserves the managed config, both named sets, `autoHeal=true`, `userCustomized=false`, persistent probe cache, persistent runtime telemetry, and the live code patches.
- CURRENT canonical `ensureRouterConfigForDaemon()` still overwrites non-active named sets and router-level customization. Upstream has not fixed this at current HEAD.
- The live Windows container has a direct runtime patch that merges existing `config.router` and existing named sets before refreshing the active set. Syntax and restart/readback are green.
- Persistent probe/runtime telemetry is fixed in the live Windows container: `atomicWriteJson()` now creates its parent directory. Both `probe-cache.json` and `runtime-telemetry.json` were created on the Docker volume and reloaded successfully after `docker restart fcm`.
- Live `--sync-set` is hardened for unattended use: exact normalized `OK`, validated `echo(text="OK")`, disabled-provider filtering, same-refresh provider stop after 429, last-known-good protection, managed-mode handoff, and a larger plain-probe token budget to avoid false negatives on reasoning models. A real scan first preserved the old set when only 1 model passed, then succeeded with 7 models after the probe-budget fix.
- Windows Scheduled Task `FCM Managed Set Refresh` remains installed every 4 hours with `StartWhenAvailable=true`, `IgnoreNew`, 3 retries at 5-minute intervals, and a 30-minute limit. After the live CLI safe-no-change exit fix, a Task Scheduler verification run completed at 2026-09-06 12:15:54 +03:00 with `LastTaskResult=0`; task state returned to `Ready`, next run remained 2026-09-06 16:00:42 +03:00, the managed set stayed at 8 models, and `autoHeal=true` / `userCustomized=false` were preserved.
- Running image source commit is not proven. Windows checkout and running container must not be assumed equivalent to GitHub `main`.

## Ratified architecture (BMad Fast Path / brownfield)

1. **One broker, not layered routers.** FCM remains the only model-control plane.
2. **Strength first, health gates second, runtime fallback always.** `--sync-set` pre-ranks by tier/SWE/coding affinity; only models that pass live capability probes enter the managed set. Router priority remains the primary order among eligible models.
3. **Failure isolation.** Per-model circuit breakers and provider-aware cooldown/backoff prevent repeatedly burning requests on known-bad routes.
4. **Graceful degradation.** A bad refresh must not destroy the last known-good set.
5. **Persistent evidence.** Probe cache and runtime telemetry must survive daemon/container restart.
6. **Native automation.** Periodic refresh uses FCM `--sync-set` driven by Windows Task Scheduler; no new service/router.
7. **Anti-drift identities remain separate:** Design/SoT, canonical Git source, Windows checkout/image, and live patched container.

## Evidence-based reliability principles

- Avoid tail-latency amplification and repeatedly selecting slow/unhealthy replicas; bounded failover/circuit isolation is preferred.
- Failure suspicion should accumulate from observations rather than treating one transient miss as permanent death.
- Backoff/cooldown after overload limits correlated retry pressure.
- Preserve last-known-good service state when discovery evidence is incomplete.

These principles guide FCM hardening; they do not create requirements beyond the existing FCM scanner/prober/router design.

## Phase Goal

Make the existing Windows FCM runtime behave as its README intends:

1. persistent probe/runtime state;
2. safe managed `fast-coding` refresh;
3. strong usable models ordered before weaker usable models;
4. automatic request failover;
5. restart persistence;
6. scheduled refresh every 4 hours;
7. no normal-operation manual model picking.

## Definition of Done

- [x] One OpenAI-compatible endpoint is healthy at `127.0.0.1:19280/v1`.
- [x] Catalog and configured providers are discoverable without exposing secrets.
- [x] Router failover on real 429/5xx/timeout/network failures is evidenced.
- [x] Existing live named-set preservation patch survives daemon/container reload.
- [x] Probe cache persists across container restart.
- [x] Runtime telemetry persists across container restart.
- [x] Managed `fast-coding` is generated by live probes from configured providers.
- [x] Plain probe requires normalized exact `OK`.
- [x] Tool probe validates the expected `echo` call and `text="OK"`.
- [x] A provider returning 429 is not repeatedly probed during the same refresh.
- [x] A partial/degraded refresh cannot replace a substantially better last-known-good set.
- [ ] Active `fast-coding` contains the user-approved 20-route fallback contour in the exact priority order, with Gonka routes fixed at priorities 1–2; live readback must prove all 20 routes are present.
- [ ] Periodic automation preserves the 20-route contour and Gonka-first priority instead of shrinking it back to the previous 8-model managed target.
- [x] Periodic Windows Task Scheduler refresh runs every 4 hours and completes with correct unattended success semantics; verified Task Scheduler run returned `LastTaskResult=0` after the live safe-no-change CLI exit fix.
- [x] Container restart preserves config, sets, probe cache, and runtime telemetry.
- Host-level Windows reboot/login/Docker Desktop startup proof is explicitly out of scope for this phase by user decision; container restart + verified Scheduled Task execution are sufficient operational evidence.
- [ ] Accepted live code deltas are published to the canonical repository after runtime gate is green.

## 30-Minute Batch Policy

Each batch optimizes for 80/20 reliability gain and ends with readback evidence.

### Batch 1 — persistence + safe refresh

1. Patch live `/app/src/core/shared-helpers.js`: `atomicWriteJson()` creates parent directory.
2. Verify syntax; restart same `fcm` container; prove probe/runtime files survive restart.
3. Harden live `/app/src/core/sync-set.js` only enough for unattended operation:
   - exact normalized plain `OK`;
   - validate expected tool call/arguments;
   - stop further same-provider probes after 429;
   - preserve last-known-good set on materially incomplete scan.
4. Run `--sync-set fast-coding` using the native FCM mechanism.
5. Verify active set size/order and router health/failover.

### Batch 2 — Windows automation + restart

1. Create one Windows Scheduled Task for native `--sync-set fast-coding` every 4 hours.
2. Ensure task does not run concurrently and runs missed executions after logon.
3. Verify task history/result and config readback.
4. Restart the `fcm` container and re-check endpoint/set/cache/telemetry.
5. Record exact live deltas and recovery backups.

### Batch 3 — canonicalization

Only after live gates are green:
1. update canonical source with the proven minimal deltas;
2. add focused existing-framework regression tests;
3. run canonical tests on exact source;
4. reconcile source/runtime identity.

## Anti-Drift Contract

Track independently:

- **Design / SoT:** `PLAN.md` + README/PRD.
- **Canonical source:** GitHub `main` exact SHA.
- **Windows source/image:** local checkout/image identity.
- **Live runtime:** actual container plus direct patch hashes/backups.
- **Observed state:** endpoint/config/cache/set/circuit/log readback.

Never infer one identity from another.

After every material mutation: verify → update state → re-plan from CURRENT evidence.
If live patching is used, record base, delta, backup, syntax/runtime evidence, and eventual canonical owner.

## Recovery

- Do not delete/recreate the FCM volume.
- Direct live file patches must have a backup under `/home/fcm`.
- Container-only code patches survive `docker restart` but not container recreate/image rebuild.
- If a refresh produces insufficient evidence, retain the prior known-good set.
- If a live code patch regresses startup, restore only the exact owned backup and restart the same container.

## Suggested Review Order

**Scheduler / refresh semantics**

- Safe last-known-good refreshes return scheduler success without masking genuine failures.
  [`bin/free-coding-models.js:198`](./bin/free-coding-models.js#L198)

- Managed refresh gating owns strict probes, 429 provider stop, and last-known-good preservation.
  [`src/core/sync-set.js:373`](./src/core/sync-set.js#L373)

**Persistence / daemon config preservation**

- Daemon startup preserves existing router settings and all named sets.
  [`src/core/router-daemon.js:3690`](./src/core/router-daemon.js#L3690)

- Atomic JSON persistence creates its parent directory before first write.
  [`src/core/shared-helpers.js:77`](./src/core/shared-helpers.js#L77)

**Regression evidence**

- Sync-set behavior and CLI safe-no-change contract.
  [`test/sync-set.test.js:241`](./test/sync-set.test.js#L241)

- First-write cache persistence.
  [`test/probe-cache.test.js:132`](./test/probe-cache.test.js#L132)

- Named-set and router customization preservation.
  [`test/test.js:2865`](./test/test.js#L2865)

## Current Stop Point

The live broker is healthy and CURRENT `fast-coding` has 8 managed models with `autoHeal=true` and `userCustomized=false`. Persistence/failover gates remain green. The Windows Scheduled Task verification run completed at 2026-09-06 12:15:54 +03:00 with task state `Ready` and `LastTaskResult=0`; the managed set remained at 8 models and the managed-mode flags were preserved.

The live CLI correction in `/app/bin/free-coding-models.js` is therefore accepted: `--sync-set` exits 0 when `result.ok === true` or `result.reusedExisting === true`, while genuine failures remain non-zero. Backup: `/home/fcm/free-coding-models.js.bak-scheduler-exit-20260906`; patched SHA-256 `7afdb1606d782e01282ce70080200fd6f84ff28bd3f25c5496d3085ec15dad0`; backup SHA-256 `a713ba2f9d393f748a77875602d2b67b92f1eba65cc21a6741fc3377682f4216`; `node --check` PASS.

A clean reviewed canonical source commit `492f3e98176d8aa086103d2b39e3d819dec63131` exists locally on `fix/windows-fcm-broker-stability`. It was rebased onto remote `main` at `c2409b87d7f1124cd091c3b154a7ab69ff99e425`; comparison with the prior reviewed `59288deb5d375d6db747ef7723a55789c4ee91ab` shows only `PLAN.md` changed across the rebase, so source/test content is identical. Focused gates after rebase are green (`sync-set` 9/9, probe-cache 41/41, router-config 6/6). The running container was not redeployed or recreated. Later `main` commits in this batch are PLAN-only SoT updates.

## Exact Next Move

BMad Quick Dev explicitly forbids auto-push. At the publication boundary, fetch CURRENT `main`, rebase the reviewed source-only commit over any later PLAN-only commits, require the same eight-file source/test diff and green focused gates, then publish/open review without redeploying or recreating the running container. Mark the publication DoD complete only after remote source and PLAN readback.
