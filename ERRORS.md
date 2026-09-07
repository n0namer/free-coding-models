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

## 2026-09-07 — exact-source workspace failure is an environment blocker, not an FCM test failure

- **Symptom**: Coding Station repository-session creation failed twice with Gateway Timeout in the current execution. Earlier write attempts had returned `ENOSPC`.
- **Cause**: Current storage/session-service readiness is not proven; the station health endpoint can be green while repository-session creation is degraded.
- **Fix**: Inspect station health/readiness, attempt session creation once, and after an ambiguous timeout allow at most one identical retry.
- **Prevention**: Do not label FCM or its tests red because the exact-source runner could not start. Record this as an environment/validation blocker and keep already-verified live-runtime evidence separate.
