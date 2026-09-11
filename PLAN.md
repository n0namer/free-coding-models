# FCM Broker — Project Plan

**Status:** In Progress — controlled host/runtime migration `DESKTOP-A55K2JN` → `DESKTOP-49VP0KH`
**Last verified:** 2026-09-11
**Target repository:** `n0namer/free-coding-models`
**Canonical project SoT:** this `PLAN.md` owns current state, decisions, DoD, anti-drift identities, migration evidence, rollback state, and exact next move.

## North Star

FCM is one autonomous OpenAI-compatible broker at `http://127.0.0.1:19280/v1` with no routine manual model picking. The current operational goal is to move the **actual verified Windows runtime**, not merely Git source, from A55 to the work laptop while preserving exact live code, persistent state, credentials/configuration, routing invariants, automation, and a fast rollback path.

Target end state:

`DESKTOP-49VP0KH` → Docker Desktop → container `fcm` → `127.0.0.1:19280/v1` → exact source-current config/state → restart persistence → Scheduled Task guard → real consumer requests.

`DESKTOP-A55K2JN` remains physically intact as rollback for at least 48 hours after successful cutover.

## Value → State → Gap → Constraint

### Value

- Remove A55 as the operational owner/single-host dependency for FCM.
- Preserve live patches and persistent routing state that are not yet fully canonicalized in Git.
- Make recovery testable: target must prove equivalent behavior before source is disabled.

### State — FACTS

#### Canonical SoT / Git

- Canonical repository: `n0namer/free-coding-models`, branch `main`.
- Last read `main` HEAD before this re-plan: `8a5a0387abcbd7f8c91c5468dc3013b3a5b9f5d8`; recent commits through that SHA are PLAN/documentation changes, not proof of live runtime identity.
- Running image source commit remains unproven. Never infer live runtime from Git `main`.

#### Source host — `DESKTOP-A55K2JN`

- Windows 11 Pro, Docker Desktop installed, Docker CLI `29.6.1`.
- Active/dirty FCM workspace found at `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models`.
- That workspace points to `vava-nessa/free-coding-models`, HEAD observed `4e51bf9ce44456fd93814e7ca23333527d094b13`, with modified/untracked local files including `Dockerfile`, `docker-compose.yml`, `scripts/docker-init.mjs`, `sources.js`, `src/core/config.js`, `src/core/ping.js`, `src/core/router-daemon.js`, `test/test.js`, plus local operational files.
- `.env` and `.env.coolify-sync` exist. Secret values must never be printed; transfer/verification uses hashes and key names only.
- Separate canonicalization checkout exists at `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models-canonicalize` and points to `n0namer/free-coding-models`; its local PLAN was stale versus GitHub and is not current authority.
- Docker Desktop failed on 2026-09-11 because standard Windows environment variable `ProgramData` was absent even though `C:\ProgramData` exists and Windows Shell Folders resolves Common AppData there.
- Bounded recovery succeeded without persistent registry/environment mutation: Docker Desktop was relaunched with process environment `ProgramData=C:\ProgramData` plus standard user/system paths; engine then reported `29.6.1 linux/amd64` and `docker-desktop` WSL2 became Running.
- Before attempting to restart FCM, `docker inspect fcm` proved:
  - container ID `036059dcc829fac8379e5753e14ce6ec90afcc2a6eeb3adc0e469a35eb8d6652`;
  - image tag `free-coding-models:local`;
  - image ID `sha256:8b235d5a102cd641b4e5fed4bd282222a08b217dbe9fa45672fbeeb5ba7eba7d`;
  - restart policy `unless-stopped`;
  - network `free-coding-models_default`;
  - bind `127.0.0.1:19280`;
  - named volume `free-coding-models_fcm-data -> /home/fcm`;
  - container state at that checkpoint: `Exited (137)`, not a current green runtime.
- Redacted migration evidence saved under `D:\Users\NIKITA\Documents\DEV\.migration-to-49-20260911\fcm\`:
  - `container-inspect.json`;
  - `image-inspect.json`;
  - `volume-inspect.json`;
  - `FCM-Managed-Set-Refresh.xml`.
- Windows Scheduled Task `FCM Managed Set Refresh` action remains `docker.exe exec fcm node /app/bin/free-coding-models.js --daemon-status`, 4-hour cadence, `StartWhenAvailable=true`, execution limit 30 minutes. Latest observed result before source recovery was `LastTaskResult=1`, consistent with the stopped Docker/runtime state; historical green result must not be treated as CURRENT.
- After the source Docker engine recovery, an attempt was made to start `fcm`; before health/readback completed, A55 became unavailable through Desktop Commander. Therefore **current FCM health after that start attempt is UNKNOWN** and must be re-read before snapshot/cutover.

#### Target host — `DESKTOP-49VP0KH`

- Exact target hostname is proven; there is only one matching `DESKTOP-49...` device.
- Windows 11 Pro; target user DEV root is `C:\Users\Рафик\Documents\DEV`.
- No `D:` volume; `C:` had about 150 GB free at inventory time.
- No target FCM project/container/image/volume/Scheduled Task was discovered in the initial read-only inventory.
- Docker Desktop / Docker CLI are not installed/discovered.
- Firmware virtualization readback: `VirtualizationFirmwareEnabled=False`, `VMMonitorModeExtensions=False`, `SecondLevelAddressTranslationExtensions=False`.
- `wsl --status` confirms WSL2 cannot currently run because the Virtual Machine Platform / firmware virtualization prerequisite is not available.
- `winget` is present (`v1.29.290`). Git is not installed globally, but `MinGit-2.55.0.3-64-bit.zip` already exists in Downloads and can be used as a bounded portable verification tool.

### Gap

Target is not yet capable of running the FCM Docker runtime. Source current application state also needs one fresh readback because the last captured container checkpoint was Exited 137 and A55 disconnected before post-start verification.

### ONE active constraint

**Target firmware virtualization is disabled.** Until `DESKTOP-49VP0KH` reports virtualization enabled and WSL2/Virtual Machine Platform can operate, Docker runtime acceptance on target is impossible.

Do not hide this blocker by copying folders and calling migration complete.

## SMART Goal

Within 72 hours of the target virtualization gate becoming green, make `DESKTOP-49VP0KH` the active FCM owner with:

1. exact live code/state/config transferred from source CURRENT;
2. `127.0.0.1:19280/v1` healthy;
3. source/target critical hashes and routing invariants matching;
4. OpenAI-compatible smoke request PASS;
5. `docker restart fcm` persistence PASS;
6. Scheduled Task manual run `LastTaskResult=0`;
7. real consumer reachability PASS;
8. source preserved as rollback for ≥48 hours.

## Options

### A — targeted live-runtime migration — SELECTED

Transfer four owned layers separately:

1. actual live container writable layer as a private migration image;
2. named volume `free-coding-models_fcm-data` as a consistent stopped-container snapshot;
3. dirty source workspace including `.git` and ENV/config files, excluding reconstructable caches where safe;
4. Windows host automation (Scheduled Task XML + startup lifecycle evidence).

Why selected: preserves non-Git live patches while avoiding unrelated Docker Desktop VM state.

### B — clone/build from canonical Git — REJECTED FOR MIGRATION

Useful later for canonicalization, but unsafe now because live image/container and dirty workspace are not proven equivalent to Git `main`.

### C — copy entire Docker Desktop VHDX — EMERGENCY FALLBACK ONLY

A55 has `D:\docker-migration-snapshot-20260911\docker_data.vhdx`, but its underlying VHDX timestamp predates later September FCM runtime changes. Whole-Docker migration also carries unrelated state. Do not use it as primary source.

## Cartesian critique of selected option

- **If we do targeted migration:** target receives only FCM-owned runtime/state and can be verified independently.
- **If we do not:** A55 remains the runtime dependency and host failure remains unrecovered.
- **What targeted migration avoids:** assuming Git, an old VHDX, or Compose YAML is equivalent to the live broker.
- **What not doing it avoids:** temporary migration effort, but at the cost of continuing single-host operational risk.

## Hypothesis

**If** target virtualization/Docker are made operational and we migrate the exact live image + exact persistent volume + dirty workspace/ENV + host automation, **then** `DESKTOP-49VP0KH` will reproduce source-current FCM behavior, **because** those four layers collectively own non-canonicalized code, durable state, credentials/config, and lifecycle; **metric** = hash/invariant equality plus health/smoke/restart/task/consumer PASS; **deadline** = 72 hours after virtualization gate PASS.

## Preserved runtime invariants

These are acceptance gates, not assumptions. Re-read source CURRENT before transfer; if source CURRENT differs, migrate CURRENT and update this section before cutover.

### `fast-coding`

Expected verified baseline: 20 routes, user-pinned order, `userCustomized=true`, `autoHeal=false`, `router.failover.maxRetries=19`.

Priority 1–2 are architectural invariants:

1. `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`
2. `gonka/MiniMaxAI/MiniMax-M2.7`

Remaining verified order:

3. `llm7/minimax-m2.7`
4. `googleai/gemini-3-flash-preview`
5. `opencode-zen/big-pickle`
6. `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`
7. `requesty/nvidia/nemotron-3-ultra-550b-a55b`
8. `openrouter/poolside/laguna-xs-2.1:free`
9. `googleai/gemini-3.1-flash-lite`
10. `openrouter/nvidia/nemotron-3-super-120b-a12b:free`
11. `requesty/nvidia/nemotron-3-super-120b-a12b`
12. `zai/zai/glm-4.5-flash`
13. `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
14. `requesty/google/gemma-4-31b-it`
15. `requesty/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
16. `llm7/codestral-latest`
17. `googleai/gemini-3.7-flash`
18. `opencode-zen/mimo-v2.5-free`
19. `opencode-zen/nemotron-3.5-lightning-free`
20. `openrouter/cohere/north-mini-code:free`

### Outreach

- Canonical consumer model: `fcm:outreach-quality`.
- Expected source baseline: 116 credentialed routes.
- Gonka DeepSeek and Gonka MiniMax fixed at priorities 1–2 and raced concurrently for non-streaming Outreach requests.
- Expected `router.failover.maxRetries=115`; live validation ceiling was raised to 500.
- `outreach-judge` is compatibility-only and mirrors the same 116-route membership during consumer migration.
- A previous real smoke proved concurrent Gonka launch and fallback after both Tier-1 failures; one successful live `x-fcm-race-winner` response remains an outstanding functional gate when provider connectivity permits.

## Live patch identities to preserve

Do not rebuild away these deltas before target equivalence is proven:

- `/app/src/core/router-daemon.js` named virtual model routing patch; historical patched SHA-256 `156642e1810ef06a154a2141cef618f978d4607a31e7504f06dbb1e3e418d73a`; backup `/home/fcm/router-daemon.js.bak-named-model-routing-20260906`.
- Later `/app/src/core/router-daemon.js` Gonka race patch; historical patched SHA-256 `55bc63a719e288f54a279bb451ec3f72fd099c9f01a339833cd2981eb5c1e9e3`; backup `/home/fcm/router-daemon.js.bak-gonka-race-20260909`.
- `/app/src/core/config.js` retry-ceiling change; backup `/home/fcm/config.js.bak-max-retries-20260909`.
- Persistent telemetry/cache fix in `shared-helpers.js` and hardened `sync-set.js` behavior remain part of accepted live runtime.
- Historical hashes are evidence only; migration manifest must record fresh source CURRENT hashes before snapshot.

## 48–72 h Test

### Critical task 1 — platform gate

**Output:** target capable of running Docker Linux containers.

**Done:** firmware virtualization enabled; WSL2/Virtual Machine Platform usable; Docker server answers; Compose v2 resolves configuration.

**Risk:** requires firmware/BIOS change and likely reboot.

**First bounded move:** enable Intel virtualization (and VT-d if exposed) in target firmware, reboot Windows, re-read `VirtualizationFirmwareEnabled` and `wsl --status` before installing/starting FCM.

### Critical task 2 — source CURRENT snapshot and migration

**Output:** verified FCM migration bundle and green target runtime.

**Done:** source CURRENT manifest captured; exact live image/volume/workspace/task transferred with SHA-256 equality; target health/invariants/smoke/restart PASS.

**Risk:** snapshot while persistent data is changing, or trusting stale historical state.

**First bounded move:** when A55 Remote Commander returns, read container state/logs/endpoints first. Do not snapshot until source health and routing config are re-established or the exact degraded state is explicitly accepted as source CURRENT.

### Support task 1 — workspace / ENV

Target path: `C:\Users\Рафик\Documents\DEV\free-coding-models`.

Preserve `.git`, dirty/untracked work, `.env`, `.env.coolify-sync`, Compose/Docker files, and operational scripts. Verify secret-bearing files by SHA-256; never echo values. Use target portable MinGit for status/HEAD verification if full Git is not yet installed.

### Support task 2 — host automation

Restore the Scheduled Task only after target runtime is green. Use exported source XML as template; adapt only target principal/path if required. Manual task run must return `LastTaskResult=0` and must not mutate pinned routing membership.

### Support task 3 — observation / rollback

After cutover, keep A55 container/image/volume/workspace/backups intact for ≥48 hours. Do not delete/decommission automatically.

## Migration execution order / DoD

- [x] Source exact hostname proven: `DESKTOP-A55K2JN`.
- [x] Target exact hostname proven: `DESKTOP-49VP0KH`.
- [x] Target existing FCM inventory checked; no active target FCM discovered.
- [x] Source container/image/volume/task identities captured in redacted manifest files.
- [x] Source Docker startup failure root cause narrowed to missing `ProgramData`; bounded process-environment recovery proved engine can run again.
- [ ] A55 Remote Commander available again after the FCM start attempt.
- [ ] Source `fcm` CURRENT health/state/endpoints re-read.
- [ ] Fresh source live code/config SHA-256 manifest captured.
- [ ] Fresh `/sets`, `/v1/models`, routing counts/order/maxRetries captured.
- [ ] Target firmware virtualization enabled.
- [ ] Target WSL2 / Virtual Machine Platform gate PASS.
- [ ] Target Docker Desktop installed and engine healthy.
- [ ] Target resolved Compose config validated before runtime creation.
- [ ] Dirty workspace + ENV/config copied to target and hashes verified.
- [ ] Live container writable layer committed to private migration image and image archive hash recorded.
- [ ] Source `fcm` stopped for final consistent volume snapshot; source container not deleted.
- [ ] Named volume archived separately; archive hash recorded.
- [ ] Transfer artifact hashes equal source ↔ target.
- [ ] Target volume restored without overwriting any unbacked pre-existing target state.
- [ ] Target `fcm` created from source-equivalent inspect/Compose parameters; `127.0.0.1:19280` preserved.
- [ ] Source/target critical live code/config hashes equal.
- [ ] Target `/health`, `/sets`, `/v1/models` PASS.
- [ ] `fast-coding` source/target count/order/Gonka #1–2/maxRetries equal.
- [ ] `outreach-quality` source/target count/order/Gonka #1–2/maxRetries equal.
- [ ] `fcm:outreach-quality` published on target.
- [ ] OpenAI-compatible target smoke PASS or, if provider APIs are externally unavailable, deterministic internal routing/fallback evidence proves target parity.
- [ ] `docker restart fcm` persistence PASS.
- [ ] Target Scheduled Task imported/adapted, manual run `LastTaskResult=0`.
- [ ] Actual consumer reachability to target PASS.
- [ ] Source task disabled/container stopped only after target full DoD.
- [ ] Rollback procedure tested logically and source remains recoverable without restoring from backup.
- [ ] 48-hour target observation window complete before any source decommission proposal.

## Edge-case guards — BMad review

The migration must explicitly handle these branches:

- source Remote Commander unavailable → no destructive/snapshot actions; preserve evidence and retry readback when source returns;
- source container stopped/unhealthy → diagnose/re-establish CURRENT before declaring a migration baseline;
- target already gains an FCM instance during migration → inventory/backup/compare first; never overwrite blindly;
- port `19280` occupied on target → identify owner before any bind change;
- image archive hash mismatch → halt restore;
- volume archive hash mismatch → halt restore;
- target volume name collision → backup or use timestamped migration volume; no blind overwrite;
- source volume changes during snapshot → stop only `fcm` for final snapshot, then archive;
- task principal differs on target → adapt principal only; preserve action/cadence semantics;
- external provider outage → do not confuse external 503/connect timeout with target migration failure; verify routing/log semantics separately;
- consumer is not local to target → discover current secure reachability before changing bind; never widen to `0.0.0.0` by default;
- target restart policy works but Docker Desktop itself does not start in required user lifecycle → migration remains incomplete;
- any required invariant is unproven → status is not DONE.

## Evidence-based operating rules

- Verify the resolved Compose model before runtime operations; rendered config is necessary but not sufficient — runtime inspect/health/end-to-end behavior are the acceptance evidence.
- Never use `docker compose down -v`, volume deletion, factory reset, or image/container recreate as a diagnostic shortcut.
- Container commit does not own mounted volume state; image and named volume are migrated separately.
- Backups are useful only when restore/readback is tested. Hash transfer artifacts and prove target restore behavior.
- Prefer blue/green cutover: old host stays intact until new host proves equivalence and observation stability.

## Anti-Drift Contract

Track independently:

1. **Design / SoT:** this `PLAN.md`.
2. **Canonical Git:** exact `n0namer/free-coding-models` `main` SHA.
3. **Dirty Windows workspace:** exact A55 checkout/head/status + ENV hashes.
4. **Image identity:** source/target image ID and migration archive hash.
5. **Live container code:** selected `/app/...` hashes + backups.
6. **Persistent state:** volume identity + config hash + archive hash.
7. **Observed behavior:** endpoints, set membership/order, circuits/logs, real smoke.
8. **Host lifecycle:** Docker Desktop readiness + Scheduled Task state/result.

Never infer one identity from another. After every material mutation: verify → record evidence → update state → re-plan from CURRENT evidence.

## Recovery / Rollback

- Never delete/recreate source FCM volume during migration.
- Do not delete source container/image/workspace or local backups.
- If target fails an obligatory gate: stop target `fcm`, preserve target evidence, restore any backed-up pre-existing target state, restart source Docker/`fcm`, re-enable source Scheduled Task, verify source health, and return consumers to source endpoint if they were switched.
- Rollback should normally use the intact source host, not restore from an archive.

## PDCA — current cycle

### PLAN

**Expected:** source readback → target platform ready → exact targeted transfer → target equivalence → cutover → 48 h observe.

### DO — completed this cycle

- Identified exact source and target hosts.
- Re-read canonical Git PLAN and detected stale local canonicalization PLAN.
- Inventoried target Docker/WSL/virtualization state.
- Found source Docker Desktop startup failure root cause (`ProgramData` absent).
- Recovered source Docker engine with a process-scoped environment fix; no persistent environment/registry change made.
- Captured redacted container/image/volume/task evidence.
- Attempted to start source `fcm`; source Remote Commander disconnected before post-start health proof.

### STUDY

- **Expected:** source Docker recovery immediately yields green FCM readback.
- **Actual:** Docker engine recovered, but source container had been Exited 137 at manifest time; source became inaccessible via Remote Commander during/after the start attempt.
- **Variance cause:** current source application state remains unobserved after start; do not speculate that FCM is healthy or failed.
- **Lesson:** snapshot/cutover must wait for a fresh source CURRENT readback. Historical green state is not enough.
- **Hypothesis status:** still plausible, not yet tested end-to-end.

### ACT

**Decision:** CONTINUE the targeted migration, but gate all source snapshot/cutover work on source reappearance and gate all target runtime work on firmware virtualization. No change to routing architecture.

## Current Stop Point

Canonical plan is now aligned to the host migration. Target `DESKTOP-49VP0KH` is identified and has enough disk space but is not Docker-ready because firmware virtualization is disabled. Source Docker engine was recovered from the missing-`ProgramData` failure, and source container/image/volume/task identities were captured. At the captured checkpoint `fcm` was Exited 137; after attempting to start it, A55 became unavailable through Desktop Commander before health/routing readback completed.

Therefore the last historically verified 20-route/116-route routing state remains the expected acceptance baseline, **not a claim about current source health**.

## Exact Next Move

1. Reconnect/read `DESKTOP-A55K2JN` as soon as Remote Commander is available; first action is read-only Docker/container/log/endpoint/config/hash evidence, not another restart/recreate.
2. On `DESKTOP-49VP0KH`, enable firmware virtualization and reboot; then prove `VirtualizationFirmwareEnabled=True` and WSL2/Virtual Machine Platform readiness.
3. Once both gates are green, take the final source CURRENT manifest and execute the selected targeted migration: live image + named volume + dirty workspace/ENV + Scheduled Task, with SHA-256 verification before restore.
4. Do not advance the older Outreach-consumer/canonicalization backlog until the host migration reaches target equivalence or is explicitly stopped; migration risk reduction is the current priority.
