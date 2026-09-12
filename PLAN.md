# FCM Broker — Project Plan

**Status:** In Progress — FCM payload transferred to `DESKTOP-49VP0KH`; activation/restore remains  
**Last verified:** 2026-09-12  
**Target repository:** `n0namer/free-coding-models`  
**Canonical SoT:** this `PLAN.md` owns current state, decisions, DoD, anti-drift identities, migration evidence, rollback, and exact next move.

## North Star

Make `DESKTOP-49VP0KH` the active owner of the actual FCM runtime while preserving the A55 source as rollback until target activation is proven.

The immediate priority is **FCM transfer and restore**, not further investigation of firmware/BIOS unless it becomes strictly necessary to run Docker on the target.

## Value → State → Gap → Constraint

### Value

- Move FCM off `DESKTOP-A55K2JN` without losing dirty workspace, ENV, routing state, Docker state or host automation.
- Reuse already transferred recovery artifacts instead of creating duplicate multi-GB snapshots.
- Preserve rollback.

### State — FACTS

#### Source `DESKTOP-A55K2JN`

- Active workspace: `D:\Users\NIKITA\Documents\ChatGPT\AGENTS\free-coding-models`.
- Remote: `https://github.com/vava-nessa/free-coding-models.git`.
- Branch: `main`.
- HEAD: `4e51bf9ce44456fd93814e7ca23333527d094b13`.
- Dirty/untracked state captured and preserved.
- Source workspace hashes:
  - `.env`: `0044b753c9a091eaee23dcd559db7c13406e371e7bacccb28dece5041f19eac1`
  - `.env.coolify-sync`: `2c23424326786f05f514119ed5e7a5726b2fa73ee9931feada9db3c4379afc5a`
  - `docker-compose.yml`: `fcc39be57ef88298eb84aad5136b707f4fa72559e9bc4494b35e0ad55dd497c5`
  - `Dockerfile`: `de1f814e9955b9505f1e9910ddf7934b582c1b86f9e0e3641039b9d920906513`
- Workspace archive created excluding reconstructable caches/node_modules:
  - source path: `D:\Users\NIKITA\Documents\DEV\.migration-to-49-20260911\fcm\free-coding-models-workspace.tar.gz`
  - bytes: `101207924`
  - SHA-256: `29a206ad9d3f47b6cb7c84d190894281f8ea61862f004341ded1c46328bb4ef5`.
- Historical FCM runtime identity before Docker instability:
  - container `fcm`
  - image `free-coding-models:local`
  - loopback bind `127.0.0.1:19280`
  - named volume `free-coding-models_fcm-data -> /home/fcm`
  - restart `unless-stopped`.
- Docker Desktop engine on A55 is currently stuck in WSL bootstrap/userspace; no new Docker snapshot is required for this migration cycle.

#### Already copied Docker recovery snapshot — ACCEPTED MIGRATION PAYLOAD

Per user direction, **do not create or transfer a fresh Docker data VHD**.

Use the snapshot already copied to the target:

- target path: `C:\DockerMigration\A55-20260911\docker_data.vhdx`
- source snapshot path: `D:\docker-migration-snapshot-20260911\docker_data.vhdx`
- bytes both sides: `1594884096`
- SHA-256 both sides: `25e7dbf5dfe73c9d4c0bf82270b8f59fd7e56a349f4b7837e989599411a37282`
- target `settings-store.json` SHA-256: `bc841bedd29ec0d6e98a4b054db557d547dff8d9baace48bdcd15df6bfc498ae`.

This snapshot is the accepted Docker recovery payload for the current migration. It is **not** treated as proof of the latest live September runtime; current target restore verification must decide whether it is sufficient.

#### Target `DESKTOP-49VP0KH`

- DEV root: `C:\Users\Рафик\Documents\DEV`.
- Docker Desktop already installed; Docker CLI/Compose present.
- FCM workspace has now been transferred and extracted to:
  - `C:\Users\Рафик\Documents\DEV\free-coding-models`
- Target workspace verification matches A55:
  - remote `https://github.com/vava-nessa/free-coding-models.git`
  - branch `main`
  - HEAD `4e51bf9ce44456fd93814e7ca23333527d094b13`
  - modified/untracked file set matches source
  - `.env`, `.env.coolify-sync`, Compose and Dockerfile hashes equal source.
- Migration staging contains copied evidence and automation:
  - `container-inspect.json`
  - `image-inspect.json`
  - `volume-inspect.json`
  - `FCM-Managed-Set-Refresh.xml`
  - `health.json`
  - `sets.json`
  - `v1-models.json`
  - `api-models.json`
  - `free-coding-models-workspace.tar.gz`.
- Temporary TLS transport artifacts were removed after transfer.

### Gap

1. Restore/attach the accepted Docker recovery payload on target without deleting it.
2. Start target Docker and determine whether the accepted snapshot contains the required FCM image/container/volume state.
3. If FCM state is present, restore/launch `fcm`, apply source-equivalent workspace/config as needed, then verify routing invariants and endpoints.
4. Import host automation only after FCM is green.

### ONE active constraint — CURRENT CYCLE

**Target restore/activation of the already transferred FCM payload.**

Do not spend the cycle creating another source VHD or repeating source Docker recovery work unless restore evidence proves the accepted snapshot is insufficient.

## BMad / anti-drift rules

- Current target evidence wins over historical assumptions.
- Do not create duplicate planning documents.
- Do not rebuild from Git as a substitute for migrated dirty/runtime state.
- Do not delete source or target recovery VHDs.
- Do not use `docker down -v`, factory reset, unregister/delete Docker data, or overwrite a volume before an existing-state inventory.
- After every material restore mutation: verify → update this PLAN → re-plan.

## Preserved acceptance invariants

Fresh target restore readback wins; historical baseline remains the acceptance reference.

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
- `outreach-judge` compatibility alias mirrors the same pool.

## Current DoD

### Transfer — COMPLETE

- [x] Existing Docker recovery VHD located on target.
- [x] Existing target VHD hash equals source snapshot hash.
- [x] No fresh VHD created/transferred after user correction.
- [x] FCM workspace archive created and transferred.
- [x] Workspace archive target SHA-256 equals source SHA-256.
- [x] Workspace extracted to target DEV root.
- [x] Target HEAD/branch/remote/dirty state match source.
- [x] `.env` and `.env.coolify-sync` transferred; hashes match source; values not printed.
- [x] Task XML and redacted runtime evidence transferred.
- [x] Temporary transfer listener stopped and temporary TLS files removed.

### Restore / activation — NEXT

- [ ] Inventory accepted target Docker VHD/settings without destructive mutation.
- [ ] Make target Docker use/restore accepted recovery state.
- [ ] Confirm `fcm` container/image/volume exist or restore equivalent state.
- [ ] Confirm loopback `127.0.0.1:19280`.
- [ ] Verify `/health`, `/sets`, `/v1/models`, `/api/models`.
- [ ] Verify `fast-coding` and outreach invariants.
- [ ] Verify critical live code/config hashes or intentionally reconcile them with transferred workspace.
- [ ] Restart persistence PASS.
- [ ] Import/adjust Scheduled Task and manual run returns `LastTaskResult=0`.
- [ ] Real consumer smoke PASS.

## Rollback

- Keep A55 source workspace and Docker state untouched.
- Keep `C:\DockerMigration\A55-20260911\docker_data.vhdx` unchanged until target runtime is green.
- If target restore fails, revert target-only changes and continue from the accepted snapshot; do not regenerate source VHD by default.

## Exact next move

1. Work only on `DESKTOP-49VP0KH`.
2. Inventory target Docker configuration and the accepted `C:\DockerMigration\A55-20260911` payload.
3. Restore/activate that payload using the narrowest non-destructive method available.
4. Immediately inspect for `fcm`, `free-coding-models:local`, and `free-coding-models_fcm-data`.
5. If present, start FCM and run endpoint/invariant verification.
6. If absent, use the transferred workspace/ENV plus available snapshot evidence to reconstruct only the missing layer; do not return to fresh-VHD copying unless the user explicitly changes course.