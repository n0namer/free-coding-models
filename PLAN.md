# FCM Broker — Project Plan

**Status:** In Progress — apply Gonka-first 20-route `fast-coding` contour
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
- CURRENT `fast-coding` is the verified 20-route user-pinned contour with `gonka/deepseek-ai/DeepSeek-V4-Flash-0731` and `gonka/MiniMaxAI/MiniMax-M2.7` at priorities 1–2, `router.failover.maxRetries=19`, `userCustomized=true`, and `autoHeal=false`. This allows up to 20 eligible routing attempts while preventing daemon membership replacement.
- User-approved target course correction (2026-09-06): `fast-coding` must expose a 20-route fallback contour with Gonka pinned first: (1) `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`, (2) `gonka/MiniMaxAI/MiniMax-M2.7`, then in order `llm7/minimax-m2.7`, `googleai/gemini-3-flash-preview`, `opencode-zen/big-pickle`, `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`, `requesty/nvidia/nemotron-3-ultra-550b-a55b`, `openrouter/poolside/laguna-xs-2.1:free`, `googleai/gemini-3.1-flash-lite`, `openrouter/nvidia/nemotron-3-super-120b-a12b:free`, `requesty/nvidia/nemotron-3-super-120b-a12b`, `zai/zai/glm-4.5-flash`, `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, `requesty/google/gemma-4-31b-it`, `requesty/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, `llm7/codestral-latest`, `googleai/gemini-3.7-flash`, `opencode-zen/mimo-v2.5-free`, `opencode-zen/nemotron-3.5-lightning-free`, `openrouter/cohere/north-mini-code:free`.
- The 20-route contour is VERIFIED CURRENT: `/api/models` contained all 20 requested routes and every route had configured credentials; `/sets` readback showed exact priority order, Gonka at 1–2, and 20 models after SIGHUP and after `docker restart fcm`. A real OpenAI-compatible request routed to `gonka/deepseek-ai/DeepSeek-V4-Flash-0731` and returned `OK`; daemon logs also show Gonka DeepSeek → Gonka MiniMax failover on real 429/502 failures.
- `/api/models` exposes ~206 catalog models / 22 providers; 16 providers currently have credentials available without printing them.
- `/v1/models` exposes `fcm` and named virtual models.
- Real Windows daemon logs prove failover after 429, 502/503, timeout, and network failures, including circuit opening.
- `docker restart fcm` preserves the exact 20-route `fast-coding` contour, both named sets, `router.failover.maxRetries=19`, `autoHeal=false`, `userCustomized=true`, persistent probe cache, persistent runtime telemetry, and the live code patches.
- CURRENT canonical `ensureRouterConfigForDaemon()` still overwrites non-active named sets and router-level customization. Upstream has not fixed this at current HEAD.
- The live Windows container has a direct runtime patch that merges existing `config.router` and existing named sets before refreshing the active set. Syntax and restart/readback are green.
- Persistent probe/runtime telemetry is fixed in the live Windows container: `atomicWriteJson()` now creates its parent directory. Both `probe-cache.json` and `runtime-telemetry.json` were created on the Docker volume and reloaded successfully after `docker restart fcm`.
- Live `--sync-set` is hardened for unattended use: exact normalized `OK`, validated `echo(text="OK")`, disabled-provider filtering, same-refresh provider stop after 429, last-known-good protection, managed-mode handoff, and a larger plain-probe token budget to avoid false negatives on reasoning models. A real scan first preserved the old set when only 1 model passed, then succeeded with 7 models after the probe-budget fix.
- Windows Scheduled Task `FCM Managed Set Refresh` keeps its existing 4-hour trigger/settings but its action is now a non-mutating guard: `docker exec fcm node /app/bin/free-coding-models.js --daemon-status`. The daemon continues its own model health probes/circuit breaking, while scheduled automation no longer rewrites membership. Verified task runs returned `LastTaskResult=0` / `Ready` and preserved the exact 20-route Gonka-first contour before and after `docker restart fcm`.
- Running image source commit is not proven. Windows checkout and running container must not be assumed equivalent to GitHub `main`.

## Ratified architecture (BMad Fast Path / brownfield)

1. **One broker, not layered routers.** FCM remains the only model-control plane.
2. **Pinned user order first, health gates second, runtime fallback always.** The exact 20-route `fast-coding` priority order is authoritative, with Gonka fixed at 1–2. Health/circuit state may temporarily skip an unhealthy route, but automation must not rewrite membership or priority. `router.failover.maxRetries=19` permits traversal of the full 20-route eligible contour.
3. **Failure isolation.** Per-model circuit breakers and provider-aware cooldown/backoff prevent repeatedly burning requests on known-bad routes.
4. **Graceful degradation.** A bad refresh must not destroy the last known-good set.
5. **Persistent evidence.** Probe cache and runtime telemetry must survive daemon/container restart.
6. **Native automation without membership rewrite.** The FCM daemon continuously owns health probes/circuit state for the pinned contour. Windows Task Scheduler remains the existing 4-hour host automation but now runs `--daemon-status` as a guard; it must not call `--sync-set` for this pinned set. No new service/router is introduced.
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
3. the user-approved 20-route fallback contour with `gonka/deepseek-ai/DeepSeek-V4-Flash-0731` and `gonka/MiniMaxAI/MiniMax-M2.7` fixed at priorities 1–2, followed by the remaining 18 routes in the recorded order;
4. automatic request failover/circuit breaking across the contour;
5. restart persistence;
6. scheduled refresh every 4 hours that validates health without shrinking or reordering the pinned 20-route contour;
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
- [x] Active `fast-coding` contains the user-approved 20-route fallback contour in the exact priority order, with Gonka routes fixed at priorities 1–2; live `/sets` readback proved all 20 routes are present before and after container restart.
- [x] Periodic automation preserves the 20-route contour and Gonka-first priority: the 4-hour task no longer invokes `--sync-set`, and verified guard runs leave membership/order unchanged.
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

Last verified runtime before the new course correction is healthy with an 8-model managed `fast-coding` set, `autoHeal=true`, `userCustomized=false`, persistent failover state, and a Windows Scheduled Task that last completed with `LastTaskResult=0`. The user has now changed the required active contour to the explicit 20-route Gonka-first list recorded above; that target is not yet accepted as CURRENT actual state.

The existing 4-hour Scheduled Task still invokes native `--sync-set fast-coding`, whose previous managed target is 8. Therefore merely writing a 20-route config would be temporary: unattended automation could shrink/reorder it again. The current correction must change both the live set and the refresh policy while preserving circuit breakers, failover, persistence, and the single FCM control plane.

The previously reviewed source candidate `492f3e98176d8aa086103d2b39e3d819dec63131` predates this 20-route policy change and is not sufficient to close the new DoD. Publication is paused until the new runtime behavior is verified directly on Windows. The Personal Edge connection is currently unavailable (`edge_unreachable` / DEV `edge_connect_timeout`), so no live mutation has been attempted for this course correction.

## Exact Next Move

When the Windows edge is reachable, first reread `/home/fcm/.free-coding-models.json`, `/api/models`, the Scheduled Task action, and the live `sync-set` behavior. Verify all 20 requested routes/providers are present and configured without printing credentials. Back up the exact config/code owners, apply the 20-route `fast-coding` order directly in the running container with Gonka priorities 1–2, and minimally change unattended refresh behavior so it cannot shrink or reorder the pinned contour. Then verify endpoint health, exact 20-route readback, Gonka-first order, real failover eligibility, persistence, and a Task Scheduler run before updating this PLAN again.
