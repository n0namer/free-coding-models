# FCM Broker Plan / Source of Truth

Status: ACTIVE
Last reconciled: 2026-09-05
Repository: `n0namer/free-coding-models`
Active working branch: `fix/fcm-long-stream-lifecycle`
Current Git source head: `855c0edbe6d911417ba91dde435101b7f72fbaff` — `test(router): fix JSON schema mock provider URL`
Execution rule: debug/implement directly in permanent `fcm-dev`; GitHub is SoT/write-back only after live verification. No GitHub-first programming or redeploy debug loop.

## North Star

FCM is a generic, reusable OpenAI-compatible free-model broker. It must hide upstream failure when failover is still safe, but it must never corrupt client-visible semantics by splicing multiple upstream attempts into one response.

Clients such as SWE-AF, OpenCode, OpenClaw, and other consumers are black-box canaries only. Their code and runtime are NON-TARGET for this FCM work. Previously made SWE-AF hardening changes are intentionally retained, but they are not evidence that FCM is correct.

## Scope / Non-scope

### Target

- FCM broker routing, circuit health, failover, stream lifecycle, tool/structured-output transparency, and related telemetry.
- FCM broker tests and fault-injection canaries.
- The actual FCM DEV runtime, once identified by authoritative deployment/source evidence. Do not infer it from a container or service name alone.

### Non-target

- SWE-AF, AgentField core, OpenCode, OpenClaw, Universal Solver, or other consumer implementations.
- Do not fix an FCM failure in a consumer.
- Do not use GitHub-first programming or redeploy as the primary debug loop. Code is edited directly in the permanent FCM DEV container, then tested, then written back to Git.

## BMad Routing

Activated for this work:

1. `bmad-help` — restore project/stage and route the next bounded move.
2. `bmad-testarch-test-design` — design fault-injection/acceptance gates for partial-failure boundaries.
3. `bmad-quick-dev` — use only after a concrete owning defect is evidenced; patch the smallest owning surface.

## Evidence-based Debugging Model

Compare a failure execution to the nearest successful execution and locate the first point where the failed stream/attempt diverges. Patch that boundary, then freeze it with a deterministic regression. This follows the Inflection Point approach to distributed-system fault localization.

Prefer small deterministic error-path tests first. Production-failure research shows that incorrect handling of non-fatal errors is a dominant source of catastrophic failures and that simple error-handling tests have high leverage. Partial failures must be treated separately from process health: a service can remain healthy while one request is already inconsistent.

Academic references:
- Yuan et al., OSDI 14, “Simple Testing Can Prevent Most Critical Failures”: https://www.usenix.org/conference/osdi14/technical-sessions/presentation/yuan
- Zhang et al., Inflection Point Hypothesis / Kairux: https://www.usenix.org/publications/loginonline/kairux-distributed-system-fault-localization-based-inflection-point
- Lou et al., NSDI 20, “Understanding, Detecting and Localizing Partial Failures in Large System Software”: https://www.usenix.org/conference/nsdi20/presentation/lou

## Broker Invariants — Do Not Weaken

1. A client-visible response belongs to exactly one upstream attempt.
2. Transparent failover is allowed only before the first client-visible byte.
3. After client-visible bytes have been emitted, FCM must not splice another model/provider into that stream.
4. For tool/function-call and structured output, the upstream attempt is atomic: do not emit to the client until a terminal marker is proven.
5. Terminal success is based on `[DONE]` or a non-null `finish_reason`, not merely HTTP 200 or the first SSE chunk.
6. A failed/truncated atomic attempt is discarded as a whole before another upstream is tried.
7. After a terminal marker is seen, FCM stops waiting for upstream EOF; keepalive must not become a late failure.
8. Atomic buffering is bounded; current design cap is 16 MiB.
9. Healthy CLOSED circuit routes are preferred before HALF_OPEN recovery probes.
10. Telemetry records attempts/outcome/latency/model/provider/circuit state, not prompt or response bodies.

## Current Source State

- Active fix branch: `fix/fcm-long-stream-lifecycle`.
- Current verified head before this PLAN write-back: `8ed335f679d128cf8ac3d0b25ddcabfe4395d9a0`.
- Owning stream-lifecycle commits include:
  - `67ee3f647ebabd157f58f5d080e67bf6a5c02b95` — prefer healthy CLOSED routes before HALF_OPEN probes.
  - `4a734e200fff1760c30ef45dadb28c07b4a288ef` — bound atomic first-chunk buffering.
  - `996541d4fe42f2de4fdf809ae0c738c03c86f5f9` — stop reading after terminal marker.
  - `389f03b14e2d856074212c169b247152ec1faad8` — harden stream-lifecycle regressions.
  - `97ab17cf4c7948f4c55f24bd87f994b7d3b4dece` + `ab7a283cd2aa443e847cc9096f315ac00e109b7f` — change atomic buffer overflow from client flush to fail-closed/retryable zero-byte failure.
  - `47300620a59df801649336225ffea878340df1d4` — regression for 17 MiB atomic overflow with no failed-attempt payload leakage.
  - `8ed335f679d128cf8ac3d0b25ddcabfe4395d9a0` — align legacy HALF_OPEN regression with CLOSED-before-HALF_OPEN and isolate positive telemetry testing from deployment env.
- The earlier 16 MiB atomic-overflow gap is **CLOSED**: overflow is now an attempt failure (`atomic_stream_buffer_limit` / `stream_outcome=buffer_overflow`) before client commit, so a later model can be tried without leaking the failed payload.
- `PLAN.md` remains the canonical project SoT for this active branch.

## Current Runtime State — CURRENT Evidence

- `wgifzaww64jjnhazzed2nrrz / broker-dev` remains NON-TARGET. The authoritative DEV target is typed target `fcm-dev` / Coolify application `krhkfc6xjtreidxxbf8xdia3`, port `19280`.
- The permanent runtime remains the old image/container lineage (`8ac7bb34...`, image provenance `capture/windows-local-20260901@cd64d76...`). Rebuild/redeploy is still not the debug path; all P1 recovery/debug edits were performed directly in `fcm-dev` and the same container was reloaded only after syntax/focused tests passed.
- The previous live router corruption is **recovered**. CURRENT `/app/src/core/router-daemon.js` is 4,107 lines / 177,978 bytes and `node --check` PASS. CURRENT `/app/src/core/schema-normalizer.js` is 359 lines / 23,041 bytes and `node --check` PASS. The old runtime embeds the P1 structured-contract adaptation in `schema-normalizer.js`; canonical Git keeps the cleaner separate `src/core/structured-output-contract.js` owner, so byte-for-byte source identity is still intentionally marked drifted.
- The duplicated live `/app/test/test.js` corruption was repaired at the verified duplicate boundary. CURRENT file is 6,966 lines / 295,423 bytes and `node --check` PASS. It is a repaired old-image harness, not a byte-identical copy of current Git `test/test.js`.
- Canonical live-container `npm test` now PASS: 820 tests discovered, 818 passed, 0 failed, 2 intentionally skipped live-only canaries, 159 suites, ~18.9 s. The two skipped canaries are excluded only because the canonical suite clears `FCM_CLIENT_TOKEN`; the same focused file was then executed directly with runtime env intact and returned 7/7 PASS, including live plain-text and live `json_schema` canaries.
- P1 deterministic fault matrix is PASS in the live container: non-stream invalid primary -> valid fallback, both-invalid -> fail-closed with no rejected-payload leak, malformed client schema -> 400 before any upstream call, and streaming invalid primary -> atomic valid fallback.
- Live black-box acceptance is PASS after reload: ordinary text remains callable and `response_format=json_schema` returns a schema-valid response through Gonka. A previous 32-token schema canary was a false negative caused by truncating reasoning/output; the acceptance canary uses a realistic 256-token budget.
- Structured provider compatibility is proven live: for `json_schema` requests, FCM disables provider thinking only when the client did not set a thinking policy and the provider supports the disabled-thinking field. The equivalent canonical router delta is already written to Git.
- The earlier four red `router-json-schema.test.js` results were traced to a test-harness URL defect (`http://127.0.0.1${port}` missing `:`), not router behavior. Canonical Git fixes that at head `855c0edbe6d911417ba91dde435101b7f72fbaff`.
- SourceLoop/FVE journal is CURRENT and records the live-patch chain, but recent captures remain `PENDING` and `sourceLoopAction artifact` returns `capture_artifact_reference_invalid`. Treat this as **SOURCELOOP_GAP**, not an application failure. Durable Git write-back is allowed only for already-live-verified canonical deltas while this gap remains.
- Fresh config readback confirms Gonka-only routing remains persisted: `fast-coding` contains exactly `gonka/deepseek-ai/DeepSeek-V4-Flash-0731` priority 1 and `gonka/MiniMaxAI/MiniMax-M2.7` priority 2.

## Current Stage

**P1 STRUCTURED CONTRACT VALIDATION — RUNTIME GATE PASS / ANTI-DRIFT WRITE-BACK ACTIVE.**

The functional/runtime gate is green: repaired live source is syntax-valid, P1 fault injection is green, canonical live `npm test` has zero failures, and direct live plain-text plus `json_schema` canaries both pass after reloading the same container. The remaining work is anti-drift, not feature debugging: keep only verified durable deltas in canonical Git, record the SourceLoop artifact gap, and do not claim exact-source identity because the permanent container still uses an older image/source layout with a runtime adaptation of the canonical P1 architecture.

## DoD for Current Gate

1. **PASS — live recovery.** `router-daemon.js`, `schema-normalizer.js`, and repaired live `test/test.js` all pass syntax checks; the same container was reloaded without rebuild/redeploy and remains healthy.
2. **PASS — P0 lifecycle invariants.** CLOSED-before-HALF_OPEN, pre-byte failover, zero-byte atomic truncation retry, terminal-marker keepalive completion, no post-byte splicing, and bounded atomic overflow remain covered and green.
3. **PASS — P1 deterministic contract matrix.** Invalid primary -> valid fallback, both-invalid -> fail-closed/no leak, malformed client schema -> 400 before upstream, and invalid streaming attempt -> atomic valid fallback all pass.
4. **PASS — canonical live suite.** `npm test` PASS: 820 tests discovered, 818 passed, 0 failed, 2 intentional live-canary skips, 159 suites. The same focused auth/P1 file run directly with runtime env intact is 7/7 PASS, so the two skips are test-isolation behavior rather than missing functional evidence.
5. **PASS — real black-box semantics.** Live ordinary text and `response_format=json_schema` requests both return HTTP 200 through Gonka after reload; schema output validates before client commit.
6. **PASS — provider compatibility / harness RCA.** Structured requests disable thinking only on compatible providers when the client did not choose a thinking policy; the earlier four JSON integration failures were a missing-colon mock URL defect and are fixed in canonical Git.
7. **PASS — verified canonical deltas.** Live-proven structured provider compatibility and the JSON-schema test URL fix are present on `fix/fcm-long-stream-lifecycle`; current pre-PLAN code/test head is `855c0edbe6d911417ba91dde435101b7f72fbaff`.
8. **OPEN — exact-source anti-drift.** The permanent DEV container still has an older image/source layout and runtime adaptation (`structured-output` logic embedded in the old normalizer), so exact tested Git SHA == deployed filesystem identity is **not** proven. Do not call this criterion PASS by inference.
9. **BLOCKED — SourceLoop artifact write-back.** FVE journal capture is readable, but recent capture artifacts are invalid/unavailable (`capture_artifact_reference_invalid`). Canonical Git write-back is therefore verified manually for live-proven deltas; SourceLoop itself remains a `SOURCELOOP_GAP`.

## 30-minute Batches — Pareto 80/20

### Batch 1 — Identity + minimum live proof — DONE

- Actual FCM DEV runtime identified; LAN Ops false target excluded.
- `fcm-dev` typed live-patch target registered.
- Missing stream-lifecycle behavior patched directly in the permanent container and syntax-checked.

### Batch 2 — Deterministic fault-injection matrix — DONE

- CLOSED before HALF_OPEN — PASS.
- Pre-byte provider failure can fail over — PASS.
- Atomic tool/structured truncation emits zero failed-attempt client bytes before retry — PASS.
- Terminal marker completes despite upstream keepalive — PASS.
- Plain-text never splices after client commit — PASS.
- 16 MiB atomic buffer overflow fails cleanly and remains retryable — PASS.

### Batch 3 — Black-box consumer — DONE

- Real live daemon auth/OpenAI-compatible protocol surface — PASS.
- Active set is Gonka-only: DeepSeek priority 1, MiniMax priority 2.
- Real-model chat generation — PASS via `gonka/deepseek-ai/DeepSeek-V4-Flash-0731` with HTTP 200.

### Batch 4 — Durable capture — DONE FOR FCM DELTA

- Product and regression delta written back to `fix/fcm-long-stream-lifecycle` and reread.
- Test-only CLOSED/HALF_OPEN + telemetry-environment cleanup durably merged at code/test head `8ed335f...`.
- PLAN reconciled after write-back.
- Canonical live-container `npm test` is now green: 814/814 tests, 159 suites, 0 failures. The earlier benchmark suspicion did not reproduce; the actual first-run red was stale live test expectation drift, already represented correctly in the branch.

---

## P1 Structured Contract Validation — BMAD Test Architecture

Status: ACTIVE / TEST-HARDENING. P0 lifecycle remains PASS and must not be weakened.

BMad routing used for this phase:
1. `bmad-help` — restored project/stage and routed the next mandatory move.
2. `bmad-testarch-test-design` — system-level risk/testability and coverage design.
3. `bmad-testarch-automate` — expand only the highest-leverage deterministic automation first.
4. `bmad-review-edge-case-hunter` — enumerate unhandled schema/choice/boundary paths before runtime acceptance.

### Evidence-based testing strategy

The test strategy follows three high-leverage findings from software-testing research:
- error-path/fault-injection tests receive P0 priority because simple error-handling tests prevent a large fraction of catastrophic distributed-system failures (Yuan et al., OSDI 2014);
- properties/invariants are exercised over many generated/repeated values instead of only examples (Claessen & Hughes, QuickCheck, ICFP 2000);
- mutation adequacy is a later confidence check for critical validator branches, not a substitute for deterministic correctness tests (Jia & Harman, IEEE TSE 2011).

### Testability assessment

Strengths:
- structured contract is now isolated in `src/core/structured-output-contract.js`;
- provider attempts are mockable and deterministic;
- streaming attempts can be fault-injected before client commit;
- contract materialization and validation can be tested without network/dependencies.

Actionable concerns:
- CI/Coding Station dependency installation is currently unreliable (`ENOSPC` / missing dependencies), so full-suite evidence must not be inferred from unit PASS;
- clean Coolify deployment has not yet produced an exact-head runtime readback;
- regex `pattern` is intentionally rejected fail-closed in the current supported subset; do not re-enable it without a bounded/safe engine and adversarial timeout evidence;
- recursive/local `$ref` complexity needs explicit bounded-depth/size acceptance evidence;
- provider-native refusals / alternate structured-output terminal forms need protocol-specific acceptance decisions before being treated as schema failures.

### Risk matrix

| Risk | Cat. | P | I | Score | Mitigation / evidence |
|---|---|---:|---:|---:|---|
| Invalid primary output leaks before failover | DATA/TECH | 2 | 3 | 6 | P0 atomic buffer + router JSON-schema integration test; must remain zero-byte before retry |
| Validator accepts malformed schema and gives false assurance | TECH | 2 | 3 | 6 | fail-closed schema-definition checks + boundary table tests |
| Multi-choice response validates only choice 0 or mixes SSE choices | DATA | 2 | 3 | 6 | validate every completion choice; isolate SSE by `choice.index`; dedicated regression tests |
| Validator semantics drift from supported schema subset | TECH | 2 | 2 | 4 | table-driven keyword boundaries now; differential reference-validator suite later |
| Catastrophic regex / pathological schema CPU | SEC/PERF | 2 | 3 | 6 | `pattern` disabled fail-closed for current subset; keep disabled until safe-engine + timeout evidence exists |
| Recursive/deep schema causes stack/CPU exhaustion | SEC/PERF | 2 | 3 | 6 | recursion cap exists; add schema-depth/node-count tests and request-size evidence |
| Both providers return invalid structured output | BUS/TECH | 2 | 3 | 6 | integration test must prove fail-closed terminal error and no rejected payload leak |
| Provider normalizer mutates acceptance contract | DATA | 2 | 3 | 6 | canonical immutable contract + per-attempt cloned materialization; cross-provider body assertions |
| Refusal/alternate terminal response misclassified as invalid schema | BUS/TECH | 2 | 2 | 4 | explicitly specify/test accepted refusal semantics before release |
| Full suite/runtime identity not proven | OPS | 3 | 3 | 9 | exact-source full suite + exact deployed SHA + live black-box schema smoke required for DONE |

### Pareto coverage plan — 20% effort / 80% confidence

P0 mandatory before P1 DONE:
1. Unit/component: build-once immutable contract, fail-closed malformed schema, every supported keyword representative pass/fail boundary, local-ref behavior, deterministic repeated materialization.
2. API integration: non-stream invalid primary -> valid fallback; stream invalid primary -> valid fallback with zero leaked rejected bytes; malformed client schema -> 400 with zero upstream calls.
3. Failure matrix: both upstream attempts invalid; invalid JSON syntax; missing structured content; terminal truncation; 16 MiB atomic overflow; no post-client-commit failover.
4. Multi-choice: every completion choice validated; SSE chunks isolated by choice index and every choice validated.
5. Runtime acceptance: canonical full suite green on exact source; deployed identity equals tested identity; real Gonka `json_schema` request PASS and ordinary text request unchanged.

P1 confidence extensions after the mandatory gate:
- deterministic property/fuzz generation for nested objects/arrays/unions and local refs;
- differential validation against a mature JSON Schema reference implementation for the advertised subset;
- mutation testing of validator branches to detect weak assertions;
- bounded adversarial performance cases for depth, large enums/arrays, regex patterns, and 16 MiB boundary ±1 byte;
- repeated failover runs to detect state leakage/circuit-breaker coupling.

### Quality gate / DoD for P1

P1 is DONE only when all are evidenced:
- P0 scenarios: 100% PASS;
- all score >=6 risks have implemented mitigation and executable evidence;
- centralized contract unit suite PASS on exact source;
- router JSON-schema integration suite PASS on exact source;
- canonical `npm test` PASS with zero failures;
- exact tested Git SHA is the deployed DEV identity;
- live black-box `response_format=json_schema` PASS through priority-1 Gonka route;
- fault-injected invalid primary proves safe pre-commit fallback; both-invalid proves fail-closed;
- plain-text/non-structured behavior remains unchanged;
- SourceLoop happens only after this runtime gate, per current user direction.

### BMAD execution delta — 2026-09-04

Implemented during test-design/automation review:
- malformed numeric schema bounds, duplicate `type`/`required`/`enum`, empty `enum`, and non-positive `multipleOf` now fail closed at contract build;
- representative supported-keyword boundary matrix added;
- 100-iteration deterministic invariant test added for independent provider materialization;
- discovered and fixed an unhandled multi-choice defect: non-stream previously validated only `choices[0]`, while SSE concatenated content from multiple choices; central validation now validates every choice independently and SSE accumulation is keyed by `choice.index`;
- dedicated multi-choice regressions added;
- exact-source dependency-free contract suite PASS: 9/9 tests, 1 suite, 0 failures on code head `731d5a634dc9d8b02b0db0386c3860476fb05c11`; `node --check` for the central contract and router had already passed on the immediately preceding compatible source shape;
- router integration execution remains a VALIDATION_BLOCKER in Coding Station because dependencies cannot be installed (`npm ci` -> `ENOSPC`; direct router suite -> missing `chalk`). This is environment evidence, not an application-test failure.

Current nearest mandatory move: restore one authoritative integration environment, run the P0/P1 API failure matrix plus canonical `npm test`, then perform exact-SHA DEV deploy/readback and live Gonka schema smoke before SourceLoop.

## Handoff for the Next LLM

Resume here; do not re-diagnose from chat memory.

1. **Project is FCM Broker.** Repo `n0namer/free-coding-models`; active branch `fix/fcm-long-stream-lifecycle`. Only FCM is in scope. Existing SWE-AF hardening stays but must not be expanded for this work.
2. **Permanent DEV runtime is known and typed.** Coolify app `krhkfc6xjtreidxxbf8xdia3`, container `8ac7bb34...`, typed target `fcm-dev`, port `19280`. `wgifzaww... / broker-dev` is LAN Ops DEV and must not be touched.
3. **Container-first rule remains mandatory.** Do not program by editing GitHub and redeploying. Live debugging/patching happens in `fcm-dev`; Git is durable write-back only after verification.
4. **P0 lifecycle behavior is already fixed live.** Post-reload router SHA256 is `fe087729a2f4d85d4e19e60a49b61af64d09144a7e14f6876b79654df40dd49c`. No post-byte model splicing; structured/tool attempts are atomic; terminal markers end the attempt; 16 MiB overflow fails before client commit; CLOSED outranks HALF_OPEN.
5. **Deterministic P0 fault matrix is PASS.** Do not reopen the lifecycle design unless new evidence contradicts it. Product/regression write-back is already on the active branch; pre-PLAN code/test head was `8ed335f679d128cf8ac3d0b25ddcabfe4395d9a0`.
6. **Live provider routing is intentionally Gonka-only.** Active set `fast-coding` contains exactly `gonka/deepseek-ai/DeepSeek-V4-Flash-0731` priority 1 and `gonka/MiniMaxAI/MiniMax-M2.7` priority 2. A real black-box chat request returned HTTP 200 through priority-1 DeepSeek; MiniMax is the only fallback.
7. **No P0 validation blocker remains.** Canonical live-container `npm test` PASS: 814/814 tests, 159 suites, 0 failures. The prior benchmark suspicion did not reproduce; the first-run red was stale live issue-#137 expectation drift, while the active branch already encoded the safe no-splice contract.
8. **Git hygiene is clean for this scope.** Product/regression changes and the corrected issue-#137 expectation are durably present on `fix/fcm-long-stream-lifecycle`; no main-branch product change was made by this work.
9. **Next move is release/branch hygiene only if explicitly desired:** reconcile the draft PR/branch with current `main` and its checks without reopening the already-PASS P0 lifecycle design.
10. **Do not auto-start P1 schema-semantic enforcement.** P0 is proven live and green. Schema/business validation remains a separate architectural decision and is not FCM's default responsibility unless explicitly adopted.

## Not Part of the Current Gate

Optional future P1: for explicit `response_format=json_schema`, FCM could validate a completed atomic payload against the requested schema before client commit. That would make the broker schema-aware, not merely transport-atomic. Keep this out of the current scope unless a new explicit architecture decision assigns that responsibility to FCM.
