# AG2 Network — PR Publication Plan

This document describes how the `network-design` branch is published to `main`. Phase 1 ships as three stacked pull requests (PR1–PR3). Phase 2.0 + Phase 3 work currently on `network-design` ships afterward in a follow-up split (see [Post-PR3](#post-pr3--phase-20--phase-3-publication)).

Source of truth for the design itself is [PLAN.md](PLAN.md). This file only covers **how the work ships**.

## Status

| PR | Number | Branch | Title | State |
|----|-------:|--------|-------|-------|
| PR1 | [#2774](https://github.com/ag2ai/ag2/pull/2774) | `feat/network-pr1-task` | `feat(beta): add Task lifecycle primitive` | ✅ merged |
| PR2 | [#2775](https://github.com/ag2ai/ag2/pull/2775) | `feat/network-pr2-protocol` | `feat(beta/network): protocol, state, and control plane` | ✅ merged |
| PR3 | [#2776](https://github.com/ag2ai/ag2/pull/2776) | `feat/network-pr3-tools` | `feat(beta/network): LLM tool surface and workflow` | ✅ merged (`5c2247ebb77`) |
| PR4+ | _tbd_ | _tbd_ | Phase 2.0 + Phase 3 follow-ups | 📦 staged on `network-design` (needs rename + rebase pass) |

## Strategy

- **Three sequential PRs**, each stacked on the previous (`PR1 ← PR2 ← PR3`). Independence between PRs is **not** maintained — PR2 branches off PR1, PR3 off PR2.
- The split follows architectural layers, not development milestones:
  - PR1 — the framework-core `Task` primitive (no network)
  - PR2 — the network protocol + state + tenant-side control plane (no LLM-facing tool surface)
  - PR3 — the LLM-facing tool surface + workflow orchestration + integration tests that drive agents through tools
- **Cross-PR file modifications are minimised but unavoidable**: four files are slim/altered in PR2 and modified in PR3 — `network/__init__.py`, `client/__init__.py`, `client/hub_client.py`, and `test/beta/network/test_consulting.py`. All other source and test files ship at branch-HEAD state in their introducing PR.
- **`design/`** is excluded from every PR. PLAN.md and per-area design docs are internal references, not part of the V1 contract under review.

## PR table

| PR | Title topic | Branches off | Source LOC* | Test LOC* | Tests |
|----|-------------|--------------|------------:|----------:|------:|
| PR1 | Task primitive (framework-core) | `origin/main` | ~700 | ~320 | 22 |
| PR2 | Network protocol + state + control plane | PR1 | ~7K | ~3.5K | 74 |
| PR3 | Session participation tools + workflow | PR2 | ~1.1K | ~2.5K | 59 + 2 anthropic |

\* Approximate. PR2 ships the bulk of the source and adapter/expectation/observation tests. PR3 is mostly the LLM tool surface + tests that drive agents through tools.

## PR1 — `Task` primitive (framework-core)

**Goal:** ship the framework-core lifecycle primitive any `Agent` can wrap work in. No network — bare `Agent` continues to work standalone with no behavioural change when `autogen.beta.network` is not imported.

**Branch:** `feat/network-pr1-task` off `origin/main`.

**Files:**

- `autogen/beta/__init__.py` (Task surface additions)
- `autogen/beta/agent.py` (`agent.task(...)` + public `add_policy()`)
- `autogen/beta/events/__init__.py` (export `TaskExpired`)
- `autogen/beta/events/task_events.py` (`TaskExpired`, widened `TaskCompleted.result` to `Any`, optional `spec`/`payload`)
- `autogen/beta/task.py` (NEW — `Task`, `TaskSpec`, `TaskState`, `TaskMetadata`, `TaskInject`)
- `test/beta/test_task.py`

**Exit criteria:** `agent.task(...)` lifecycle emits `TaskStarted` / `TaskProgress` / `TaskCompleted` / `TaskFailed` / `TaskExpired` events on a bound stream; `TaskInject` resolves to the active task inside the `async with` block. Validated by `test_task.py` (22 tests).

**Validation command:**
```
.venv-beta/bin/pytest test/beta/test_task.py -v
```

## PR2 — Network protocol + state + control plane

**Goal:** ship the entire network module **except** the LLM-facing tool surface. After this PR, agents can register through a hub, exchange envelopes inside protocol-defined sessions (consulting / conversation / discussion / workflow), participate in turn-taking via the default notify handler, and observe each other's tasks — all by writing tenant code that calls `Session.send()` and similar methods directly. The 6 LLM-facing tools (`say`, `delegate`, `peers`, `sessions`, `tasks`, `context`) and `NetworkPlugin` arrive in PR3.

**Branch:** `feat/network-pr2-protocol` off PR1.

**Files (all new in this PR):**

Network primitives and protocol:
- `autogen/beta/network/__init__.py` (slim — re-exports the PR2 surface only)
- `autogen/beta/network/{ids, errors, policies, identity, auth, envelope, rule, session, transitions, task_mirror}.py`
- `autogen/beta/network/transport/{__init__, frames, link, local}.py`
- `autogen/beta/network/views/{__init__, base, builtin}.py`
- `autogen/beta/network/adapters/{__init__, base, consulting, conversation, discussion, workflow}.py`

Hub:
- `autogen/beta/network/hub/{__init__, audit, core, expectations, layout, sweepers}.py`

Client (control plane + session participation, no LLM tools):
- `autogen/beta/network/client/__init__.py` (slim — no plugin/tools re-exports)
- `autogen/beta/network/client/{network_client, agent_client, session, task, inject, handlers, skill_render}.py`
- `autogen/beta/network/client/hub_client.py` (slim — no `.plugin` import; no plugin attachment in `register()`)

Tests:
- `test/beta/network/__init__.py`
- `test/beta/network/_helpers.py`
- `test/beta/network/test_foundation.py` (raw envelope round-trip + identity hydrate)
- `test/beta/network/test_audit_and_lifecycle.py` (audit log + lifecycle invariants)
- `test/beta/network/test_consulting.py` (consulting adapter end-to-end via `TestConfig`-mocked `Agent.ask`)
- `test/beta/network/test_conversation.py`
- `test/beta/network/test_discussion.py`
- `test/beta/network/test_expectations.py` (evaluator unit + handler integration via manual sweeper tick)
- `test/beta/network/test_observation.py` (skill render + capability index + `TaskMirror` end-to-end)
- `test/beta/network/test_hydrate_scale.py`

**Exit criteria:** two `AgentClient`s register through `LocalLink` and exchange raw envelopes; multi-party adapters run end-to-end driven by `TestConfig`-mocked LLM responses; expectation evaluators fire correctly; the audit log records the documented kinds; `Hub.hydrate()` correctness at 100×100 scale.

**Reviewer notes for PR2:**
- This is the largest PR. Reviewing by sub-area is encouraged: data types → adapters/views → hub → client.
- `client/hub_client.py` is shipped as a slim version: it does not import `.plugin` and does not attach a `NetworkPlugin` in `register()`. The `attach_plugin: bool = True` parameter is preserved for forward compatibility but does nothing in this PR — PR3 adds the import and the body block that uses it.
- `network/__init__.py` and `client/__init__.py` ship as slim versions: they re-export only what PR2 contributes. PR3 grows both with the LLM-tool surface re-exports.
- `test_consulting.py` ships in this PR without `test_delegate_tool_end_to_end` (which exercises Alice's LLM calling the `delegate` tool). PR3 restores that test alongside the tool surface it depends on.
- Consulting / conversation / discussion tests use `TestConfig` and `_ScriptedConfig` to mock LLM responses — they exercise the default notify handler's LLM-driven response path **without** the LLM-facing tool surface.

**Validation command:**
```
.venv-beta/bin/pytest test/beta/network/test_foundation.py test/beta/network/test_audit_and_lifecycle.py test/beta/network/test_consulting.py test/beta/network/test_conversation.py test/beta/network/test_discussion.py test/beta/network/test_expectations.py test/beta/network/test_observation.py test/beta/network/test_hydrate_scale.py -v
```

## PR3 — LLM tool surface + workflow

**Goal:** ship the LLM-facing presentation layer of the network. `NetworkPlugin` attaches six grouped tools (`say` / `delegate` / `peers` / `sessions` / `tasks` / `context`) to an `Agent` so the LLM can drive its own session participation. Also ships workflow handoff tools so `WorkflowAdapter`'s `ToolCalled` transitions can be triggered by the LLM. After this PR, agents can autonomously discover, delegate to, and orchestrate each other.

**Branch:** `feat/network-pr3-tools` off PR2.

**Files:**

New source files:
- `autogen/beta/network/client/plugin.py` (`NetworkPlugin`, `NetworkContextPolicy`, `register_workflow`)
- `autogen/beta/network/client/tools/__init__.py`
- `autogen/beta/network/client/tools/{say, delegate, peers, sessions, tasks, context, handoff}.py`

Modified files (re-exports + plugin attachment + restored test):
- `autogen/beta/network/__init__.py` (add `NetworkContextPolicy`, `NetworkPlugin` to re-exports)
- `autogen/beta/network/client/__init__.py` (add plugin + tool factories to re-exports)
- `autogen/beta/network/client/hub_client.py` (add `from .plugin import NetworkPlugin`; attach `NetworkPlugin` in `register()` when `attach_plugin=True`)
- `test/beta/network/test_consulting.py` (restore `test_delegate_tool_end_to_end` deferred from PR2)

Tests:
- `test/beta/network/test_hub_invariants.py` (registration / concurrency / dispatch / projection invariants — uses `make_delegate_tool` for race + fast-fail tests)
- `test/beta/network/test_tools.py` (per-action coverage of all 6 grouped tools)
- `test/beta/network/test_sweeper_and_registry.py` (background sweeper + registry isolation + cross-tool flow)
- `test/beta/network/test_workflow.py` (transition vocabulary unit + `WorkflowAdapter` integration + `register_workflow` handoff tools)
- `test/beta/providers/anthropic/test_network_smoke.py`
- `test/beta/providers/anthropic/test_workflow_smoke.py`

**Exit criteria:** Alice's LLM autonomously calls `peers(action="find", capability="math")` → `delegate(target="bob", ...)` → returns `"204"` for `"12 × 17"` (Anthropic smoke). Triage's LLM calls `transfer_to_eng` → eng's notify handler engages eng's LLM with the synthesised handoff prompt → eng's reply rotates control back to triage via `FromSpeaker(eng) → RevertToInitiatorTarget` → workflow state survives a mid-flow `Hub.hydrate()` → triage closes the session (Anthropic workflow smoke).

**Reviewer notes for PR3:**
- The three modified source files (`network/__init__.py`, `client/__init__.py`, `client/hub_client.py`) get small additive diffs that activate the surface PR2 already left a slot for. `client/hub_client.py`'s `attach_plugin` parameter (an inert no-op in PR2) becomes load-bearing here.
- `test_hub_invariants.py` ships here (not in PR2) because three of its tests use `make_delegate_tool` directly to exercise inbox-race and fast-fail scenarios — those depend on the tool's behaviour, not just on hub mechanics.
- `test_consulting.py` is modified to restore `test_delegate_tool_end_to_end`, which PR2 deferred because it requires the `delegate` tool from the plugin layer.
- `_helpers.py` ships in PR2; this PR's tests reuse the same `_ScriptedConfig` helper.

**Post-merge realignment (what actually shipped in #2776):**

PR2's review process expanded the PR materially beyond the originally-prepared content. Two new modules were added (`network/handoff.py`, `network/workflow_helpers.py`); the workflow adapter was rewritten around `Handoff`-typed tool returns + `EV_PACKET` envelopes (replacing the original `EV_HANDOFF`-envelope model); the `ChannelAdapter` Protocol grew three new methods (`extract_turn_input`, `build_round_envelope`, `render_envelope`) with `default_*` helpers; `EV_CONTEXT_SET` + workflow `context_vars` were introduced; `CHANNEL_STATE_DEP` + `ChannelStateInject` were added.

PR3's branch then acquired the following on top of the realigned PR2 base before squash-merging as `5c2247ebb77`:

| Commit | Theme |
|--------|-------|
| `ee811a03867` | Realign handoff tools to return `Handoff` instances; emit `EV_PACKET`; lint tidy |
| `291c30c87d5` | Route `handlers.py` through `HubClient` public surface (fixes `test_handlers_module_does_not_touch_hub_privates`) — adds `Hub.adapter_for` + `Hub.adapter_state` and `HubClient` delegates |
| (in PR3 review) | Wholesale `session → channel` rename across files, symbols, fields, and event types — see table below |
| (in PR3 review) | Removal of `client/tools/handoff.py` + `make_handoff_tool*` factories + `NetworkPlugin.register_workflow(graph)` |
| (in PR3 review) | Public `default_handlers()` factory for the violation-handler trio (`AuditHandler` + `NotifyChannelHandler` + `AutoCloseHandler`) |

**Two load-bearing API shifts in merged PR3:**

1. **`EV_HANDOFF` → `Handoff` typed return + `EV_PACKET`.** Tools that drive workflow next-speaker decisions used to post an `ag2.handoff` envelope; they now return a `Handoff(target=, reason=)` dataclass which the framework reads off the agent's local `ToolResultEvent` stream and folds into the round's `EV_PACKET`. Simpler tool authoring (no envelope semantics in user code), atomic round capture, clean place to attach context-variable mutations.

2. **`session` → `channel`.** The whole "Session" vocabulary was renamed throughout the network module. The motivation (from review): "channel" is the standard distributed-systems term for a protocol-bound multi-party message stream; "session" conflated with the unrelated authentication-session concept and was confusing in the context of long-lived workflows.

**Rename inventory (every symbol, file, field):**

| Old | New |
|-----|-----|
| `network/session.py` | `network/channel.py` |
| `network/client/session.py` | `network/client/channel.py` |
| `network/client/tools/sessions.py` | `network/client/tools/channels.py` |
| `Session` class | `Channel` |
| `SessionAdapter` Protocol | `ChannelAdapter` |
| `SessionInject` / `SessionStateInject` annotations | `ChannelInject` / `ChannelStateInject` |
| `SessionManifest` / `SessionMetadata` / `SessionState` | `ChannelManifest` / `ChannelMetadata` / `ChannelState` |
| `SessionTypeAccess` | `ChannelTypeAccess` |
| `SESSION_DEP` / `SESSION_STATE_DEP` constants | `CHANNEL_DEP` / `CHANNEL_STATE_DEP` |
| `EV_SESSION_*` event types | `EV_CHANNEL_*` (CLOSED / EXPIRED / INVITE / INVITE_ACK / INVITE_REJECT / OPENED) |
| `AUDIT_KIND_SESSION_*` audit kinds | `AUDIT_KIND_CHANNEL_*` (CREATED / CLOSED / EXPIRED) |
| `Envelope.session_id` field | `Envelope.channel_id` |
| Event-type prefix `ag2.session.` | `ag2.channel.` |
| `Hub.{get,close,list}_session(s)` | `{get,close,list}_channel(s)` |
| `HubClient.adapter_for(session_id)` (added in `291c30c87d5`) | `adapter_for(channel_id)` |
| `TaskMirror(session_id=)` | `TaskMirror(channel_id=)` |
| `ViewPolicy.project(session=metadata)` | `ViewPolicy.project(channel=metadata)` |
| `NotifySessionHandler` (in `hub/expectations.py`) | `NotifyChannelHandler` |
| `make_sessions_tool` (PR3 grouped tool factory) | `make_channels_tool` |

**Removed in PR3 review:**

| Removed | Replacement |
|---------|-------------|
| `client/tools/handoff.py` (whole file) | Users write their own `@tool` returning `Handoff(target=, reason=)` |
| `make_handoff_tool(client, name)` factory | — |
| `make_handoff_tools(handoffs: dict)` factory | — |
| `make_handoff_tools_for_graph(client, graph)` factory | — |
| `NetworkPlugin.register_workflow(graph)` method | — |

No graph-walking auto-materializer remains; the user authors handoff tools directly. The `ToolCalled` transition condition still exists for cases where the routing decision must be encoded in the graph instead of in the tool body.

**Validation command:**
```
.venv-beta/bin/pytest test/beta/network/test_hub_invariants.py test/beta/network/test_tools.py test/beta/network/test_sweeper_and_registry.py test/beta/network/test_workflow.py -v
.venv-beta/bin/pytest -m anthropic test/beta/providers/anthropic/test_network_smoke.py test/beta/providers/anthropic/test_workflow_smoke.py -v   # ~$0.01 against haiku
```

## Post-PR3 — Phase 2.0 + Phase 3 publication

The `network-design` branch carries Phase 2.0 + Phase 3 work that landed locally but pre-dates PR2's review additions. This section is the playbook for getting that work onto `main` after PR3 merges.

### What's staged on network-design beyond PR3

Group these by theme; each maps to a candidate PR (final PR boundaries decided when we cut them).

| Theme | Files | Tests | LOC |
|-------|-------|-------|----:|
| **Phase 2.0 — durability** | `client/checkpoint.py`, `agent_client.py` (resume_pending_turns, attach), `hub/core.py` (find_envelope_by_causation, pending_turns_for, evaluate_expectations, get_rule, mark_hidden, mark_removed, HubBackedCheckpointStore) | `test_durability_*` | ~1.0K |
| **Phase 2.0 — expectations + violation handlers** | `hub/expectations.py` (turn_within, progress_within, min_participation evaluators; warn/hide/remove handlers) | `test_expectations_*` | ~0.4K |
| **Phase 2.0 — task cancellation** | `task_mirror.py` (TaskCancelled), `client/tools/tasks.py` (cancel action), `EV_TASK_CANCELLED`, `ag2.task.cancel_request` envelope | `test_task_cancel_*` | ~0.3K |
| **Phase 2.0 — N-of-M quorum** | `hub/core.py` (required_acks, quorum_unreachable, ag2.session.quorum_changed, mark_removed) | `test_quorum_*` | ~0.5K |
| **Phase 2.0 — LLMSelectorTarget + classic Pattern migration** | `transitions.py` (LLMSelectorTarget, TransitionGraph.auto_pattern), `migration.py` (from_classic_pattern, UnsupportedPatternError) | `test_workflow_*`, `multiagent_orchestration/` (off-default Gemini-driven cross-paradigm parity suite) | ~0.5K |
| **Phase 3 M1 — streaming + safety + hooks** | `client/chunks.py` (ChunkSubscription, ChunkDelta), `client/session.py` (send_chunk, iter_chunks), `transport/frames.py` (ChunkFrame), `client/agent_client.py` (add_send_hook, add_receive_hook), `hub/rate_limiter.py` (token bucket) | streaming + hooks + rate-limit tests | ~0.7K |
| **Phase 3 M2 — wire transport + auth** | `transport/ws.py` (WsLink), `transport/http.py` (Starlette ASGI app, 10 CRUD routes), `auth.py` (ApiKeyAuth) | WsLink + HTTP + ApiKeyAuth tests | ~1.1K |
| **Phase 3 M3 — cross-process semantics** | `hub/core.py` (cursor write-through, Hello replay, NetworkChangedFrame broadcast, dispatch_audience hook), `transport/frames.py` (ReceiptFrame ack/nack wiring, NetworkChangedFrame), `client/handlers.py` (Receipt emission), `client/hub_client.py` (TTL'd discovery cache invalidated by NetworkChangedFrame), `adapters/workflow.py` (dispatch_audience override) | cursor-replay + cache-invalidation + audience-narrowing tests | ~0.9K |

Tally: roughly +5.4K source / +3.2K test across the eight themes, +1.5K parity suite. Test counts already on `network-design`: 1691 passing in the beta suite.

### Reconciliation order

`network-design` was branched **before** PR2's review additions and pre-dates the entire PR3 merge, so the rebase surface is substantial. The rename alone touches 34 files in `autogen/beta/network/` (heaviest: `hub/core.py` with 301 occurrences, `hub/expectations.py` 62, `agent_client.py` 54, `session.py` 41). Plan the work as four sequential phases — each its own commit — so reviewers can read them independently:

**Phase A — `session → channel` rename pass (one commit, mostly mechanical).**

Use a scripted sweep, then verify by re-running the suite. Order matters because some renames are subsets of others:

1. Rename files first (so subsequent edits target the right paths):
   - `git mv autogen/beta/network/session.py autogen/beta/network/channel.py`
   - `git mv autogen/beta/network/client/session.py autogen/beta/network/client/channel.py`
   - `git mv autogen/beta/network/client/tools/sessions.py autogen/beta/network/client/tools/channels.py`
   - Rename matching test files (e.g. `test_session_smoke.py` stays for the historical-test-name convention used in merged main — check before renaming).
2. Symbol pass — apply in this order so partial matches don't collide:
   - `SESSION_STATE_DEP` → `CHANNEL_STATE_DEP` (most specific first)
   - `SESSION_DEP` → `CHANNEL_DEP`
   - `EV_SESSION_INVITE_ACK` → `EV_CHANNEL_INVITE_ACK`, then `EV_SESSION_INVITE_REJECT`, then `EV_SESSION_INVITE`, then the rest of `EV_SESSION_*`
   - `AUDIT_KIND_SESSION_CREATED` / `_CLOSED` / `_EXPIRED` → `AUDIT_KIND_CHANNEL_*`
   - `SessionTypeAccess` → `ChannelTypeAccess`, `SessionStateInject` → `ChannelStateInject`, `SessionInject` → `ChannelInject`
   - `SessionAdapter` → `ChannelAdapter`, `SessionManifest` → `ChannelManifest`, `SessionMetadata` → `ChannelMetadata`, `SessionState` → `ChannelState`
   - `Session` (the client class) → `Channel`. Be careful: many docstrings say "session" the *concept* — use word-boundary regex and review each hit.
   - `NotifySessionHandler` → `NotifyChannelHandler`
   - `make_sessions_tool` → `make_channels_tool`
3. Field/parameter pass:
   - `session_id=` → `channel_id=` (keyword args), `session_id:` → `channel_id:` (annotations), `.session_id` → `.channel_id` (attribute reads), `["session_id"]` → `["channel_id"]` (dict keys), `'session_id'` → `'channel_id'`
   - `session=metadata` → `channel=metadata` in `ViewPolicy.project` callers
   - `TaskMirror(session_id=` → `TaskMirror(channel_id=`
4. Event-type string pass:
   - `"ag2.session.` → `"ag2.channel.` (and the single-quote variants)
5. Method-name pass on Hub / HubClient call sites:
   - `get_session(` → `get_channel(`, `close_session(` → `close_channel(`, `list_sessions(` → `list_channels(`
6. Documentation pass on prose in docstrings — leave the word "session" where the surrounding sentence is talking about an authentication session, an HTTP session, or the concept abstractly; rename only where the code-level type is meant.
7. Run `pytest test/beta/network/` and `ruff check autogen/beta/network/` to catch missed renames; expect a long iteration loop the first time.

Goal: zero behavioural change in this commit. Diff should be all renames; new logic stays out.

**Phase B — drop deleted APIs (one commit).**

Removed in PR3 review:

- `autogen/beta/network/client/tools/handoff.py` — delete the file.
- `make_handoff_tool` / `make_handoff_tools` / `make_handoff_tools_for_graph` — remove all imports + `__all__` entries.
- `NetworkPlugin.register_workflow(graph)` method — delete.
- `transitions.py:454`-style docstrings that reference `NetworkPlugin.register_workflow` — rewrite to point at user-authored `@tool` returning `Handoff`.
- Update Phase 2 `TransitionGraph.auto_pattern` docstring: the auto-materializer is gone; document that callers must hand-write Handoff-returning tools matching the names in `handoff_tools`, **or** consider extending `auto_pattern` to return `(graph, tools)` so users can drop both into `agent.tools`. The second option is the better ergonomics — recommend revisiting before the Phase 2.0 PR ships.

**Phase C — architectural reconciliation with PR2-review additions (one or two commits).**

The `Handoff`/`EV_PACKET` model + new `ChannelAdapter` Protocol methods need real merging on these files:

1. **`envelope.py`** — drop `EV_HANDOFF`. Use `EV_PACKET` (one Agent.ask round) and `EV_CONTEXT_SET` (workflow context_vars). Verify nothing on `network-design` still imports `EV_HANDOFF`.
2. **`adapters/workflow.py`** — `WorkflowAdapter` was rewritten in PR2 review. Phase 3's `dispatch_audience` hook becomes an override on the new class. Phase 2.0's `LLMSelectorTarget` integration with the `Handoff` return type (selector's LLM picks the next speaker via a tool that returns `Handoff(target=...)`) replaces any EV_HANDOFF-driven path.
3. **`adapters/base.py`** — `ChannelAdapter` Protocol gained 3 methods (`extract_turn_input`, `build_round_envelope`, `render_envelope`) and 3 default helpers. Anything Phase 2/3 work added to this file must be reapplied as additions on top of the new shape.
4. **`client/handlers.py`** — base handler is now adapter-agnostic (`_process_substantive`, not `_process_text`). Phase 3's `add_send_hook` / `add_receive_hook` wrap the new substantive path. `CHANNEL_STATE_DEP` is stamped — Phase 2/3 code that read adapter state via the old `_hub._adapter_states.get(...)` must instead inject `CHANNEL_STATE_DEP` (or call `client._hub_client.adapter_state(channel_id)` per the PR3 fix).
5. **`transitions.py`** — merge `LLMSelectorTarget` (ours) with `ContextEquals` + `WorkflowGraphError` (theirs). Both go in the same `__all__`.
6. **`migration.py`** (`from_classic_pattern`) — `auto_pattern` no longer auto-materializes tools; either tighten its contract (return `(graph, tools)`) or document the new requirement. The `multiagent_orchestration/` parity suite is the load-bearing acceptance test for this.
7. **`hub/core.py`** — large diff because both sides changed it. Phase 2.0 quorum + durability primitives + Phase 3 cursor/audience/network-changed work need to graft onto PR2's review additions (access/dispatch fixes, async ctx-mgr support, receive-loop resilience). Walk each Phase 2.0 commit and reapply atomically.
8. **`hub/expectations.py`** — Phase 2.0 added `turn_within` / `progress_within` / `min_participation` evaluators + `warn` / `hide` / `remove` handlers. PR2 review made the evaluator registry public + introduced `default_evaluators()` / `default_handlers()` factories. `_expectation_tick` was promoted to `evaluate_expectations()`.
9. **Clean adds (rebase mechanically):** `client/checkpoint.py`, `client/chunks.py`, `transport/ws.py`, `transport/http.py`, `hub/rate_limiter.py`, `auth.py` ApiKeyAuth, `migration.py`, `multiagent_orchestration/`. None of these files exist on main, so they drop in as new files — but each needs the Phase A rename pass before it makes sense.

**Phase D — verification.**

1. Run `pytest test/beta/ --ignore=test/beta/smoke --ignore=test/beta/providers` — target zero regressions against the 1739-pass baseline.
2. Run `pytest test/beta/network/` separately and check counts match (merged main ships ~133 network tests in `test/beta/network/` plus additions from PR2 review's test files; ours adds Phase 2/3 tests on top).
3. Run the `multiagent_orchestration/` parity suite (off-default, Gemini-driven) — load-bearing acceptance evidence that `from_classic_pattern` still works.
4. `ruff check` + `ruff format --check` clean.

**Phase E — design doc sync.**

   - `design/envelope.md` — replace the `EV_HANDOFF` row with `EV_PACKET` + `EV_CONTEXT_SET`; rename `session_id` references to `channel_id`.
   - `design/sessions.md` → rename file to `design/channels.md`; rewrite "Session"-named symbols throughout. Document the new `ChannelAdapter` Protocol surface (`extract_turn_input` / `build_round_envelope` / `render_envelope`) + `CHANNEL_STATE_DEP` / `ChannelStateInject`.
   - `design/workflow.md` — describe the `Handoff`-typed-return model + `EV_PACKET` round capture; remove the `event_type=="ag2.handoff"` references and the `NetworkPlugin.register_workflow` references; document that handoff tools are now user-authored.
   - `design/network_plugin.md` — drop the `register_workflow(graph)` documentation; replace with "write your own `@tool` returning `Handoff`" guidance.
   - `design/PLAN.md` M4 section — add a deviation note that PR2/PR3 review rewrote handoff semantics; the M4 section's `EV_HANDOFF` references are historical.
   - `design/PLAN.md` Phase 3 Cut 3.3 — `dispatch_audience` for `EV_TEXT / EV_PACKET` (not `EV_HANDOFF`).
   - `design/clients.md` — `Session` → `Channel`; `client/session.py` → `client/channel.py`.
   - `design/hub.md` — `get_session` → `get_channel` etc.
   - Any other doc that mentions "session" the type rather than "session" the concept — search and fix.

### Suggested PR split

Given the size, ship in **4 stacked PRs**. The first is a pure-rebase prep PR landing the Phase A+B+C+E reconciliation; the next three carry Phase 2/3 feature commits exactly as on `network-design`:

| PR | Theme | Stacks on | Approx LOC |
|----|-------|-----------|-----------:|
| PR4 | `network-design` rebase prep — `session → channel` rename pass + drop deleted APIs + reconcile Phase 2/3 with PR2-review's adapter Protocol additions | `main` (post-PR3) | ~0 net behavioural change (rename is mechanical; reconciliation re-applies existing intent against new shape) |
| PR5 | Phase 2.0 — durability + expectations + cancellation + quorum + classic Pattern migration (+ `auto_pattern` adjustment for the missing handoff materializer) | PR4 | ~3.0K source + ~2.0K test |
| PR6 | Phase 3 M1 — streaming + safety + hooks + rate limiter | PR5 | ~0.7K source + ~0.6K test |
| PR7 | Phase 3 M2 + M3 — wire transport + auth + cross-process semantics | PR6 | ~2.0K source + ~1.3K test |

The split logic:

- **PR4 is its own PR** because the rename pass is large, mechanical, and easier to review on its own (no Phase 2/3 commits muddled in). Reviewer can verify the diff is "rename only" with `git diff --stat` and a few spot-checks. Should land in days, not weeks.
- **PR5 / PR6 / PR7** are then clean stacked PRs each landing one theme on top of the rebased base.

If PR4 feels too big despite being mostly mechanical, it can split further:
- PR4a: Phase A rename only (no architectural change)
- PR4b: Phase B + C (drop deleted APIs + adapter Protocol reconciliation)
- PR4c: Phase E design doc sync

But this only helps reviewers if each sub-PR is independently testable; the rename pass alone changes nothing observable (tests still pass), so PR4a is verifiable on its own. PR4b is where the real reconciliation happens.

### Rebase vs merge

For the network-design → post-PR3-main reconciliation, **rebase** is preferred over three-way merge:

- Linear history makes the post-PR3 reconciliation easier to review commit-by-commit.
- The Phase 2.0 commits on `network-design` are already cleanly separated by theme (`eb7251890cb`, `d4fffb63070`, `d66289ffcb8`, `a8156de6373`, `e835e8e259f`); reapplying each in order during interactive rebase is the natural unit.
- A merge would obscure which Phase 2.0 commit caused which conflict.

The rebase will be conflict-heavy (especially for `hub/core.py`, `adapters/workflow.py`, `transitions.py`, `client/handlers.py`); plan a half-day for it.

### What stays out

- `design/` is excluded from PRs 4–6 (same rule as PRs 1–3 — internal reference, not part of the V1 contract).
- Examples (`notification`, `broadcast`, `auction` adapters; saga skeleton; transform stdlib) ship to `examples/` separately — they prove extensibility, they are not framework-core.

## Operational steps

These commands reproduce the published stack from `network-design`:

```bash
# PR1 — Task primitive (framework-core)
git checkout --no-track -b feat/network-pr1-task origin/main
git checkout network-design -- \
    autogen/beta/__init__.py \
    autogen/beta/agent.py \
    autogen/beta/events/__init__.py \
    autogen/beta/events/task_events.py \
    autogen/beta/task.py \
    test/beta/test_task.py
git commit -m "feat(beta): add Task lifecycle primitive"
git push -u origin feat/network-pr1-task

# PR2 — Network protocol + state + control plane
git checkout --no-track -b feat/network-pr2-protocol feat/network-pr1-task
git checkout network-design -- \
    autogen/beta/network/__init__.py \
    autogen/beta/network/{ids,errors,policies,identity,auth,envelope,rule,session,transitions,task_mirror}.py \
    autogen/beta/network/transport/{__init__,frames,link,local}.py \
    autogen/beta/network/views/{__init__,base,builtin}.py \
    autogen/beta/network/adapters/{__init__,base,consulting,conversation,discussion,workflow}.py \
    autogen/beta/network/hub/{__init__,audit,core,expectations,layout,sweepers}.py \
    autogen/beta/network/client/{__init__,network_client,agent_client,session,task,inject,handlers,skill_render,hub_client}.py \
    test/beta/network/{__init__,_helpers,test_foundation,test_audit_and_lifecycle,test_consulting,test_conversation,test_discussion,test_expectations,test_observation,test_hydrate_scale}.py

# Apply slim edits (cannot ship at HEAD because plugin/tools land in PR3):
#   - network/__init__.py: drop `NetworkContextPolicy` and `NetworkPlugin` from .client import + __all__
#   - client/__init__.py: drop `from .plugin import NetworkPlugin` and the matching __all__ entries
#   - client/hub_client.py: drop `from .plugin import NetworkPlugin`; remove the plugin attachment block
#       in register() but keep the `attach_plugin: bool = True` parameter as a forward-compatibility no-op
#   - test_consulting.py: remove the `test_delegate_tool_end_to_end` test (it depends on the delegate tool)
git commit -m "feat(beta/network): protocol, state, and control plane"
git push -u origin feat/network-pr2-protocol

# PR3 — LLM tool surface + workflow
git checkout --no-track -b feat/network-pr3-tools feat/network-pr2-protocol
git checkout network-design -- \
    autogen/beta/network/__init__.py \
    autogen/beta/network/client/__init__.py \
    autogen/beta/network/client/hub_client.py \
    autogen/beta/network/client/plugin.py \
    autogen/beta/network/client/tools/__init__.py \
    autogen/beta/network/client/tools/{say,delegate,peers,sessions,tasks,context,handoff}.py \
    test/beta/network/test_consulting.py \
    test/beta/network/test_hub_invariants.py \
    test/beta/network/test_tools.py \
    test/beta/network/test_sweeper_and_registry.py \
    test/beta/network/test_workflow.py \
    test/beta/providers/anthropic/test_network_smoke.py \
    test/beta/providers/anthropic/test_workflow_smoke.py
git commit -m "feat(beta/network): LLM tool surface and workflow"
git push -u origin feat/network-pr3-tools
```

The four cross-PR-modified files are restored to HEAD state in PR3 by checking them out from `network-design` — they overwrite the slim PR2 versions, which is what we want.

### PR creation + body updates

PRs are created manually in the GitHub UI to set the right base branch. Bodies are updated via the REST API rather than `gh pr edit` because the latter trips over the deprecated classic-Projects GraphQL field on this repo:

```bash
gh api -X PATCH /repos/ag2ai/ag2/pulls/<number> -f body="$(cat /tmp/pr_body.md)"
```

Each body follows this skeleton (no `design/`, milestone, or phase references):

```
**Stacks on:** #<prior-PR>     # PR2 / PR3 only

## Why are these changes needed?
<purpose + scope, 2-3 paragraphs>

## What ships
<bullet groups by area>

## Test plan
<commands + pass counts>

## Related issue number
N/A — internal V1 contract.

## Checks
- [ ] doc / [x] tests / [ ] auto checks

## AI assistance
- [ ] understand / [ ] verified diff / [ ] reviewed AI output
```

## Dependency graph reference

```
origin/main
    └── PR1 (Task primitive)
        └── PR2 (network protocol + state + control plane)
            └── PR3 (LLM tool surface + workflow)
```

When merging:
1. PR1 lands → rebase PR2 onto `main`, fast-forward.
2. PR2 lands → rebase PR3 onto `main`, fast-forward.

GitHub UI handles the rebase if each PR is mergeable into the next. Squash-on-merge keeps `main` history at 3 commits.

## Cross-PR file modifications

Four files are altered in PR2 and modified back to HEAD state in PR3.

### `autogen/beta/network/__init__.py`

PR2 ships this file with the re-export block restricted to the symbols defined in PR2. PR3 adds re-exports for `NetworkContextPolicy`, `NetworkPlugin`, and (transitively, via `client/__init__.py`) the tool factory functions.

### `autogen/beta/network/client/__init__.py`

PR2 ships this file with re-exports for `AgentClient`, `HubClient`, `NetworkClient`, `Session`, `ClientTask`, `default_handler`, dependency-injection annotations, and skill-render helpers. PR3 adds `NetworkPlugin`, `NetworkContextPolicy`, and the tool factories (`make_say_tool` / `make_delegate_tool` / `make_peers_tool` / `make_sessions_tool` / `make_tasks_tool` / `make_context_tool` / `make_handoff_tool` / `make_handoff_tools_for_graph`).

### `autogen/beta/network/client/hub_client.py`

PR2 ships this file without the `from .plugin import NetworkPlugin` import and without the plugin-attachment block in `register()`. The `attach_plugin: bool = True` parameter is **kept** in PR2 as a forward-compatibility no-op (with a docstring note explaining that the LLM-facing tool surface lands later) so existing callers can pass `attach_plugin=False` without `TypeError`. PR3 adds the import and the five-line block in `register()` that constructs a `NetworkPlugin` and attaches it to the agent.

### `test/beta/network/test_consulting.py`

PR2 ships this file without `test_delegate_tool_end_to_end`. That test exercises Alice's LLM calling the `delegate` tool via `TestConfig`-mocked tool responses, which only works once the plugin layer attaches the `delegate` tool to `agent.tools`. PR3 restores the test verbatim from the `network-design` branch.
