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
- Make recovery provable: target must pass restore/equivalence gates before source is disabled.

### State — FACTS

#### Canonical / anti-drift

- Canonical repository: `n0namer/free-coding-models`, branch `main`.
- Git/PLAN, Windows checkout, Docker image, live container, persistent volume and observed endpoint state are **separate identities**. Never infer one from another.
- Running image source commit is not proven.
- A55 local canonicalization checkout has an older PLAN and is not authority; GitHub `main/PLAN.md` is authority.

#### Source — `DESKTOP-A55K2JN`

- Windows 11 Pro.
- Active dirty workspace: `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models`.
- Workspace remote observed: `vava-nessa/free-coding-models`; HEAD observed `4e51bf9ce44456fd93814e7ca23333527d094b13`.
- Modified/untracked work exists in Docker/Compose/runtime/router files; migration must preserve the dirty workspace rather than rebuild from Git.
- `.env` and `.env.coolify-sync` exist. Never print secret values; verify/transfer by SHA-256 and key names only.
- Docker Desktop 4.81 / Docker CLI 29.6.1 are installed.
- FCM identity captured before the latest instability:
  - container `fcm`;
  - image `free-coding-models:local`;
  - image ID `sha256:8b235d5a102cd641b4e5fed4bd282222a08b217dbe9fa45672fbeeb5ba7eba7d`;
  - container ID `036059dcc829fac8379e5753e14ce6ec90afcc2a6eeb3adc0e469a35eb8d6652`;
  - restart `unless-stopped`;
  - network `free-coding-models_default`;
  - loopback bind `127.0.0.1:19280`;
  - named volume `free-coding-models_fcm-data -> /home/fcm`.
- Scheduled Task `FCM Managed Set Refresh` executes `docker.exe exec fcm node /app/bin/free-coding-models.js --daemon-status` every 4 hours.
- Redacted evidence exists under `D:\Users\NIKITA\Documents\DEV\.migration-to-49-20260911\fcm\`: container/image/volume inspect, task XML and endpoint snapshots from a brief green interval.
- Docker Desktop initially failed because effective `ProgramData` was absent. Launching with `ProgramData=C:\ProgramData` briefly restored engine `29.6.1 linux/amd64` and `fcm` reached healthy state.
- User-level `ProgramData=C:\ProgramData` was restored and environment-change broadcast was sent.
- A later Docker/WSL start became stuck: backend repeatedly reported engine/init ping timeouts and missing guest socket-forwarder endpoint.
- During that event A55 became unavailable through Desktop Commander and from another LAN host.
- **Latest availability evidence:** A55 may still be advertised as `online` by the connector, but direct Desktop Commander `ping` and command execution time out. From `DESKTOP-C439RQO`, hostname resolution/ping fail and TCP 22/445/3389/5985/8795 are unreachable. Therefore the host is **not operationally reachable**.
- No fresh CURRENT manifest or consistent migration snapshot was produced after this outage.

#### Target — `DESKTOP-49VP0KH`

- Exact hostname proven; DEV root `C:\Users\Рафик\Documents\DEV`.
- Windows 11 Pro; latest C: free-space readback: about **146.6 GB**; no D:.
- No pre-existing target FCM project/container/image/volume/task was discovered.
- Incoming FCM staging directory prepared: `C:\Users\Рафик\Documents\DEV\.migration-incoming-20260911\fcm`.
- Portable MinGit 2.55 is available under DEV tools for later HEAD/status verification.
- Docker Desktop is installed: version `4.81.0.232925`; Docker CLI `29.6.1`; Compose `v5.2.0`.
- Docker engine is not running.
- Port 19280 is free.
- Firmware virtualization remains `VirtualizationFirmwareEnabled=False`; SLAT/VM monitor flags are also false in current Windows readback.
- No WSL distribution is installed/usable; WSL2 cannot become operational until firmware virtualization / Virtual Machine Platform prerequisites are enabled.
- Current Remote Desktop Commander session is **not elevated administrator**, so Windows optional-feature changes cannot be safely completed through the current shell.

### Gap

1. Recover A55 to a stable, readable source state long enough to capture one atomic CURRENT manifest and consistent migration snapshot.
2. Enable target firmware virtualization; then prove WSL2/Docker engine readiness.
3. Transfer/restore exact image + volume + dirty workspace/ENV + host automation and prove target equivalence.

### ONE active constraint — CURRENT CYCLE

**A55 source-host availability/stability.** Until A55 responds to an actual command, do not create a guessed source snapshot or substitute Git/old VHDX.

**Next downstream gate:** target firmware virtualization / WSL2.

## Facts / assumptions / hypothesis

### Facts

- Target Docker binaries are already installed; installation is not the blocker.
- Target virtualization is disabled and the current shell is non-elevated.
- Source runtime contains state not proven equivalent to Git.
- Source became LAN-unreachable during Docker/WSL startup and is still not command-reachable.

### Assumptions to verify

- A55 source disk/container/volume remain intact after the host outage.
- Saved endpoint snapshots represent a genuine green interval but are supporting evidence only, not a replacement for fresh hashes.
- Consumers can remain on loopback after moving to the target host; if not, secure reachability must be handled separately.

### Working hypothesis

**If** A55 returns and we capture the source with one bounded, non-rebuilding snapshot pass, then enable target virtualization and restore exact image + volume + workspace/ENV + task, **then** target will reproduce source-current FCM behavior, **because** those four layers collectively own live code, durable state, credentials/config and lifecycle.

**Metric:** source/target hash equality + routing invariants + health/smoke/restart/task/consumer PASS.  
**Deadline:** within 72 hours after both source-capture and target-platform gates are green.

## Options

### A — targeted live-runtime migration — SELECTED

Transfer four owned layers separately:

1. live container writable layer → private migration image;
2. named volume → consistent stopped-container archive;
3. dirty workspace including `.git` + ENV/config;
4. Scheduled Task XML / host lifecycle evidence.

### B — clone/build from Git — REJECTED FOR MIGRATION

Would lose or misrepresent uncanonicalized live/dirty state. Use later only for canonicalization.

### C — whole Docker Desktop VHDX — EMERGENCY FALLBACK ONLY

Available A55 VHDX is not proven current for September FCM changes and carries unrelated Docker state.

## BMad / recovery operating principles

- Treat this as brownfield recovery/migration: inspect CURRENT callable/runtime surface before changing it.
- A backup is not accepted until a restore path is exercised and verified.
- Resolve Compose/config first, then verify actual container state, health, logs, mounts and published endpoint.
- Use the narrowest runtime operation possible; never use `down -v` or delete/recreate the source volume during migration.
- After every material mutation: verify → update state → re-plan from CURRENT evidence.
- No duplicate planning documents: this PLAN remains the SoT.

## Preserved runtime invariants — acceptance gates

Fresh source readback wins over historical values. If CURRENT differs, record the difference before cutover.

### `fast-coding`

Expected last-known-good baseline:

- 20 routes;
- `userCustomized=true`, `autoHeal=false`;
- priority #1 `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`;
- priority #2 `gonka/MiniMaxAI/MiniMax-M2.7`;
- full contour expected to remain traversable by failover.

Exact ratified order:

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
**Done:** A55 command-reachable; source identities/hashes/endpoints captured; image exported; final volume snapshot taken with `fcm` stopped; artifact SHA-256 recorded.  
**Risk:** repeated Docker/WSL startup destabilizes host.  
**First step <30 min:** when A55 responds, run one minimal host check. If Docker is already healthy, capture manifest/hashes immediately. If Docker is not healthy, do not loop restarts; recover host stability first.

### Critical 2 — target platform + restore

**Output:** green target `fcm`.  
**Done:** virtualization=True; WSL2 operational; Docker engine healthy; restore succeeds; hashes/invariants/health/smoke/restart PASS.  
**Risk:** firmware/Windows-feature change and reboot.  
**First step <30 min:** enable Intel virtualization (and VT-d if exposed) in BIOS/UEFI, reboot, then re-read virtualization and `wsl --status`; enable required Windows feature(s) from an elevated context if still missing.

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
- [x] Target checked for FCM collision — none found.
- [x] Target Docker Desktop/CLI/Compose present.
- [x] Target port 19280 free.
- [x] Target staging directory prepared.
- [x] Source container/image/volume/task identities captured historically.

### Source CURRENT

- [ ] A55 host is actually command-reachable, not merely connector-advertised online.
- [ ] Source Docker engine stable enough for a bounded snapshot pass.
- [ ] Source `fcm` state/health re-read.
- [ ] Fresh `/health`, `/sets`, `/v1/models`, `/api/models` captured.
- [ ] Fresh critical live code/config SHA-256 captured.
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
- [ ] Required WSL2 / Virtual Machine Platform prerequisites enabled from an elevated context.
- [ ] WSL2 operational.
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
- Connector says source online but direct ping/command times out → treat as unavailable.
- Target already gains an FCM instance before restore → inventory/backup first; never overwrite blindly.
- Hash mismatch → HALT restore for that artifact.
- Port 19280 becomes occupied → identify owner; do not change bind silently.
- Same-named target volume exists → backup/new timestamped volume first.
- Volume snapshot while `fcm` is writing → invalid final snapshot; stop `fcm` first.
- Task principal differs → adapt principal only; preserve action/cadence semantics.
- Provider APIs fail → local health/routing/log evidence distinguishes provider outage from migration failure.
- Consumer is remote → determine secure reachability separately; never broaden `127.0.0.1` to `0.0.0.0` automatically.

## Study

### Expected vs actual

- **Expected:** recover Docker on A55, capture source manifest, prepare bundle.
- **Actual:** first bounded recovery briefly succeeded; second Docker/WSL startup stalled and A55 became operationally unreachable.
- **Target actual:** Docker is already installed, but firmware virtualization remains disabled; current shell is non-elevated.
- **Variance:** source-host stability is worse than expected; repeated Docker restart is unsafe and target setup is closer to ready than initially believed.
- **Lesson:** source capture is the first gate; target restore follows only after exact source evidence exists.

## Act / current decision

**CHANGE COURSE:** source command-reachability remains the active constraint. Do not rebuild FCM from Git, do not use the old Docker VHDX as primary, and do not loop Docker restarts on A55.

On target, do not reinstall Docker. The remaining platform work is firmware virtualization + elevated Windows/WSL prerequisite completion + engine verification.

## Exact next 3 actions

1. When A55 actually responds to a command, immediately perform one short read-only host/Docker/FCM check. If engine is already healthy, capture manifest/hashes and create the migration bundle in one bounded batch; if not, stop and recover host stability before touching runtime again.
2. On target, enable firmware virtualization manually; after reboot, verify `VirtualizationFirmwareEnabled=True`, enable/verify WSL2 prerequisites from an elevated context, then start the already-installed Docker Desktop.
3. Restore image + volume + dirty workspace/ENV + Scheduled Task to target, run equivalence/restore tests, then cut over with A55 retained as rollback.
