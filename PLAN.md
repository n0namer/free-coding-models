# FCM Broker — Project Plan

**Status:** In Progress — controlled host/runtime migration `DESKTOP-A55K2JN` → `DESKTOP-49VP0KH`
**Last verified:** 2026-09-11
**Target repository:** `n0namer/free-coding-models`
**Canonical SoT:** this `PLAN.md` owns current state, decisions, DoD, anti-drift identities, migration evidence, rollback, and exact next move.

## North Star

Make `DESKTOP-49VP0KH` the active owner of the **actual working FCM runtime**, not merely a Git checkout:

`DESKTOP-49VP0KH` → Docker Desktop → `fcm` → `127.0.0.1:19280/v1` → source-current code/config/state → restart persistence → Scheduled Task guard → real consumer traffic.

Keep `DESKTOP-A55K2JN` physically intact as rollback for at least 48 hours after successful cutover.

## Value → State → Gap → Constraint

### Value

- Remove A55 as the operational single-host dependency.
- Preserve live patches, persistent routing state, ENV/config and automation that are not fully recoverable from Git alone.
- Make recovery provable: target must pass equivalence gates before source is disabled.

### State — FACTS

#### Canonical / anti-drift

- Canonical repository: `n0namer/free-coding-models`, branch `main`.
- Git/PLAN, Windows checkout, Docker image, live container, persistent volume and observed endpoint state are **separate identities**. Never infer one from another.
- Running image source commit is not proven.
- The local canonicalization checkout on A55 has a stale PLAN and is not authority; GitHub `main/PLAN.md` is authority.

#### Source — `DESKTOP-A55K2JN`

- Windows 11 Pro.
- Active dirty workspace: `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models`.
- Workspace remote observed: `vava-nessa/free-coding-models`; HEAD observed `4e51bf9ce44456fd93814e7ca23333527d094b13`.
- Modified/untracked work exists in Docker/Compose/runtime/router files; migration must preserve the dirty workspace rather than reclone/rebuild it.
- `.env` and `.env.coolify-sync` exist. Never print secret values; verify/transfer by SHA-256 and key names only.
- Docker Desktop 4.81 / Docker CLI 29.6.1 are installed.
- Container identity captured before recovery:
  - name `fcm`;
  - image `free-coding-models:local`;
  - image ID `sha256:8b235d5a102cd641b4e5fed4bd282222a08b217dbe9fa45672fbeeb5ba7eba7d`;
  - container ID `036059dcc829fac8379e5753e14ce6ec90afcc2a6eeb3adc0e469a35eb8d6652`;
  - restart `unless-stopped`;
  - network `free-coding-models_default`;
  - bind `127.0.0.1:19280`;
  - named volume `free-coding-models_fcm-data -> /home/fcm`.
- Scheduled Task `FCM Managed Set Refresh` still executes `docker.exe exec fcm node /app/bin/free-coding-models.js --daemon-status` every 4 hours.
- Redacted evidence already saved under `D:\Users\NIKITA\Documents\DEV\.migration-to-49-20260911\fcm\`: `container-inspect.json`, `image-inspect.json`, `volume-inspect.json`, task XML, plus endpoint snapshots from a brief green interval.
- Docker Desktop initially failed because `ProgramData` was absent from the effective environment. A bounded launch with `ProgramData=C:\ProgramData` temporarily restored engine `29.6.1 linux/amd64` and `fcm` reached healthy state.
- The user-level `ProgramData=C:\ProgramData` variable was then restored and an environment-change broadcast sent.
- **New evidence:** Docker/WSL became unstable again. A later restart reached Docker backend startup but Linux engine control API remained unavailable for >2 minutes; backend logs repeatedly reported engine/init ping timeouts and missing guest socket-forwarder endpoint.
- During this second Docker/WSL startup, A55 became unreachable not only through Desktop Commander but also from another LAN machine (`Test-Connection DESKTOP-A55K2JN=False`). Therefore this is a **host/source stability issue**, not merely an FCM HTTP failure.
- Current A55/FCM state after that event is UNKNOWN until the host returns. Do not claim a fresh snapshot exists.

#### Target — `DESKTOP-49VP0KH`

- Exact hostname proven; DEV root `C:\Users\Рафик\Documents\DEV`.
- Windows 11 Pro; about 150 GB free on C: at inventory time; no D:.
- No pre-existing target FCM project/container/image/volume/task was discovered.
- Portable MinGit 2.55 is available under DEV tools for later HEAD/status verification.
- **Docker Desktop is now installed:** version `4.81.0.232925`; Docker CLI `29.6.1`; Compose `v5.2.0`.
- Docker engine is not running.
- Firmware virtualization recheck remains `VirtualizationFirmwareEnabled=False`; WSL2 cannot operate until firmware virtualization is enabled.
- Port 19280 is not occupied.

### Gap

1. Recover A55 to a stable, readable source state long enough to capture one atomic CURRENT manifest and consistent migration snapshot.
2. Enable target firmware virtualization; then prove WSL2/Docker engine readiness.
3. Transfer/restore exact image + volume + dirty workspace/ENV + host automation and prove target equivalence.

### ONE active constraint — CURRENT CYCLE

**A55 host availability/stability.** It is currently offline after repeatable Docker/WSL startup instability. Until it returns, do not create a guessed source snapshot or substitute Git/old VHDX.

**Next gate after source capture:** target firmware virtualization.

## Facts / Assumptions / Hypothesis

### Facts

- Target Docker binaries are already installed, so installation is no longer a blocker.
- Target virtualization is disabled.
- Source runtime contains state not proven equivalent to Git.
- Source host became LAN-unreachable during the second Docker/WSL engine startup.

### Assumptions to verify

- A55 source disk/container/volume remain intact after the host outage.
- Saved endpoint snapshots were captured during a genuine green interval and can be used as supporting evidence, but not as a replacement for fresh hashes.
- No consumer requires a network bind broader than loopback on the target.

### Working hypothesis

**If** A55 returns and we capture the source with one bounded, non-rebuilding snapshot pass, then enable target virtualization and restore exact image + volume + workspace/ENV + task, **then** target will reproduce source-current FCM behavior, **because** those four layers collectively own live code, durable state, credentials/config and lifecycle.

**Metric:** source/target hash equality + routing invariants + health/smoke/restart/task/consumer PASS.  
**Deadline:** within 72 hours after both source-capture and target-virtualization gates are green.

## Options

### A — targeted live-runtime migration — SELECTED

Transfer four owned layers separately:

1. live container writable layer → private migration image;
2. named volume → consistent stopped-container archive;
3. dirty workspace including `.git` + ENV/config;
4. Scheduled Task XML / host lifecycle evidence.

### B — clone/build from Git — REJECTED FOR MIGRATION

Would lose uncanonicalized live/dirty state. Use later only for canonicalization.

### C — whole Docker Desktop VHDX — EMERGENCY FALLBACK ONLY

Too broad and its available A55 snapshot predates later FCM live changes.

## Cartesian critique

- **Do A:** moves only FCM-owned state and provides clean source↔target verification.
- **Do not A:** A55 remains the single operational owner.
- **A prevents:** accidental replacement of live runtime with stale Git/Compose/VHDX assumptions.
- **Not doing A prevents:** migration effort, but preserves current host-failure risk.

## Preserved runtime invariants — acceptance gates

Fresh source readback wins over historical values. If CURRENT differs, record the difference before cutover.

### `fast-coding`

Expected last-known-good baseline:

- 20 routes;
- `userCustomized=true`, `autoHeal=false`;
- priority #1 `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`;
- priority #2 `gonka/MiniMaxAI/MiniMax-M2.7`;
- historical set-level failover allowed traversal of the full 20-route contour.

Exact previously ratified 20-route order:

1. `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`
2. `gonka/MiniMaxAI/MiniMax-M2.7`
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

Expected last-known-good baseline:

- canonical model `fcm:outreach-quality`;
- 116 credentialed routes;
- Gonka DeepSeek / MiniMax fixed #1/#2 and raced for non-streaming requests;
- `router.failover.maxRetries=115` for the 116-route pool;
- validation ceiling raised to 500;
- `outreach-judge` compatibility alias mirrors the same pool.

## Live patch identities to preserve

Historical hashes are evidence, not a substitute for fresh source CURRENT hashes:

- `/app/src/core/router-daemon.js` later Gonka-race patched SHA-256: `55bc63a719e288f54a279bb451ec3f72fd099c9f01a339833cd2981eb5c1e9e3`.
- Earlier named-model-routing router hash: `156642e1810ef06a154a2141cef618f978d4607a31e7504f06dbb1e3e418d73a`.
- `/app/src/core/config.js` retry-ceiling backup: `/home/fcm/config.js.bak-max-retries-20260909`.
- Accepted persistence/sync-set/CLI patches must also be captured fresh before image snapshot.

## 48–72 h Test

### Critical 1 — recover and capture source

**Output:** immutable migration manifest + image/volume/workspace/task bundle.  
**Done:** A55 reachable; source identities/hashes/endpoints captured; image exported; final volume snapshot taken with `fcm` stopped; artifact SHA-256 recorded.  
**Risk:** repeated Docker/WSL startup destabilizes host.  
**First step <30 min:** when A55 returns, do one short read-only host/container check. If engine is already healthy, capture everything in one bounded pass. If engine is not healthy, do not loop restarts; diagnose/recover host first.

### Critical 2 — target platform + restore

**Output:** green target `fcm`.  
**Done:** virtualization=True; WSL2 operational; Docker engine healthy; restore succeeds; hashes/invariants/health/smoke/restart PASS.  
**Risk:** firmware change/reboot.  
**First step <30 min:** enable Intel virtualization (and VT-d if exposed) in BIOS/UEFI, reboot, re-read virtualization and `wsl --status`.

### Support 1 — workspace / ENV

Restore to `C:\Users\Рафик\Documents\DEV\free-coding-models`. Preserve `.git`, dirty/untracked work, `.env`, `.env.coolify-sync`, Compose/Docker files and operational scripts. Hash secret-bearing files; never print values.

### Support 2 — automation

Import source task XML only after target FCM is green. Adapt only target-specific principal/path if necessary. Manual task run must return `LastTaskResult=0` and must not mutate pinned membership.

### Support 3 — observation / rollback

Keep A55 image/container/volume/workspace untouched for ≥48h after cutover. No automatic cleanup/decommission.

## Migration DoD / anti-drift checklist

### Identify / inventory

- [x] Source hostname: `DESKTOP-A55K2JN`.
- [x] Target hostname: `DESKTOP-49VP0KH`.
- [x] Target checked for existing FCM collision — none found.
- [x] Target Docker Desktop/CLI/Compose now present.
- [x] Target port 19280 currently free.
- [x] Source container/image/volume/task identities captured.

### Source CURRENT

- [ ] A55 host reachable/stable after latest Docker/WSL event.
- [ ] Source Docker engine stable enough for a bounded snapshot pass.
- [ ] Source `fcm` state/health re-read.
- [ ] Fresh `/health`, `/sets`, `/v1/models`, `/api/models` captured.
- [ ] Fresh critical code/config SHA-256 captured.
- [ ] Dirty workspace status/HEAD + `.env`/`.env.coolify-sync` hashes captured without values.

### Migration bundle

- [ ] Commit actual live container to private migration image.
- [ ] `docker image save` archive created + SHA-256.
- [ ] Stop only `fcm` for final consistent volume snapshot.
- [ ] Named volume archived separately + SHA-256.
- [ ] Workspace/ENV archive created + SHA-256.
- [ ] Task XML + redacted manifest included.
- [ ] No secret values printed or committed to GitHub.

### Target platform

- [ ] Firmware virtualization enabled.
- [ ] WSL2/Virtual Machine Platform gate PASS.
- [ ] Docker engine returns Linux/amd64 server version.
- [ ] Compose v2 resolves source-equivalent config.

### Restore / verification

- [ ] Transfer hashes equal source ↔ target.
- [ ] Target workspace restored and Git dirty state matches source intent.
- [ ] Target named volume restored without destroying pre-existing state.
- [ ] Target `fcm` created with equivalent mount/network/restart/loopback bind.
- [ ] Source/target critical live hashes equal.
- [ ] `fast-coding` count/order/Gonka #1/#2 match.
- [ ] `outreach-quality` count/order/Gonka #1/#2 match.
- [ ] Source/target relevant `maxRetries` match.
- [ ] `/health`, `/sets`, `/v1/models` PASS.
- [ ] OpenAI-compatible `fcm:outreach-quality` smoke PASS or provider outage is cleanly distinguished from local runtime failure.
- [ ] `docker restart fcm` persistence PASS.
- [ ] Scheduled Task manual run `LastTaskResult=0`.
- [ ] Real consumer reachability PASS.

### Cutover / rollback

- [ ] Only after target green: stop source FCM and disable source task.
- [ ] Do not delete source container/image/volume/workspace.
- [ ] Rollback proven: target stop → source Docker/FCM/task restore → source health → consumer endpoint restore.
- [ ] A55 retained ≥48h observation window.

## Edge-case guards

- Source offline/unhealthy → no guessed snapshot and no Git rebuild substitution.
- Target already gains an FCM instance before restore → inventory/backup first; never overwrite blindly.
- Hash mismatch → HALT restore for that artifact.
- Port 19280 becomes occupied → identify owner; do not change bind silently.
- Same-named target volume exists → backup/new timestamped volume first.
- Volume snapshot while `fcm` is writing → invalid final snapshot; stop `fcm` first.
- Task principal differs → adapt principal only; preserve action/cadence semantics.
- Provider APIs fail → local `/health`, routing state, logs and fallback progression distinguish provider outage from migration failure.
- Consumer is remote → determine secure reachability separately; never broaden `127.0.0.1` to `0.0.0.0` automatically.

## Study

### Expected vs actual this cycle

- **Expected:** restore Docker on A55, capture source manifest, then prepare bundle.
- **Actual:** first bounded Docker recovery briefly succeeded and FCM became healthy; second Docker/WSL startup became stuck and A55 became LAN-unreachable.
- **Variance:** source-host stability is worse than expected; repeated Docker restart is not a safe primitive.
- **Cause evidence:** Docker backend engine/init ping timeouts + LAN loss during startup.
- **Lesson:** treat source-host recovery as an explicit gate; snapshot in one bounded pass only after host stability is proven.
- **Hypothesis status:** still plausible, not yet tested end-to-end.

## Act / current decision

**CHANGE COURSE:** source stability becomes the active constraint for this PDCA cycle. Target Docker installation is already complete; target BIOS virtualization remains the next downstream gate.

Do not rebuild FCM from Git. Do not move the old Docker VHDX. Do not loop Docker restarts on A55.

## Exact next 3 actions

1. Wait only for A55 to become reachable; immediately perform one short read-only host/Docker/FCM check. If Docker is already healthy, capture manifest/hashes and snapshot in one bounded batch; if not, stop and recover host stability before touching runtime again.
2. On target, after firmware virtualization is manually enabled, verify `VirtualizationFirmwareEnabled=True`, WSL2, Docker engine and Compose; Docker binaries are already installed.
3. Restore image + volume + dirty workspace/ENV + Scheduled Task to target, run equivalence gates, then cut over with A55 retained as rollback.
