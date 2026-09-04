# FCM Broker Plan / Source of Truth

Status: ACTIVE
Last reconciled: 2026-09-04
Repository: `n0namer/free-coding-models`
Active working branch: `fix/fcm-long-stream-lifecycle`
Verified branch head: `8ed335f679d128cf8ac3d0b25ddcabfe4395d9a0` — `test(router): align recovery routing and telemetry isolation`

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
- Branch head: `389f03b14e2d856074212c169b247152ec1faad8`.
- Recent owning commits include:
  - `67ee3f647ebabd157f58f5d080e67bf6a5c02b95` — prefer healthy CLOSED routes before HALF_OPEN probes.
  - `4a734e200fff1760c30ef45dadb28c07b4a288ef` — enforce atomic first-chunk cap.
  - `996541d4fe42f2de4fdf809ae0c738c03c86f5f9` — stop reading after terminal marker.
  - `389f03b14e2d856074212c169b247152ec1faad8` — harden stream-lifecycle regressions.
- Root `PLAN.md` did not exist before this reconciliation; this file is now the canonical project SoT for the active branch.
- **Gap found during reconciliation:** `389f03b` bounds atomic buffering at 16 MiB by flushing the buffered payload and switching to client-visible streaming when the cap is exceeded. That preserves memory bounds but violates the stronger atomic invariant/DoD for tool/structured flows, because a later failure can no longer be transparently retried without leaking a partial payload. Before P0 closure, change cap overflow to a clean fail-closed attempt (zero client bytes) and add a deterministic regression for it.

## Current Runtime State — CURRENT Evidence

- The previously assumed runtime `wgifzaww64jjnhazzed2nrrz / broker-dev / ac6ec419...` is **NOT FCM**. Authoritative Coolify + source readback proves it is the LAN Ops DEV broker; it remains NON-TARGET.
- The actual FCM runtime is now authoritatively identified as Coolify application `krhkfc6xjtreidxxbf8xdia3`, name **FCM LLM Gateway DEV**, repository `n0namer/free-coding-models.git`, exposed port `19280`, start command `node bin/free-coding-models.js --daemon`, no public FQDN.
- Running container: `8ac7bb34efbbeb91fc6258a633a820179a707b2f7bd1197fd13f6ada70cbef57`, healthy, image tag `krhkfc6xjtreidxxbf8xdia3:cd64d76cb6e9c7ede9c7ce556b786e8732a4a81e`, `/config` backed by volume `fcm-config`.
- Coolify provenance says the image was built from branch `capture/windows-local-20260901` at `cd64d76cb6e9c7ede9c7ce556b786e8732a4a81e`. The live container has no `.git` metadata under `/app`.
- Live `/app/src/core/router-daemon.js` SHA256 is `9ee3681465c7c1be3658724c2c40e86da0aae9d3a85adfc762fb0f02d99efb1a` and contains direct post-build edits: CLOSED-before-HALF_OPEN ordering is present even though that Git commit landed later than the image source commit. Therefore configured image SHA alone is not the current source identity.
- More importantly, live stream code still has the old unsafe behavior: it writes the first upstream chunk immediately (`sentToClient = true`), and on a partial stall emits a synthetic warning then returns `failoverToNext=true`, allowing a second model to append to the same client response. It has no `streamTerminalSeen` lifecycle logic and no `test/router-stream-lifecycle.test.js` in the live filesystem.
- This is direct **DESIGN_RUNTIME_DRIFT** against the P0 broker invariant and is now a concrete owning FCM defect. The smallest next change is to bring the permanent FCM DEV container's router stream lifecycle to the tested branch semantics, then execute deterministic fault injection before Git write-back.

## Current Stage

**LIVE ACCEPTANCE / ANTI-DRIFT for the FCM long-stream lifecycle.**

The source-branch design is not sufficient evidence. The next mandatory gate is to prove the permanent FCM DEV runtime is running the exact tested semantics, then prove those semantics with deterministic fault injection.

## DoD for Current Gate

All must pass before this gate is DONE:

1. Exact live source identity is read back and compared with `389f03b14e2d856074212c169b247152ec1faad8` or a newer equivalent runtime delta.
2. Any needed code change is made directly in the permanent FCM DEV container, not by GitHub-first redeploy.
3. Canonical local validation PASS on exact live source.
4. Deterministic fault-injection canaries PASS:
   - healthy CLOSED route is selected before HALF_OPEN,
   - pre-byte 429/5xx/timeout can transparently fail over,
   - truncated tool/structured attempt emits ZERO client bytes and is discarded before retry,
   - terminal `finish_reason` or `[DONE]` completes the attempt even if upstream keeps the connection open,
   - atomic buffer-cap overflow fails cleanly without partial client payload.
5. Plain-text streaming still delivers low-latency first bytes and never splices a second model after emission.
6. Telemetry distinguishes attempt failure / stream outcome from success without recording prompt/response content.
7. At least one real black-box consumer canary passes without any consumer code change.
8. Exact tested live delta is written back to Git and remote readback matches the tested artifact.

## 30-minute Batches — Pareto 80/20

### Batch 1 — Identity + minimum live proof

- Read live `/work` repo HEAD/status and owning broker files.
- Compare live delta to `389f03b`.
- If missing, apply only the missing owning stream-lifecycle delta directly in the container.
- Run the smallest canonical syntax/check plus the stream-lifecycle test slice.
- Stop and replan if live base has unexpected drift.

### Batch 2 — Deterministic fault-injection matrix

Use local deterministic upstreams; do not depend on external model reliability for the error-path gate.

- CLOSED before HALF_OPEN.
- Pre-byte retry on 429/5xx/timeout.
- Atomic tool/structured truncation + retry.
- Terminal marker + upstream keepalive.
- Buffer-cap overflow with zero leaked partial payload.

### Batch 3 — Black-box consumer

- Run an unmodified consumer against live FCM.
- For structured/tool flows, verify no fragment from a failed first attempt is visible.
- Verify FCM telemetry correlates the attempt chain without content logging.

### Batch 4 — Durable capture

- Run canonical tests on the exact accepted live source.
- Write the exact live delta back to the active Git branch.
- Read back remote blobs/head.
- Update this `PLAN.md` with execution IDs, test counts, live identity, and any durable lesson.

---

## Handoff for the Next LLM

Resume here; do not re-diagnose from chat memory.

1. **Project is FCM Broker.** Repo: `n0namer/free-coding-models`. Active branch: `fix/fcm-long-stream-lifecycle`.
2. **Only FCM is in scope.** SWE-AF/OpenCode/AgentField consumers are black-box test clients only. Existing SWE-AF hardening is intentionally kept but must not be expanded for this FCM task.
3. **Do not program via GitHub.** Observe and edit the permanent FCM DEV container directly; Git is write-back after verification.
4. **Source design head is `389f03b`.** Recent owning changes enforce CLOSED>HALF_OPEN, atomic structured/tool failover, terminal-marker completion, bounded buffering, and regressions.
5. **Actual FCM runtime is identified.** Coolify app `krhkfc6xjtreidxxbf8xdia3` / container `8ac7bb34...`, repository `n0namer/free-coding-models.git`, port `19280`. Do not use `wgifzaww... / broker-dev`; that is LAN Ops DEV.
6. **Live defect is already evidenced.** `/app/src/core/router-daemon.js` SHA256 `9ee36814...` still emits first chunks immediately and explicitly fails over after a partial stall, splicing two models into one response. The tested branch has the required atomic/terminal lifecycle but the live container does not.
7. **Next action is direct live patch + fault matrix.** The generic container surface currently allows bounded observation (`pwd/ls/grep/sha256sum`) but rejects write/test commands with `OBSERVE_REQUIRED: scope_unknown`, and the FCM app is not registered as a typed live-patch target. Do not bypass this by GitHub-first redeploy. Resolve the typed direct-container path, patch the live router, then run deterministic fault injection.
8. **Acceptance = router-local fault gates + one black-box consumer + telemetry + exact Git write-back.**
9. **BMad route:** `bmad-help → bmad-testarch-test-design → bmad-quick-dev` only if live evidence shows a code defect.
10. **Stop rule:** do not add semantic JSON-schema enforcement or consumer-specific behavior until the P0 broker lifecycle gate above is PASS.

## Not Part of the Current Gate

Optional future P1: for explicit `response_format=json_schema`, FCM could validate a completed atomic payload against the requested schema before client commit. That would make the broker schema-aware, not merely transport-atomic. Do not add this until the P0 stream/lifecycle contract is proven live.
