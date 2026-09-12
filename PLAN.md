# FCM Broker — Project Plan

**Status:** In Progress — controlled host/runtime migration `DESKTOP-A55K2JN` → `DESKTOP-49VP0KH`  
**Last verified:** 2026-09-12  
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

- Windows 11 Pro; source is currently command-reachable again through Remote Desktop Commander.
- LAN identity currently observed: Wi-Fi `172.20.20.187/…`; target name resolves from A55 to `172.20.20.254`.
- Active dirty workspace: `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models`.
- Workspace remote: `vava-nessa/free-coding-models`; branch `main`; HEAD `4e51bf9ce44456fd93814e7ca23333527d094b13`.
- CURRENT dirty state re-read 2026-09-12: modified `Dockerfile`, `docker-compose.yml`, `scripts/docker-init.mjs`, `sources.js`, `src/core/config.js`, `src/core/ping.js`, `src/core/router-daemon.js`, `test/test.js`; untracked `FCM_CONNECTION.md`, `body.json`, `bodys.json`, `run-build.cmd`, `sync-fcm-coolify.ps1`.
- Secret-bearing files exist and were hashed without printing values:
  - `.env` SHA-256 `0044b753c9a091eaee23dcd559db7c13406e371e7bacccb28dece5041f19eac1`, 3183 bytes;
  - `.env.coolify-sync` SHA-256 `2c23424326786f05f514119ed5e7a5726b2fa73ee9931feada9db3c4379afc5a`, 1540 bytes.
- Compose/Docker identity hashes:
  - `docker-compose.yml` SHA-256 `fcc39be57ef88298eb84aad5136b707f4fa72559e9bc4494b35e0ad55dd497c5`;
  - `Dockerfile` SHA-256 `de1f814e9955b9505f1e9910ddf7934b582c1b86f9e0e3641039b9d920906513`.
- Docker Desktop 4.81 / Docker CLI 29.6.1 installed.
- Historical FCM identity before current Docker failure:
  - container `fcm`, ID `036059dcc829fac8379e5753e14ce6ec90afcc2a6eeb3adc0e469a35eb8d6652`;
  - image `free-coding-models:local`, image ID `sha256:8b235d5a102cd641b4e5fed4bd282222a08b217dbe9fa45672fbeeb5ba7eba7d`;
  - restart `unless-stopped`;
  - network `free-coding-models_default`;
  - loopback bind `127.0.0.1:19280`;
  - named volume `free-coding-models_fcm-data -> /home/fcm`.
- Scheduled Task `FCM Managed Set Refresh` runs `docker.exe exec fcm node /app/bin/free-coding-models.js --daemon-status` every 4 hours.
- Redacted evidence under `D:\Users\NIKITA\Documents\DEV\.migration-to-49-20260911\fcm\` includes container/image/volume inspect, task XML and endpoint snapshots from a brief green interval.

#### Source Docker failure boundary — CURRENT

- Docker Desktop Windows backend and WSL infrastructure are alive, but Linux Docker engine is not.
- WSL version `2.2.4.0`, kernel `5.15.153.1-2`; Docker requires >=2.1.5 but recommends latest.
- `docker-desktop` distro is Running and executable; `wsl -d docker-desktop -u root -- ...` succeeds.
- `vpnkit-bridge` runs inside the distro, but `/run/guest-services` is empty.
- Backend logs have waited for init control API for >11 hours and repeat:
  - `GET /ping: context deadline exceeded`;
  - `/run/guest-services/socketforwarder-receive-fds.sock: does not exist yet`.
- Built-in `docker desktop diagnose` also blocks against the dead control-plane and produces no result; it was terminated without touching backend/WSL.
- `com.docker.service` is `Stopped/Disabled`, while `hns`, `vmcompute`, `vmms`, and `WSLService` are Running. Do **not** infer `com.docker.service` is the cause: the observed Docker configuration previously had `RunWinServiceInWslMode=false`.
- No relevant HCS/Hyper-V/WSL/VHD disk errors were found in Windows System/Application error/warning events for the failure interval.
- Docker data root is deliberately relocated to D via `CustomWslDistroDir=D:\Users\NIKITA\AppData\Local\Docker\wsl\DockerDesktopWSL`.
- Current VHDs:
  - `...\disk\docker_data.vhdx` ≈23.939 GB, last write observed 2026-09-11 23:11;
  - `...\main\ext4.vhdx` ≈0.102 GB.
- WSL sees the data VHD as `/dev/sdc`, 1T ext4, UUID `f479bee8-68b6-416e-8eeb-7ec5d64020b2`.
- Kernel log shows successful ext4 mount events for `/dev/sdc`; no ext4/I/O/buffer errors observed.
- Therefore the data VHD is **present, attached and kernel-mountable**. Failure is downstream of disk attach/mount: `wsl-bootstrap`/LinuxKit/guest-services never reaches a usable engine state.
- Current `wsl-bootstrap` process is absent while `vpnkit-bridge` remains; `/run/guest-services` never gets the expected socket.
- Source disk pressure is high: C: ~7.6 GB free, D: ~6.5 GB free. Do not create a second 24-GB VHD locally.
- Existing `D:\docker-migration-snapshot-20260911\docker_data.vhdx` is emergency-only; its underlying timestamp predates later FCM live changes and it is not accepted as CURRENT.

#### Target — `DESKTOP-49VP0KH`

- DEV root `C:\Users\Рафик\Documents\DEV`; incoming staging `...\.migration-incoming-20260911\fcm` exists.
- Latest C: free-space readback ~146.6 GB; no D:.
- Target is on the same LAN and resolves from A55 as `172.20.20.254`.
- No target FCM collision discovered; port 19280 free.
- Docker Desktop `4.81.0.232925`, Docker CLI `29.6.1`, Compose `v5.2.0` installed.
- Target WSL is much newer: `2.7.13.0`, kernel `6.18.33.2-2`.
- Firmware virtualization remains `VirtualizationFirmwareEnabled=False`; Docker engine therefore cannot run yet.
- Current Remote Desktop Commander target shell is not elevated; BitLocker/Secure Boot status could not be read from it.
- Portable MinGit 2.55 available for later source/target Git-state verification.
- Target TCP 445/5985 are reachable from A55, but current A55 credentials cannot access target `C$`; no insecure credential bypass is permitted.
- Python and OpenSSL are available on both hosts, so a one-shot TLS stream can be used for large sensitive recovery artifacts without public cloud or plaintext LAN transfer.

### Gap

1. Create a **fresh protected recovery point** for the current Docker data VHD without needing 24 GB free on A55.
2. Perform one controlled Docker/WSL reset of process state, not data, and test whether bootstrap/guest-services recover.
3. Once engine is green, capture fresh FCM runtime hashes/routes and create normal image + named-volume migration artifacts.
4. Enable target firmware virtualization and restore/verify target.

### ONE active constraint — CURRENT CYCLE

**Source Docker WSL bootstrap is stuck after successful data-disk attach/mount.** The source host and VHD are alive; engine/FCM are not. Before any recovery mutation, protect the current VHD to target storage.

**Next downstream gate:** target BIOS virtualization / WSL2 Docker engine.

## Facts / assumptions / hypothesis

### Facts

- Data VHD is present and kernel-mountable; no observed ext4/I/O corruption signal.
- Docker userspace bootstrap/guest-services is the current failure boundary.
- Source WSL 2.2.4 meets Docker minimum but is older than current recommended/latest.
- Target has ample storage and secure-stream tooling but cannot run Docker until virtualization is enabled.

### Assumptions to verify

- A clean Docker Desktop/`docker-desktop` WSL process reset will recreate guest-services without modifying the VHD contents materially.
- Consumers can remain on loopback after moving to the target; if not, secure reachability must be handled separately.
- The source VHD remains stable once Docker/WSL is fully stopped and detached.

### Working hypothesis

**If** we first protect the detached CURRENT data VHD to the target, then perform one clean Docker Desktop/WSL process-state restart with no reset/unregister/delete, **then** guest-services may recover and expose the existing FCM runtime, **because** disk attachment/ext4 are healthy and the observed failure is downstream bootstrap state; **metric** = Docker server `_ping`/`version` PASS, `fcm` visible, endpoint/runtime invariants readable; **deadline** = this recovery cycle before any WSL update or Docker factory action.

## Options

### A — protected clean process-state restart — SELECTED NEXT

1. Stop Docker Desktop cleanly if possible.
2. Terminate/shutdown only Docker WSL state so VHD is detached.
3. Stream-copy the fresh VHD over authenticated/pinned TLS to target; record source/target SHA-256.
4. Restart Docker Desktop once with correct effective environment.
5. Verify engine before touching FCM.

Why selected: smallest reversible move with a fresh recovery point.

### B — update source WSL, then restart — SECOND

Docker recommends current WSL and source is 2.2.4 while target is 2.7.13. This is plausible remediation, but it changes the source platform. Only attempt after VHD protection and only if Option A fails.

### C — Docker reset/reinstall/VHD replacement — REJECTED / EMERGENCY ONLY

Factory reset, unregister, delete/recreate VHD, old-VHD substitution, `down -v`, or destructive cleanup are prohibited while CURRENT state is recoverable.

## Cartesian critique

- **Do A:** protects current data first and tests the narrowest stale-process hypothesis.
- **Do not A:** leaves FCM down and eventually forces a broader recovery with weaker evidence.
- **A avoids:** changing WSL version or rebuilding Docker data before having a fresh rollback artifact.
- **Not doing A avoids:** one controlled stop/start, but the engine has already been unusable >11h, so there is no working runtime to preserve in-place.

## Preserved runtime invariants — acceptance gates

Fresh source readback wins over historical values. If CURRENT differs, record it before cutover.

### `fast-coding`

Expected last-known-good baseline:

- 20 routes;
- `userCustomized=true`, `autoHeal=false`;
- #1 `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`;
- #2 `gonka/MiniMaxAI/MiniMax-M2.7`;
- `router.failover.maxRetries=19`.

### Outreach

Expected last-known-good baseline:

- canonical model `fcm:outreach-quality`;
- 116 credentialed routes;
- Gonka DeepSeek / MiniMax fixed #1/#2 and raced for non-streaming requests;
- `router.failover.maxRetries=115`;
- validation ceiling 500;
- `outreach-judge` compatibility alias mirrors the same pool.

## Live patch identities to preserve

Historical hashes are evidence, not a substitute for fresh CURRENT hashes:

- `/app/src/core/router-daemon.js` race-patched SHA-256 `55bc63a719e288f54a279bb451ec3f72fd099c9f01a339833cd2981eb5c1e9e3`.
- Earlier named-model-routing hash `156642e1810ef06a154a2141cef618f978d4607a31e7504f06dbb1e3e418d73a`.
- `/app/src/core/config.js` retry-ceiling backup `/home/fcm/config.js.bak-max-retries-20260909`.
- Persistence/sync-set/CLI live deltas must be freshly hashed after engine recovery.

## 48–72 h Test

### Critical 1 — protect + recover source

**Output:** fresh VHD recovery copy plus green source Docker engine.  
**Done:** Docker/WSL stopped cleanly; VHD detached; TLS-streamed source→target copy SHA-256 equal; one clean start yields Docker server response and `fcm` inventory.  
**Deadline:** current recovery cycle.  
**Risk:** process reset fails to recover bootstrap; mitigated by pre-reset VHD copy and no destructive operations.  
**First step <30 min:** establish one-shot TLS receiver on target, stop/detach Docker WSL, hash and stream `docker_data.vhdx`.

### Critical 2 — runtime migration + target restore

**Output:** green target `fcm`.  
**Done:** source CURRENT manifest/image/volume/workspace/task captured; target virtualization/WSL/Docker green; restore hashes/invariants/health/smoke/restart/task PASS.  
**Deadline:** within 72h after source engine and target platform gates are green.  
**Risk:** firmware change/reboot and provider availability.  
**First step <30 min:** after source capture, enable Intel virtualization/VT-d on target BIOS and re-read platform gates.

### Support 1 — workspace / ENV

Preserve `.git`, dirty/untracked work, `.env`, `.env.coolify-sync`, Compose/Docker files and operational scripts; hash secret-bearing files and never print values.

### Support 2 — automation

Import source task XML only after target FCM is green. Adapt only target-specific principal/path if necessary. Manual run must return `LastTaskResult=0` without mutating membership.

### Support 3 — observation / rollback

Keep A55 image/container/volume/workspace and protected VHD copy for ≥48h after cutover. No automatic cleanup/decommission.

## Migration DoD / anti-drift checklist

### Source identity / protection

- [x] Source/target hostnames and LAN addresses resolved.
- [x] Source dirty workspace HEAD/status captured CURRENT.
- [x] `.env` / `.env.coolify-sync` hashes captured without values.
- [x] Current Docker data-root path and VHD identity located.
- [x] Data VHD visible inside WSL as ext4 with no observed I/O/ext4 error.
- [ ] Docker Desktop/WSL stopped and CURRENT data VHD detached.
- [ ] Fresh VHD copied to target over one-shot TLS.
- [ ] Source/target VHD SHA-256 equal.

### Source engine / FCM CURRENT

- [ ] One clean Docker start after protected recovery point.
- [ ] Docker server Linux/amd64 responds.
- [ ] Source `fcm` state/health re-read.
- [ ] Fresh `/health`, `/sets`, `/v1/models`, `/api/models` captured.
- [ ] Fresh critical live code/config SHA-256 captured.

### Migration bundle

- [ ] Commit actual live container to private migration image.
- [ ] `docker image save` + SHA-256.
- [ ] Stop only `fcm` for final consistent named-volume snapshot.
- [ ] Named volume archive + SHA-256.
- [ ] Workspace/ENV archive + SHA-256.
- [ ] Task XML + redacted manifest included.
- [ ] No secret values printed or committed to GitHub.

### Target platform

- [x] Docker Desktop/CLI/Compose installed.
- [x] Target staging and storage available.
- [ ] Firmware virtualization enabled.
- [ ] WSL2/Docker engine operational.
- [ ] Compose resolves source-equivalent config.

### Restore / verification

- [ ] Transfer hashes equal source ↔ target.
- [ ] Workspace dirty state matches source intent.
- [ ] Volume restored without destroying pre-existing target state.
- [ ] `fcm` uses equivalent mount/network/restart/loopback bind.
- [ ] Critical live code/config hashes equal.
- [ ] `fast-coding` count/order/Gonka #1/#2/maxRetries match.
- [ ] `outreach-quality` count/order/Gonka #1/#2/maxRetries match.
- [ ] `/health`, `/sets`, `/v1/models` PASS.
- [ ] OpenAI-compatible `fcm:outreach-quality` smoke PASS or provider outage is cleanly distinguished.
- [ ] `docker restart fcm` persistence PASS.
- [ ] Scheduled Task manual run `LastTaskResult=0`.
- [ ] Real consumer reachability PASS.

### Cutover / rollback

- [ ] Only after target green: stop source FCM and disable source task.
- [ ] Never delete source container/image/volume/workspace during observation.
- [ ] Rollback exercised or mechanically proven.
- [ ] A55 retained ≥48h.

## Edge-case guards

- Source engine unhealthy → do not infer runtime from Git or historical snapshots.
- VHD copy while attached/mutating → invalid recovery point; detach first.
- TLS/hash mismatch → HALT before recovery mutation.
- Target gains an FCM instance before restore → inventory/backup first.
- Port 19280 occupied → identify owner; never silently rebind.
- Same-named target volume exists → backup/new timestamped volume first.
- Provider APIs fail → distinguish external outage from local runtime via local health/routes/logs.
- Consumer is remote → handle secure reachability separately; never auto-change `127.0.0.1` to `0.0.0.0`.
- Do not factory-reset Docker, unregister `docker-desktop`, delete/compact VHD, `down -v`, or overwrite ENV secrets.

## Study

### Expected vs actual

- Expected: source engine recovery → manifest → migration.
- Actual: WSL VM/data disk are healthy enough to attach/mount, but Docker bootstrap has remained stuck >11h and never creates guest-services sockets.
- Variance: failure is narrower than a dead host or corrupt VHD and broader than an FCM-container failure.
- Evidence: WSL shell works, `/dev/sdc` ext4 mounts without kernel errors, Windows virtualization services are green, Docker engine init IPC never becomes responsive.
- Lesson: protect the data disk first, then reset process state; do not jump to Git rebuild, WSL upgrade, or factory reset.

## Act / current decision

**SELECTED:** protected clean process-state restart. Create a fresh target-side VHD recovery copy first; then one controlled Docker/WSL stop/start. If that fails, evaluate source WSL update as the next bounded hypothesis.

## Exact next 3 actions

1. Establish one-shot TLS receiver on target; stop Docker Desktop/`docker-desktop` WSL cleanly; verify VHD detached; stream-copy and hash-verify the CURRENT `docker_data.vhdx` to target.
2. Start Docker Desktop once with correct effective `ProgramData`; require server `_ping/version` before doing anything with `fcm`. If still stuck, do not loop restart — evaluate WSL update using the protected VHD rollback point.
3. Once source engine is green, immediately capture FCM CURRENT hashes/routes/endpoints, build normal image+volume+workspace migration bundle, then move to the target BIOS/restore gate.
