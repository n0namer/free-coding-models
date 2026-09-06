# FCM Broker — Project Plan

**Status:** In Progress — stabilize unattended scheduled refresh
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
- CURRENT `fast-coding` is a managed 8-model set with `autoHeal=true` and `userCustomized=false`. Observed order: `opencode-zen/big-pickle`, `opencode-zen/nemotron-3-ultra-free`, `ollama-cloud/nemotron-3-ultra`, `groq/openai/gpt-oss-120b`, `ollama-cloud/gpt-oss:120b`, `zai/zai/glm-4.5-flash`, `ollama-cloud/nemotron-3-super`, `groq/openai/gpt-oss-20b`.
- `/api/models` exposes ~206 catalog models / 22 providers; 16 providers currently have credentials available without printing them.
- `/v1/models` exposes `fcm` and named virtual models.
- Real Windows daemon logs prove failover after 429, 502/503, timeout, and network failures, including circuit opening.
- `docker restart fcm` now preserves the managed config, both named sets, `autoHeal=true`, `userCustomized=false`, persistent probe cache, persistent runtime telemetry, and the live code patches.
- CURRENT canonical `ensureRouterConfigForDaemon()` still overwrites non-active named sets and router-level customization. Upstream has not fixed this at current HEAD.
- The live Windows container has a direct runtime patch that merges existing `config.router` and existing named sets before refreshing the active set. Syntax and restart/readback are green.
- Persistent probe/runtime telemetry is fixed in the live Windows container: `atomicWriteJson()` now creates its parent directory. Both `probe-cache.json` and `runtime-telemetry.json` were created on the Docker volume and reloaded successfully after `docker restart fcm`.
- Live `--sync-set` is hardened for unattended use: exact normalized `OK`, validated `echo(text="OK")`, disabled-provider filtering, same-refresh provider stop after 429, last-known-good protection, managed-mode handoff, and a larger plain-probe token budget to avoid false negatives on reasoning models. A real scan first preserved the old set when only 1 model passed, then succeeded with 7 models after the probe-budget fix.
- Windows Scheduled Task `FCM Managed Set Refresh` remains installed every 4 hours with `StartWhenAvailable=true`, `IgnoreNew`, 3 retries at 5-minute intervals, and a 30-minute limit. CURRENT latest scheduled run at 2026-09-06 12:00:43 +03:00 completed its Docker action after ~4 minutes with exit code 1 (`LastTaskResult=1`); next run is 2026-09-06 16:00:42 +03:00. Task history proves this was the FCM CLI process returning non-zero, not a Task Scheduler launch failure.
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
- [x] Active managed set contains a useful fallback depth and is ordered strongest usable → weaker usable.
- [ ] Periodic Windows Task Scheduler refresh runs every 4 hours and completes with correct unattended success semantics; CURRENT latest run returned exit code 1 and requires closure.
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

## Current Stop Point

The live broker is healthy and CURRENT `fast-coding` has 8 managed models with `autoHeal=true` and `userCustomized=false`. Persistence/failover gates remain green. However, the latest automatic Windows Scheduled Task run returned exit code 1 after the FCM CLI process executed for ~4 minutes, so unattended refresh completion semantics are not yet closed.

The FCM CLI currently exits non-zero whenever `syncSet().ok` is false. The live `sync-set` safety gate can deliberately preserve the existing last-known-good set with `reusedExisting=true`; for unattended operation this safe no-change must not be reported as an operational scheduler failure. This is the current bounded correction target; verify the exact result before accepting the patch.

A previously verified source canonicalization commit `388c858d442d47f062cf57a9f3fa338d01d62e32` exists locally, but publication is deferred until the CURRENT scheduler gate is green so source does not outrun runtime evidence.

## Exact Next Move

On the live `fcm` container, reread and back up `/app/bin/free-coding-models.js`, then patch only `--sync-set` exit semantics so `result.ok === true` or `result.reusedExisting === true` returns process exit 0 while genuine failures remain non-zero. Verify syntax, run the native refresh through Windows Task Scheduler, require `LastTaskResult=0`, and confirm the managed set/config remain healthy before updating this PLAN again.
