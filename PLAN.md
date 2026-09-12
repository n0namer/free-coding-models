# FCM Broker — Project Plan

**Status:** PARTIAL — transfer to `DESKTOP-49VP0KH` is complete; A55 live runtime now has verified bounded plain-text continuation recovery, but source canonicalization and target propagation are still pending  
**Last verified:** 2026-09-12  
**Target repository:** `n0namer/free-coding-models`  
**Canonical SoT:** this `PLAN.md` owns current state, decisions, DoD, anti-drift identities, migration evidence, rollback, and exact next move.

## North Star

Make `DESKTOP-49VP0KH` the active owner of the actual FCM runtime while preserving A55 rollback.

For the current cycle the user priority was **transfer FCM first**. That transfer is complete. Do not create another Docker data snapshot unless explicitly requested.

## Value → State → Gap → Constraint

### Value

- Move FCM off `DESKTOP-A55K2JN` without losing dirty workspace, ENV, Docker recovery state, routing evidence or host automation.
- Reuse the already copied Docker recovery snapshot instead of duplicating large artifacts.
- Preserve rollback.

### State — FACTS

#### Source `DESKTOP-A55K2JN`

- Workspace: `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models`.
- Remote: `https://github.com/vava-nessa/free-coding-models.git`.
- Branch: `main`.
- HEAD: `4e51bf9ce44456fd93814e7ca23333527d094b13`.
- Dirty/untracked state captured and preserved.
- Source hashes:
  - `.env`: `0044b753c9a091eaee23dcd559db7c13406e371e7bacccb28dece5041f19eac1`
  - `.env.coolify-sync`: `2c23424326786f05f514119ed5e7a5726b2fa73ee9931feada9db3c4379afc5a`
  - `docker-compose.yml`: `fcc39be57ef88298eb84aad5136b707f4fa72559e9bc4494b35e0ad55dd497c5`
  - `Dockerfile`: `de1f814e9955b9505f1e9910ddf7934b582c1b86f9e0e3641039b9d920906513`.
- Workspace archive:
  - `D:\Users\NIKITA\Documents\DEV\.migration-to-49-20260911\fcm\free-coding-models-workspace.tar.gz`
  - bytes `101207924`
  - SHA-256 `29a206ad9d3f47b6cb7c84d190894281f8ea61862f004341ded1c46328bb4ef5`.
- Source snapshot retained at `D:\docker-migration-snapshot-20260911\docker_data.vhdx`.
- Source snapshot bytes `1594884096`; SHA-256 `25e7dbf5dfe73c9d4c0bf82270b8f59fd7e56a349f4b7837e989599411a37282`.

#### Target `DESKTOP-49VP0KH` — TRANSFER COMPLETE

- Working FCM checkout: `C:\Users\Рафик\Documents\DEV\free-coding-models`.
- Target remote/branch/HEAD equal source.
- Target modified/untracked file set equals source.
- Target `.env`, `.env.coolify-sync`, Compose and Dockerfile hashes equal source.
- Workspace archive arrived byte-for-byte and hash-for-hash identical.
- Runtime evidence and automation copied to `C:\Users\Рафик\Documents\DEV\.migration-incoming-20260911\fcm`:
  - `container-inspect.json`
  - `image-inspect.json`
  - `volume-inspect.json`
  - `FCM-Managed-Set-Refresh.xml`
  - `health.json`
  - `sets.json`
  - `v1-models.json`
  - `api-models.json`
  - `free-coding-models-workspace.tar.gz`.
- No fresh VHD was created after user correction.
- Already copied Docker recovery snapshot was verified against A55 source snapshot:
  - original target location: `C:\DockerMigration\A55-20260911\docker_data.vhdx`
  - bytes `1594884096`
  - SHA-256 `25e7dbf5dfe73c9d4c0bf82270b8f59fd7e56a349f4b7837e989599411a37282`
  - exact hash match with A55 source snapshot.
- The same target VHD — not a duplicate — was moved into Docker's prepared WSL data layout:
  - `C:\DockerMigration\A55-20260911\DockerDesktopWSL\disk\docker_data.vhdx`
  - bytes and SHA-256 unchanged.
- Docker settings were created in both user settings locations with:
  - `CustomWslDistroDir=C:\DockerMigration\A55-20260911\DockerDesktopWSL`.
- The migrated source `settings-store.json` remains preserved in `C:\DockerMigration\A55-20260911\settings-store.json`.
- Temporary HTTP/TLS transfer artifacts were removed and the temporary source HTTP server was stopped.

### Gap

The **transfer gap is closed**.

Remaining work belongs to the next phase: target runtime activation and verification from the already transferred payload.

## BMad / anti-drift rules

- Do not generate another source VHD by default.
- Do not rebuild from Git as a substitute for migrated dirty/runtime state.
- Do not delete the A55 source snapshot or target migrated VHD.
- Do not use `docker down -v`, factory reset, unregister/delete Docker data, or blind volume overwrite.
- Current target evidence wins over historical assumptions.
- After every material activation mutation: verify → update this PLAN → re-plan.

## Preserved acceptance invariants for activation

### `fast-coding`

- expected 20 routes
- `userCustomized=true`, `autoHeal=false`
- #1 `gonka/deepseek-ai/DeepSeek-V4-Flash-0731`
- #2 `gonka/MiniMaxAI/MiniMax-M2.7`.

### Outreach

- canonical `fcm:outreach-quality`
- expected 116 credentialed routes
- Gonka DeepSeek/MiniMax #1/#2
- expected `maxRetries=115`
- `outreach-judge` alias mirrors the same pool.

## Current DoD

### Transfer — COMPLETE

- [x] Existing Docker recovery VHD located on target.
- [x] Target VHD hash equals source snapshot hash.
- [x] No fresh VHD created/transferred after user correction.
- [x] Existing target VHD moved into prepared Docker WSL data path without duplication.
- [x] Docker `CustomWslDistroDir` adapted to target path.
- [x] FCM workspace archive created and transferred.
- [x] Workspace archive target SHA-256 equals source SHA-256.
- [x] Workspace extracted to target DEV root.
- [x] Target HEAD/branch/remote/dirty state match source.
- [x] `.env` and `.env.coolify-sync` transferred; hashes match source; values were never printed.
- [x] Task XML and redacted runtime evidence transferred.
- [x] Temporary transport stopped/removed.
- [x] A55 source snapshot/workspace retained as rollback.

### Activation / verification — NEXT PHASE

- [ ] Start target Docker against the migrated WSL data path.
- [ ] Inventory for `fcm`, `free-coding-models:local`, and `free-coding-models_fcm-data` before any recreate.
- [ ] Confirm loopback `127.0.0.1:19280`.
- [ ] Verify `/health`, `/sets`, `/v1/models`, `/api/models`.
- [ ] Verify `fast-coding` and outreach invariants.
- [ ] Reconcile critical live code/config hashes with transferred workspace only if required.
- [ ] Restart persistence PASS.
- [ ] Import/adjust Scheduled Task and verify manual `LastTaskResult=0`.
- [ ] Real consumer smoke PASS.

## Rollback

- A55 source workspace and source snapshot remain intact.
- Target migrated VHD remains the selected restore payload.
- If target activation fails, revert only target-side activation changes and retry from the same migrated payload; do not create a new source VHD unless explicitly requested.

## Exact next move

The migration itself is done. When activation is continued, work only on `DESKTOP-49VP0KH` from the already transferred workspace and Docker VHD. Do not return to source snapshot generation unless the user explicitly changes course.