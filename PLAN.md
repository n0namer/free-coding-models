# FCM Broker — Project Plan

**Status:** In Progress — long-running stream and failover hardening  
**Last verified:** 2026-09-03  
**Target repository:** `n0namer/free-coding-models`  
**Canonical project SoT:** this `PLAN.md` for project stage, decisions, gates, DoD, and next move. Detailed product/router requirements remain in `tasks/PRD-smart-model-router.md`; do not duplicate that PRD here.

## North Star

FCM Broker must be a generic, reusable, OpenAI-compatible LLM broker that keeps clients working through provider 400/429/5xx/timeout/stream failures without corrupting plain-text, tool-call, or structured-output semantics.

## Scope

- **Target:** FCM Broker / `free-coding-models` only.
- **Non-target:** SWE-AF, PR-AF, Universal Solver, OpenClaw, OpenCode, and future consumers. They may be used only as black-box canary/evidence sources.
- Do not modify consumer code/config in this project.
- Do not use GitHub-first edit→redeploy as a debugging primitive. Development/debug patches are applied and validated directly in the existing Coding Station runtime/workspace first; accepted deltas are canonicalized to Git afterwards.

## Current Facts (CURRENT evidence)

- GitHub default `main` baseline: `4e51bf9ce44456fd93814e7ca23333527d094b13`.
- Current implementation branch: `fix/fcm-long-stream-lifecycle`.
- Current implementation branch head after canonicalizing the verified runtime-code + focused regression delta: `389f03b14e2d856074212c169b247152ec1faad8`.
- Draft PR #3 remains open and unmerged.
- Coding Station exact-source session `csrepo_eaf4449cf2864348b6a7b1d0bf2c1e13` was created from `f889553f2a80141b8126cbe717123d0e3d75247a` and used for direct workspace edits/validation.
- On that tested workspace: targeted stream lifecycle regressions PASS `6/6`; canonical `pnpm test` PASS `819/819`; `node --check src/core/router-daemon.js` PASS.
- The tested workspace includes an uncommitted legacy-regression update in `test/test.js`; Coding Station publication is blocked because `free-coding-models` has no publication metadata/GitHub App credential in Station. Runtime code and `test/router-stream-lifecycle.test.js` have been canonicalized to PR #3; `test/test.js` write-back is still pending.
- Canonical DEV runtime is now identified directly as container `krhkfc6xjtreidxxbf8xdia3-064735014541`, image `krhkfc6xjtreidxxbf8xdia3:cd64d76cb6e9c7ede9c7ce556b786e8732a4a81e`, Docker IP `172.16.1.26`, port `19280`, healthy with restart count `0`; it is exactly the address resolved by `fcm-dev-internal`.
- Live FCM reports version `0.5.81`, `activeSet=keyless-dev`. Live `/app/src/core/router-daemon.js` SHA-256 is `9ee3681465c7c1be3658724c2c40e86da0aae9d3a85adfc762fb0f02d99efb1a`, while the accepted DEV Git source `574f300458249252a5616406184c7ef3395e4f3f` has router SHA-256 `4e28bb25880a5185a41a24b00123f2259703bebb2cd664500d2c647fb86b0180`; therefore exact live source != recorded accepted Git source.
- Direct readback of the live router confirms pre-hardening behavior: priority is compared before circuit state, and streaming still performs client-visible partial-stream splicing/failover. This differs from the tested hardening source.
- Recent live attempt log contains repeated `429` from `kilo/kilo-auto/free`; this is provider instability evidence, not proof that the broker daemon is down.
- Root `ERRORS.md` is absent. `AGENTS.md` requires `pnpm test` and runtime verification before completion.

## Phase Goal

Close the long-running stream/failover hardening gate with exact-source evidence, then verify the same behavior in the live FCM runtime.

## Accepted Design Decisions

1. **Circuit state before static priority across states.** Known-good `CLOSED` routes must be attempted before `HALF_OPEN` recovery probes. User priority remains authoritative within the same state.
2. **Pre-client-byte failover remains transparent.**
3. **Structured/tool streams are atomic.** Buffer upstream SSE until a terminal marker; discard a failed/truncated attempt and retry another eligible model before any client-visible bytes.
4. **Plain-text streams stay low latency.** After bytes are client-visible, do not splice a different model into the same SSE response.
5. A stream is successful only after `[DONE]` or non-null `finish_reason`, not merely HTTP 200/first byte.
6. Telemetry must preserve `stream_outcome` and full `duration_ms` without persisting prompt/response bodies.
7. Atomic buffering is bounded; current branch design uses a 16 MiB cap and degrades to direct streaming after that cap.

## Current Gate / Definition of Done

The hardening incident is not DONE until all are true:

- targeted router lifecycle regressions PASS on the exact intended source;
- canonical `pnpm test` PASS on that same source;
- git diff contains only owned FCM changes;
- source identity used for validation is recorded;
- deployed/live identity is proven to correspond to the accepted tested source or an exact equivalent live patch;
- live canary demonstrates:
  - healthy `CLOSED` routes are preferred over `HALF_OPEN` probes;
  - 429/5xx/timeout before client-visible bytes fails over;
  - structured/tool stream truncation does not leak partial upstream state;
  - terminal completed stream reaches client cleanly;
- bounded runtime logs show no unresolved broker-local error for the canary.

## 30-Minute Batch Policy

Each batch should optimize for 80/20 information gain and end with fresh evidence.

### Active Batch

1. Source validation is green: targeted `6/6`, canonical `819/819`, syntax PASS on the tested Coding Station workspace.
2. Canonicalize the verified runtime-code/focused-regression delta to PR #3; keep the remaining `test/test.js` publication gap explicit instead of hiding drift.
3. Identify the actual live FCM runtime behind the existing `fcm-private-dev` proxy using read-only target discovery.
4. Apply the minimal hardened runtime delta directly to the live FCM target only after exact target/source identity is proven.
5. Run bounded live canaries for CLOSED-before-HALF_OPEN routing, pre-client-byte failover, atomic structured-stream retry, and terminal-marker completion.
6. Update this SoT from runtime readback; stop the batch after the live acceptance gate or a precise blocker.

## Anti-Drift Contract

Track three identities separately:

- **Design / SoT:** `PLAN.md` + detailed router PRD.
- **Tested source:** exact commit/workspace SHA plus local diff if uncommitted.
- **Live runtime:** actual version/source/container/process identity from runtime readback.

Never infer one from another.  
If tested source != live runtime, status is `DESIGN_RUNTIME_DRIFT` until reconciled.  
If direct live patching is used, record base identity + exact delta + validation evidence, then canonicalize the accepted delta to Git after the runtime gate is green.

## Current Stop Point

Source validation is complete on the exact Coding Station workspace: targeted stream lifecycle `6/6` PASS, canonical `819/819` PASS, syntax PASS. Runtime code and the focused lifecycle regression file are canonicalized to PR #3 at `389f03b14e2d856074212c169b247152ec1faad8`; the large legacy `test/test.js` compatibility update is still local to the tested workspace because Station publication credentials are unavailable for this repository. Live `0.5.81` remains `DESIGN_RUNTIME_DRIFT` until the actual FCM target is identified and patched/verified.

## Next Move

Identify the actual live FCM process/source behind `fcm-private-dev`, prove its base identity, then apply only the already-tested hardened runtime delta directly to that FCM target. Follow with bounded live canaries and runtime-log readback before any merge/release decision.
