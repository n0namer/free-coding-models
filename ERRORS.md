# ERRORS.md

Verified, reusable operational lessons for this repository. Keep entries evidence-backed and update them in place.

## 2026-09-07 — direct targeted router test can fail auth when it bypasses the package harness

- **Symptom**: A direct `node --test --test-name-pattern=... test/test.js` invocation returned `Wrong status 401` for a router test.
- **Cause**: The normal package test command imports `test/clear-client-auth-env.js`, which removes `FCM_CLIENT_TOKEN` from the test environment. Direct invocation bypassed that harness.
- **Fix**: Use the canonical `package.json` test command for router tests or preserve its equivalent auth-env setup.
- **Prevention**: Do not classify a 401 from a hand-crafted test invocation as a router regression until the canonical harness has been run.
- **Verification**: A fresh canonical `npm test` exited `0` after the direct invocation mismatch.

## 2026-09-07 — runtime config SoT is `/config/config.json`, not `/root/.free-coding-models.json`

- **Symptom**: Reading `/root/.free-coding-models.json` suggested empty/stale router sets and test-like timeout/retry values that disagreed with the running daemon.
- **Cause**: The running daemon loads `/config/config.json` in this deployment.
- **Fix**: Use `/api/router/status` and `/config/config.json` readback for CURRENT routing configuration.
- **Prevention**: Never add a safety fix or migration based on a file path until the running process/status endpoint proves that path is authoritative.
- **Verification**: CURRENT router status reports `configPath=/config/config.json`.

## 2026-09-07 — exact-source workspace failures are environment blockers, not FCM test failures

- **Symptom**: Earlier Coding Station repository-session creation failed twice with `Gateway Timeout` after older write attempts had returned `ENOSPC`. A later retry on the same day successfully created repo session `csrepo_abde2c4c97124b36aab85f71b146f796`, but subsequent session read/search/status operations again returned `Gateway Timeout`.
- **Cause**: Coding Station readiness is layered: health/readiness and even session creation can succeed while repository file-operation service remains degraded. Earlier storage pressure may be related, but the current evidence does not prove one single root cause.
- **Fix**: Treat each layer separately: check station health/readiness, create at most one repo session plus one evidence-based retry, then verify file read/search before mutation. If post-create file operations time out, stop rather than assuming the workspace is writable.
- **Prevention**: Do not label FCM or its tests red because the exact-source runner cannot complete workspace operations. Record this as an environment/validation blocker, keep live-runtime evidence separate, and never claim an exact-source candidate exists until repo file operations and readback succeed.
- **Verification**: The later session object was created successfully at base `5b5d0e8614a5a80b0dc3cd56175ba5fd17e018f6`, and file reads/writes later partially recovered enough to build an isolated candidate. Syntax and standalone dependency-free tests passed, but router integration could not start because repository dependencies were absent (`ERR_MODULE_NOT_FOUND: chalk`) and earlier install/test attempts had hit `ENOSPC`. Treat this as validation-environment failure until dependencies install and the exact-source suite actually runs.
