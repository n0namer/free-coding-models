# FCM Broker Plan / Source of Truth

Status: ACTIVE
Last reconciled: 2026-09-05
Repository: `n0namer/free-coding-models`
Active working branch: `fix/fcm-long-stream-lifecycle`
Current live-verified canonical head before PLAN-only reconciliation: `d2467ac2922e55ae2b717e1ecec8b06b38af7818` — `fix(router): migrate fast-coding off Gonka-only routing`
Execution rule: debug/implement directly in permanent `fcm-dev`; GitHub is SoT/write-back only after live verification. No GitHub-first programming or redeploy debug loop.

## North Star

FCM is a generic, reusable OpenAI-compatible free-model broker. It must hide upstream failure when failover is still safe, but it must never corrupt client-visible semantics by splicing multiple upstream attempts into one response.

For `response_format=json_schema`, the client contract is the immutable acceptance SoT. If a model returns structurally invalid output while client commit is still zero-byte safe, FCM must not only retry the same full contract or immediately fail over: it should make the generation task easier for weaker models by decomposing the original schema into smaller schema-preserving subcontracts, validate each fragment, merge fragments deterministically, and validate the assembled value against the unchanged original full contract before any client-visible commit. Decomposition may simplify generation, but it must never weaken final acceptance semantics.

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

1. A normal client-visible response belongs to exactly one upstream attempt. **Structured-repair exception:** before client commit, FCM may deterministically assemble validated JSON fragments from multiple hidden subrequests to the **same candidate model/provider** under one immutable original contract. Never merge fragments across different candidates/providers; if repair fails, discard the whole candidate repair transaction before failover.
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
- Fresh exhaustive discovery on 2026-09-05 scanned 131 routeable catalog candidates backed by configured provider credentials. Exactly 33 candidates returned a fresh successful chat probe and were persisted into `fast-coding`; the other candidates were excluded rather than assumed healthy. The final set spans 9 provider identities: Gonka (2), LLM7 (3), Kilo (2), OpenRouter (7), Google AI (4), Mistral (3), Z.AI (2), OpenCode Zen (3), and Requesty (7). The temporary discovery-only runtime instrumentation was fully reverted after persistence; `/app/src/core/router-daemon.js` returned to the pre-discovery SHA `61505d270450245ddd2e5c848cf9becffc92bde94be492a00eb9d7bbde085cc2`, the same container was reloaded, and final live plain-text + `json_schema` canaries are 2/2 PASS. A successful generic chat probe proves current route liveness, not `json_schema` capability; structured incompatibility remains fail-closed and route/role scoped by `structuredRouteBlocks`.

## Current Stage

**P1.7 QUALITY-FIRST HEALTH-AWARE ROUTING — LIVE GATE PASS / ANTI-DRIFT ACTIVE.**

CURRENT live runtime has both previously missing behaviors: progressive `json_schema` repair is implemented, and `fast-coding` is no longer Gonka-only. Provider-level retryable failures (`429`, timeout, retryable `5xx`, maintenance) skip the remaining models behind that provider failure domain; structured-schema incompatibility is isolated to that route/role. A bounded exhaustive discovery pass tested 131 routeable keyed candidates and persisted all 33 fresh chat-probe successes across 9 provider identities. The persisted set is now quality-first using the native catalog order `tier (S+→C) → SWE score descending → previous proven order as stable tie-break`; runtime health still filters unusable routes before selection, so latency is secondary and cannot outrank a stronger healthy priority.

### North Star progress / remaining closure tasks

- **Functional runtime goal for the current incident: REACHED.** FCM can recover a weak-model structured response by bounded subcontracts and can escape a failing Gonka failure domain to independent providers before client commit.
- **Formal project closure still has 3 mandatory anti-drift tasks:**
  1. **Exact-source full-suite evidence:** run the complete canonical suite from exact Git source in an environment that can perform the normal install/build lifecycle. Live-container full suite is green; exact-source focused gates have been green, but exact-source full-suite evidence remains incomplete.
  2. **Exact deployed source identity:** prove tested Git SHA == permanent DEV filesystem identity. The permanent container still uses an older image/source layout, so this remains `DESIGN_RUNTIME_DRIFT`; no GitHub-first programming/redeploy debug loop.
  3. **SourceLoop closure:** recover a valid capture artifact and verify durable write-back/readback. Current artifact retrieval remains `capture_artifact_reference_invalid` => `SOURCELOOP_GAP`.
- Optional capability-registry/fuzz/differential/mutation work remains confidence/operability extension, not a blocker for the current live routing fix.

## DoD for Current Gate

1. **PASS — live recovery.** `router-daemon.js`, `schema-normalizer.js`, and repaired live `test/test.js` all pass syntax checks; the same container was reloaded without rebuild/redeploy and remains healthy.
2. **PASS — P0 lifecycle invariants.** CLOSED-before-HALF_OPEN, pre-byte failover, zero-byte atomic truncation retry, terminal-marker keepalive completion, no post-byte splicing, and bounded atomic overflow remain covered and green.
3. **PASS — P1/P1.5/P1.6 deterministic matrix.** Structured invalid-primary/both-invalid/malformed-schema/streaming boundaries remain green; progressive fragment repair, provider-domain `429` skip, structured-only route blocking, and independent-provider failover have dedicated deterministic regressions.
4. **PASS — canonical live suite.** `npm test` PASS after the multi-provider set migration: 831 tests discovered, 829 passed, 0 failed, 2 intentional live-canary skips, 159 suites, ~18.1 s.
5. **PASS — real black-box semantics.** After final same-container reload, live ordinary text and `response_format=json_schema` canaries are 2/2 PASS with a persisted 33-route `fast-coding` set spanning 9 provider identities. The set contains only candidates that produced fresh successful chat probes in the 131-candidate discovery pass; structured capability remains separately fail-closed.
6. **PASS — quality-first health-aware routing.** The 33 persisted routes are ordered by native strength metadata (`tier S+→C`, then SWE score descending, then prior proven order). `probeMode=balanced` is active at 30s and performs real chat-completion probes; the circuit breaker removes unhealthy routes from the effective order without changing their durable quality priority. Retryable provider failures skip the failed provider domain, while structured-schema failures remain route/role scoped.
7. **PASS — verified canonical deltas.** The live-verified Gonka-only set migration is written back and reread on `fix/fcm-long-stream-lifecycle`; current live-verified canonical code head before PLAN-only reconciliation is `d2467ac2922e55ae2b717e1ecec8b06b38af7818`.
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
- Legacy Gonka-only `fast-coding` set is retired. A bounded exhaustive pass tested 131 routeable keyed candidates and persisted all 33 fresh chat-probe successes across 9 provider identities. The set is now explicitly ordered quality-first by native catalog metadata: `tier (S+→C)`, then SWE score descending, then the previous proven order as a stable tie-break. Current priority 1 is `llm7/minimax-m2.7`; weaker healthy routes remain available lower in the cascade.
- Real-model live acceptance remains PASS for ordinary text and `json_schema`; catalog-only or failed candidates were not added, and structured incompatibility remains route/role scoped rather than inferred from chat liveness.

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

### BMAD execution delta — 2026-09-05

Executed as container-first Pareto batches using `bmad-help`, `bmad-testarch-test-design`, `bmad-testarch-automate`, `bmad-review-edge-case-hunter`, and `bmad-quick-dev`:
- recovered the corrupted live router directly in `fcm-dev`; syntax is green and the same container was reloaded without rebuild/redeploy;
- retained the centralized P1 contract architecture while adapting it to the old runtime layout; canonical Git continues to own the separate `src/core/structured-output-contract.js` module;
- P1 fault matrix PASS 4/4: invalid-primary fallback, both-invalid fail-closed/no leak, malformed-schema pre-upstream rejection, and atomic streaming fallback;
- live acceptance PASS: focused auth/P1/live suite 7/7, including ordinary text and real Gonka `json_schema` requests;
- repaired duplicated old-image `test/test.js` enough to execute the live canonical suite; `npm test` PASS with 820 discovered / 818 pass / 0 fail / 2 intentional live-canary skips across 159 suites;
- isolated the live-only canaries from package-test auth sanitization: `test/clear-client-auth-env.js` intentionally removes the client token, so package tests skip those two canaries while direct runtime execution proves both PASS;
- traced the earlier four JSON-schema integration reds to the test harness itself: mock URL omitted `:` before the random port. Canonical fix is included at code/test head `855c0edbe6d911417ba91dde435101b7f72fbaff`;
- live-proven structured provider compatibility is also captured canonically: structured requests disable provider thinking only when the client did not specify a thinking policy and the provider supports that field;
- exact canonical code/test head `855c0edbe6d911417ba91dde435101b7f72fbaff` was revalidated in an isolated repo session after installing the locked pnpm dependencies into workspace-local cache/store: `structured-output-contract` + `router-json-schema` + `router-stream-lifecycle` are **21/21 PASS, 3 suites, 0 failures**;
- a direct full exact-source test command then hit the known Coding Station filesystem/quota blocker: 29 failures were dominated by `ENOSPC` temp-file writes, plus expected environment-preparation gaps from `--ignore-scripts` (missing local package self-link and unbuilt `web/dist`). This is **VALIDATION_BLOCKER/environment evidence**, not a P1 regression; the P1-focused exact-source suites stayed green in the same session;
- SourceLoop journal remains readable, but artifact retrieval for recent captures fails with `capture_artifact_reference_invalid`; this is recorded as `SOURCELOOP_GAP` rather than silently claiming write-back success.

Current nearest mandatory move: anti-drift closure only — exact-source P1 behavior is now proven; keep exact deployed-filesystem identity OPEN, avoid copying old-runtime adaptation/diagnostic-only drift into Git, and preserve the SourceLoop gap explicitly. A future controlled source-identity reconciliation can close the remaining `DESIGN_RUNTIME_DRIFT`; no redeploy is required for the current functional runtime gate.

## Handoff for the Next LLM

Resume from CURRENT evidence; do not re-diagnose from chat memory.

1. **Project / target.** Repo `n0namer/free-coding-models`, branch `fix/fcm-long-stream-lifecycle`; only FCM is in scope. Authoritative DEV is typed target `fcm-dev`, Coolify app `krhkfc6xjtreidxxbf8xdia3`, port `19280`. `wgifzaww... / broker-dev` is NON-TARGET.
2. **Execution rule.** Container-first remains mandatory: debug/patch `fcm-dev`, verify there, then write verified durable deltas to Git. Do not use GitHub-first programming or redeploy as a debug loop.
3. **P0 is stable.** No post-byte splicing, tool/structured attempts are atomic, terminal markers finish the attempt, 16 MiB overflow fails before client commit, and CLOSED routes outrank HALF_OPEN recovery probes.
4. **P1 is adopted and functionally live.** `response_format=json_schema` is a machine-contract gate only; FCM builds one contract per client request, reuses it across attempts, validates complete output before client commit, and fails over on invalid attempts while safe. It does not validate business/factual truth.
5. **Runtime gate is green.** Current live router/normalizer/test harness pass syntax. Full `npm test` is 829 PASS / 0 FAIL / 2 intentional live-only skips across 159 suites. After same-container reload, live plain-text and real `json_schema` canaries are 2/2 PASS.
6. **Quality-first multi-provider routing.** Persisted `fast-coding` contains 33 fresh chat-probe-healthy routes discovered from 131 routeable keyed candidates across 9 provider identities. Priorities are ordered by native catalog strength (`S+→C`), then SWE score descending, with prior proven order as stable tie-break; current priority 1 is `llm7/minimax-m2.7`. Runtime selection still requires CURRENT route health, so an unhealthy high-priority model is skipped without permanently demoting it. `probeMode=balanced` remains active at a 30s cadence and uses real chat-completion probes, not `/models`; retryable provider failures can cross provider failure domains, while structured incompatibility is route/role scoped.
7. **Canonical code/test head.** Before PLAN-only reconciliation, current live-verified canonical code head is `d2467ac2922e55ae2b717e1ecec8b06b38af7818`, containing the narrow legacy Gonka-only set migration.
8. **Do not copy runtime adaptation blindly.** The old image embeds structured-contract behavior in `schema-normalizer.js`; canonical Git correctly owns it in `src/core/structured-output-contract.js`. Runtime behavior and architecture are aligned, but filesystem bytes are not identical.
9. **Remaining anti-drift.** Exact tested Git SHA == permanent DEV filesystem identity remains OPEN because the runtime is an older image/source layout. This is `DESIGN_RUNTIME_DRIFT`, not a functional failure. No redeploy is required merely to close the current functional P1 gate.
10. **SourceLoop gap.** Journal/captures are visible but artifact retrieval for recent changes returns `capture_artifact_reference_invalid`; keep this explicitly `SOURCELOOP_GAP`. Do not claim SourceLoop write-back succeeded. Use canonical Git only for live-verified deltas while the artifact lane is unavailable.
11. **Next bounded move.** Re-read canonical router/contract/tests against these live-proven invariants, write back only any genuinely missing verified delta, then report normal-start status. Optional fuzz/differential/mutation/adversarial-schema testing remains post-gate confidence work, not a blocker for the current runtime gate.
