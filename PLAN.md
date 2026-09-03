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
- Live FCM reports version `0.5.81`, `activeSet=keyless-dev`; its hardened-source identity is still unproven.
- Live routing order still places several `HALF_OPEN` llm7 routes before `CLOSED` Kilo routes. This differs from the branch fix that makes circuit health state outrank static priority, so the live runtime has not yet been proven to run the hardened source.
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

Work is at **source validation of PR #3 hardening changes**. The implementation exists, but no canonical PASS is yet recorded for the current branch head and live `0.5.81` is not proven to contain it.

## Next Move

Use the already-created Coding Station repo session at the exact implementation head, run the targeted stream/failover regressions, then full `pnpm test`; patch only inside that Coding Station workspace if a test proves an owning FCM defect.
