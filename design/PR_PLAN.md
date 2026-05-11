# AG2 Network — PR Publication Plan

This document describes how the `network-design` work is published to `main`. Phase 1 shipped as three stacked pull requests (PR1–PR3). Stabilization for the v1.X minor-version release ships as two follow-up stacked PRs (PR4–PR5) detailed in [Post-PR3](#post-pr3--stabilization-for-the-v1x-minor-version-release). Phase 2 / Phase 3 publication is deferred and re-planned after stabilization lands.

Source of truth for the design itself is [PLAN.md](PLAN.md). This file only covers **how the work ships**.

## Status

| PR | Number | Branch | Title | State |
|----|-------:|--------|-------|-------|
| PR1 | [#2774](https://github.com/ag2ai/ag2/pull/2774) | `feat/network-pr1-task` | `feat(beta): add Task lifecycle primitive` | ✅ merged |
| PR2 | [#2775](https://github.com/ag2ai/ag2/pull/2775) | `feat/network-pr2-protocol` | `feat(beta/network): protocol, state, and control plane` | ✅ merged |
| PR3 | [#2776](https://github.com/ag2ai/ag2/pull/2776) | `feat/network-pr3-tools` | `feat(beta/network): LLM tool surface and workflow` | ✅ merged (`5c2247ebb77`) |
| PR4 | _tbd_ | `feat/network-pr4-foundation` | `feat(beta/network): HumanClient + observability foundation` | 🟢 ready to push (2 commits, 281 unit + 17 anthropic smokes passing) |
| PR5 | _tbd_ | `feat/network-pr5-adapter-tools-and-subclass` | `feat(beta/network): adapter-owned tools + subclass surface` | 🟢 ready to push (1 commit, 298 unit + 17 anthropic smokes passing) |

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
| PR3 | Channel participation tools + workflow | PR2 | ~1.1K | ~2.5K | 59 + 2 anthropic |

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

**Goal:** ship the entire network module **except** the LLM-facing tool surface. After this PR, agents can register through a hub, exchange envelopes inside protocol-defined sessions (consulting / conversation / discussion / workflow), participate in turn-taking via the default notify handler, and observe each other's tasks — all by writing tenant code that calls `Channel.send()` and similar methods directly. The 6 LLM-facing tools (`say`, `delegate`, `peers`, `sessions`, `tasks`, `context`) and `NetworkPlugin` arrive in PR3.

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

2. **`session` → `channel`.** The whole "Channel" vocabulary was renamed throughout the network module. The motivation (from review): "channel" is the standard distributed-systems term for a protocol-bound multi-party message stream; "channel" conflated with the unrelated authentication-session concept and was confusing in the context of long-lived workflows.

**Rename inventory (every symbol, file, field):**

| Old | New |
|-----|-----|
| `network/session.py` | `network/channel.py` |
| `network/client/session.py` | `network/client/channel.py` |
| `network/client/tools/sessions.py` | `network/client/tools/channels.py` |
| `Channel` class | `Channel` |
| `ChannelAdapter` Protocol | `ChannelAdapter` |
| `ChannelInject` / `ChannelStateInject` annotations | `ChannelInject` / `ChannelStateInject` |
| `ChannelManifest` / `ChannelMetadata` / `ChannelState` | `ChannelManifest` / `ChannelMetadata` / `ChannelState` |
| `ChannelTypeAccess` | `ChannelTypeAccess` |
| `CHANNEL_DEP` / `CHANNEL_STATE_DEP` constants | `CHANNEL_DEP` / `CHANNEL_STATE_DEP` |
| `EV_SESSION_*` event types | `EV_CHANNEL_*` (CLOSED / EXPIRED / INVITE / INVITE_ACK / INVITE_REJECT / OPENED) |
| `AUDIT_KIND_SESSION_*` audit kinds | `AUDIT_KIND_CHANNEL_*` (CREATED / CLOSED / EXPIRED) |
| `Envelope.channel_id` field | `Envelope.channel_id` |
| Event-type prefix `ag2.session.` | `ag2.channel.` |
| `Hub.{get,close,list}_session(s)` | `{get,close,list}_channel(s)` |
| `HubClient.adapter_for(channel_id)` (added in `291c30c87d5`) | `adapter_for(channel_id)` |
| `TaskMirror(channel_id=)` | `TaskMirror(channel_id=)` |
| `ViewPolicy.project(session=metadata)` | `ViewPolicy.project(channel=metadata)` |
| `NotifyChannelHandler` (in `hub/expectations.py`) | `NotifyChannelHandler` |
| `make_channels_tool` (PR3 grouped tool factory) | `make_channels_tool` |

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

## Post-PR3 — Stabilization for the v1.X minor-version release

Phase 1 shipped the protocol, state machine, control plane, LLM tool surface, and workflow orchestration. Stabilization takes that surface from "code complete" to production-ready for single-process multi-agent use — the foundation of a minor-version release. Phase 2 / Phase 3 follow-ups are deferred and will be re-planned once stabilization lands.

### Goals

1. **Native human-in-the-loop.** `HumanClient` as a peer to `AgentClient` so non-LLM participants register, participate in channels, and send/receive envelopes through the same surface. Push (callback) and pull (`next_envelope` / `envelopes` async iterator) modes for embedder UIs. Unblocks the anthropic workflow smokes that today fake a human via direct `agent.ask`.
2. **Observability.** `HubListener` Protocol for read-only state-transition notifications (envelope posted, channel opened/closed, agent registered, expectation fired, dispatch failed, turn failed, task event). Existing `AuditLog` becomes one listener. Notify-handler exceptions are trapped and routed through the listener + audit log instead of disappearing silently. Hub-level Python logging. `Hub.health()` returns an operational snapshot.
3. **Decision-making seam.** `HubArbiter` Protocol replaces the inline access/limits checks in `Hub.post_envelope`. Default `RuleBasedArbiter` preserves current behavior; the seam is what later admits federation, JWT-scope, or custom permission protocols without forking the hub.
4. **Adapter-owned tool surface.** Each `ChannelAdapter` declares its applicable LLM tools (`tools_for(client, channel_id, participant_id)`) plus Layer-2 envelope helpers (`build_text_envelope`, `build_packet_envelope`, …) framework-agnostic clients can call directly. `NetworkPlugin` shrinks to cross-cutting tools (`peers`, `channels`, `tasks`, `context`). `say` moves into consulting/conversation/discussion adapters; workflow ships no `say`. `channels(action="open", message=...)` accepts a seed for atomic open-and-send. Eliminates the structural conflict where an LLM in a workflow channel calls `say` and gets a `ProtocolError`.
5. **Subclass-friendly Hub.** Empty `on_*` lifecycle hooks (envelope posted, channel events, agent events, task events) Hub fires for subclasses to override. `Hub.register_sweeper(name, interval, callable)` for periodic work. Audit kinds become an open set. Out-of-tree Hub subclasses (chat-platform-backed deployments, custom storage layouts) become viable without monkey-patching. No specific subclasses ship in this repo.
6. **Latent bug pass.** `TaskMirror` no longer swallows hub-side failures silently. `_causation_index` pruned on terminal channel transition (fixes unbounded growth on long-lived hubs). Inbox-pressure surfaced via `HubListener`.

### PR split

Stabilization ships as two stacked PRs. Each is independently mergeable. Branching: `PR4 ← main`, `PR5 ← PR4`.

| PR | Theme | Stacks on | Approx LOC |
|----|-------|-----------|-----------:|
| PR4 | HumanClient + `Passport.kind` + observability foundation (`HubListener` + `HubArbiter` + handler exception trap + hub logging + `Hub.health()`) | `main` (post-PR3) | ~1.8K source / ~1.0K test |
| PR5 | Adapter-owned tools + Layer-2 envelope helpers + Hub subclass surface + latent bug fixes | PR4 | ~1.5K source / ~1.2K test |

The bundling reflects the dependency picture: PR5's `TaskMirror` error escalation, inbox-pressure surfacing, and adapter-tool resolution all want a working `HubListener` Protocol to publish through. Folding the observability layer into PR4 means PR5 can land cleanly on top without protocol-layer cross-PR coordination.

#### PR4 — HITL + observability foundation

**Goal:** non-LLM participants register and participate as first-class citizens, and every hub state transition becomes observable. Operators can subscribe to envelopes / channel events / agent events / expectation fires / dispatch failures / handler crashes / task events; the inline access-control logic becomes a swappable `HubArbiter` so federation / JWT / custom permission protocols slot in later without forking the hub.

**Files:**

*HumanClient + Passport.kind:*

- New: `autogen/beta/network/client/human_client.py` — `HumanClient` class. Implements `NetworkClient`; exposes `send`, `open`, `close_channel`, `post_envelope`, `on_envelope(callback)`, `next_envelope(predicate=, timeout=)`, `envelopes()` (async iterator), `disconnect`. No `Agent`, no `NetworkPlugin`, no `NetworkContextPolicy`. `open()` returns the same `Channel` handle `AgentClient.open()` returns. Auto-acks channel invites by default so adapter-driven handshakes complete without UI round-trips.
- Modified: `autogen/beta/network/identity.py` — add `Passport.kind: Literal["agent", "human", "remote_agent"] | None = None`. `None` ≡ `"agent"` for back-compat; `"remote_agent"` is reserved (no implementation yet, just the value).
- Modified: `autogen/beta/network/client/hub_client.py` — add `register_human(passport, *, resume=None, rule=None, auto_ack_invites=True) -> HumanClient`. `register()` rejects `kind="human"` with a guidance error pointing at `register_human`.
- Modified: `autogen/beta/network/hub/core.py` — `list_agents` accepts an optional `kind` filter so discovery tools can scope by participant type.
- Modified: `autogen/beta/network/__init__.py` + `autogen/beta/network/client/__init__.py` — re-export `HumanClient`.

*Observability + decision-making seam:*

- New: `autogen/beta/network/hub/listener.py` — `HubListener` Protocol with methods `on_envelope_posted`, `on_envelope_rejected`, `on_dispatch_failed`, `on_channel_event`, `on_agent_event`, `on_expectation_fired`, `on_turn_failed`, `on_task_event`, `on_inbox_pressure`. All methods are async with a default `pass` so subclasses only override what they need.
- New: `autogen/beta/network/hub/arbiter.py` — `HubArbiter` Protocol (`authorize_send`, `authorize_register`, `authorize_channel_open`, `resolve_unknown_audience`) with `Decision` / `Allow` / `Deny` return type. `RuleBasedArbiter` default impl lifts the existing inline checks (per-agent `Rule.access` / `Rule.limits`, delegation depth, inbox cap).
- Modified: `autogen/beta/network/hub/core.py`:
  - `Hub.register_listener(listener)` / `unregister_listener(listener)` / `Hub.register_arbiter(arbiter)`.
  - Inline access logic in `post_envelope` delegates to `self._arbiter.authorize_send(...)`.
  - Listener fan-out at every state transition (per-listener try/except so one buggy listener doesn't break dispatch).
  - `Hub.health() -> dict` — `{active_channels, registered_agents, pending_inbox_total, audit_log_bytes, oldest_pending_envelope_age_s}`.
  - `logger = logging.getLogger(__name__)` wired: INFO (state changes), DEBUG (envelope flow), WARNING (rejections), ERROR (unexpected).
- Modified: `autogen/beta/network/hub/audit.py` — `AuditLog` becomes a `HubListener` implementation. Default hub installs it automatically. `AuditLog.subscribe(callback)` lets callers tail audit events live without polling the file.
- Modified: `autogen/beta/network/client/handlers.py` — wrap `agent.ask` and `build_round_envelope` in `_process_substantive` with `try/except`. On exception: emit `on_turn_failed` listener event, write audit entry, do not crash the receive loop.

*Tests + smokes:*

- New: `test/beta/network/test_human_client.py` — register, push + pull surfaces, consulting (human as respondent + as initiator), discussion with a human participant, kind-filter on `list_agents`, post-disconnect raise, callback exception isolation, chunk no-op.
- New: `test/beta/network/test_listener.py` — listener fan-out across all event kinds; faulty listener does not break dispatch.
- New: `test/beta/network/test_arbiter.py` — `RuleBasedArbiter` matches the prior inline behavior; a swappable arbiter can deny / route differently.
- New: `test/beta/network/test_handler_exception_trap.py` — `agent.ask` raising produces an audit + listener event; channel stays alive; subsequent envelopes flow.
- New: `test/beta/network/test_health.py` — `Hub.health()` returns sensible counters on a populated hub.
- Modified: `test/beta/providers/anthropic/test_workflow_smoke.py` — `HumanClient` seeds the initial turn (replaces the `agent.ask` shortcut that bypassed the network).

**Exit criteria:**

- Anthropic workflow smoke passes via `HumanClient` seeding the initial turn.
- An `AgentClient` opens consulting against a `HumanClient`; the agent blocks until the human's reply.
- Default `audit.jsonl` content is byte-identical to the prior baseline for the same input sequence (`AuditLog`-as-listener is a refactor, not behavior change).
- A registered `HubListener` receives every documented event on a small end-to-end run; a faulty listener does not break dispatch.
- A handler raising `RuntimeError` produces an audit entry + `on_turn_failed` event; the channel does not crash; the next envelope flows.
- `Hub.health()` returns sensible values on a 3-channel / 5-agent hub.

#### PR5 — Adapter-owned tools + subclass surface + latent fixes

**Goal:** resolve the structural `say`-in-workflow conflict by making each `ChannelAdapter` the source of truth for which LLM tools its protocol accepts. Layer-2 envelope helpers let non-AG2 clients construct correctly-shaped envelopes without going through the AG2 tool decorator. Hub becomes subclassable without monkey-patching, and three latent bugs (TaskMirror silent failure, unbounded causation index, missing inbox-pressure signal) close out.

Three layers, only the third is AG2-LLM-specific:

```
Layer 1: Capabilities       — HubClient / Channel / adapter helpers (Python methods)
Layer 2: Envelope helpers   — adapter.build_text_envelope / build_packet_envelope etc.
                              (pure constructors; any client uses them)
Layer 3: LLM-tool wrappers  — JSON-schema callables (AG2-specific; presentation only)
```

**Files:**

*Adapter-owned tools + envelope helpers:*

- Modified: `autogen/beta/network/adapters/base.py`:
  - Add `tools_for(client, channel_id, participant_id) -> list[Tool]` to `ChannelAdapter` Protocol with a `default_tools_for` returning `[]`.
  - Add Layer-2 envelope helpers: `build_text_envelope(channel_id, sender_id, text, *, audience=None, causation_id=None) -> Envelope`, `build_packet_envelope(channel_id, sender_id, body, *, handoff=None, context_set=None, audience=None, causation_id=None) -> Envelope`. Defaults provided as module-level helpers so adapters that don't customize can re-export.
- Modified: `autogen/beta/network/adapters/consulting.py`, `conversation.py`, `discussion.py` — return `[make_say_tool(client)]` from `tools_for` (for consulting / discussion, gated by adapter state so only the participant whose turn it is sees `say`).
- Modified: `autogen/beta/network/adapters/workflow.py` — `tools_for` returns `[]`. Handoff tools stay user-authored (the `Handoff`-returning `@tool` pattern is unchanged).
- Modified: `autogen/beta/network/client/plugin.py`:
  - `NetworkPlugin` attaches only `peers` / `channels` / `tasks` / `context` / `delegate` (identity-level tools). `say` moves into the adapter-provided set.
  - `NetworkContextPolicy` stops hardcoding the tool list; renders dynamic identity + active-channel info only.
- Modified: `autogen/beta/network/client/handlers.py` — `_process_substantive` resolves `adapter.tools_for(client, channel_id, participant_id)` and merges into the per-call tool override passed to `agent.ask`.
- Modified: `autogen/beta/network/client/tools/channels.py` — `channels(action="open", ...)` accepts `message: str | None = None`. When set, hub posts the seed envelope on the initiator's behalf after the channel transitions to `OPENED`.
- Modified: `autogen/beta/network/client/tools/say.py` — `make_say_tool` consults the adapter via `adapter.build_text_envelope` so the tool produces an adapter-shaped envelope regardless of channel type.

*Hub subclass surface:*

- Modified: `autogen/beta/network/hub/core.py`:
  - Empty `async def on_envelope_posted(envelope, metadata)` and siblings (`on_channel_opened`, `on_channel_closed`, `on_agent_registered`, `on_agent_unregistered`, `on_task_event`, `on_expectation_fired`) — Hub fires after the corresponding `HubListener` event; subclasses override directly without registering themselves.
  - `Hub.register_sweeper(name, interval_seconds, callable)` extends the existing `_IntervalSweeper` mechanism. `unregister_sweeper(name)` for symmetry.
- Modified: `autogen/beta/network/hub/audit.py` — document that audit kinds are an open set; subclasses append their own without modifying built-in constants.

*Latent bug fixes:*

- Modified: `autogen/beta/network/hub/core.py`:
  - Prune `_causation_index[channel_id]` on terminal transition (`_transition_channel`) and `mark_removed`. Memory growth fix on long-lived channels.
  - Fire `on_inbox_pressure(agent_id, pending_count)` when the count crosses a configurable high-water mark (`LimitsBlock.inbox.high_water` — defaults to 80% of cap, `None` disables). Routes through the `HubListener` introduced in PR4.
- Modified: `autogen/beta/network/task_mirror.py` — replace the swallow-everything `except Exception` in the hub-observation path with: log at ERROR, fire `on_task_event(task_id, "mirror_failed", payload)` through the hub's listeners. The mirror still never crashes the agent's turn (best-effort) but failures are no longer invisible.

*Tests:*

- New: `test/beta/network/test_tool_layering.py` — workflow agents do not see `say`; consulting / conversation / discussion agents do; bridge calling `adapter.build_packet_envelope` directly drives a workflow turn end-to-end.
- New: `test/beta/network/test_envelope_helpers.py` — Layer-2 helpers produce envelopes that round-trip through `Hub.post_envelope` for every adapter.
- New: `test/beta/network/test_subclass_surface.py` — `class MyHub(Hub)` overriding `on_envelope_posted` sees every envelope; custom sweeper runs.
- New: `test/beta/network/test_task_mirror_errors.py` — mirror failure produces `mirror_failed` task event; agent turn unaffected.
- New: `test/beta/network/test_causation_pruning.py` — causation index size for a closed channel returns to 0 after `_transition_channel`.
- New: `test/beta/network/test_inbox_pressure.py` — crossing the high-water mark fires `on_inbox_pressure` exactly once per crossing.
- Existing per-adapter tests adjusted to reflect the new tool resolution.

**Exit criteria:**

- A workflow agent's `agent.ask` does not see `say` in its tool list.
- A consulting / conversation / discussion agent sees `say` as before.
- A bridge written in plain Python (no `@tool` decorator) calls `adapter.build_packet_envelope(...) → hub_client.post_envelope(envelope)` to drive a workflow turn.
- `channels(action="open", message="...")` opens a new channel and the seed envelope appears in the WAL exactly once.
- A trivial `class MyHub(Hub)` overriding `on_envelope_posted` sees every envelope.
- Causation index size for a closed channel drops to 0 after the next `_transition_channel`.
- A `TaskMirror` failure produces a `mirror_failed` task event; the agent's turn is unaffected.
- Crossing the inbox high-water mark fires `on_inbox_pressure` exactly once per crossing.
- All PR3 + PR4 anthropic smokes still pass.

**Risk:** medium. Tool resolution lives on the notify hot path. Re-validate against both anthropic smokes before requesting review.

### Test coverage targets

- PR4: ≥ 30 unit tests (HumanClient + listener + arbiter + handler trap + health) + 2 anthropic smokes re-enabled
- PR5: ≥ 24 unit tests (tool layering + envelope helpers + subclass + bug fixes) + adjusted per-adapter tests + anthropic smoke re-validation

Cumulative: ~54 new tests minimum, zero regressions against the current beta suite baseline.

### What stays out of stabilization

- Phase 2 features — durability primitives, expanded expectations, task cancellation, N-of-M quorum, classic-Pattern migration.
- Phase 3 features — streaming, wire transport, `ApiKeyAuth`, cross-process semantics.
- Concrete Hub subclasses (Slack/Discord/Teams/etc.) — they live in application repos.
- Federation, JWT/mTLS auth, signed envelope chains.
- Example adapters (`notification`, `broadcast`, `auction`); saga skeleton; transform stdlib.

These re-enter planning after stabilization merges. The architectural seams added in PR4 (HubListener, HubArbiter) and PR5 (adapter-owned tools, subclass hooks) are deliberately shaped to admit federation, cross-process, and permission-protocol work without further restructuring.

### Operational notes

- Each PR is authored on its own branch off the previous (`feat/network-pr4-foundation` off `main`, `feat/network-pr5-adapter-tools-and-subclass` off PR4). Tests pass at every commit.
- `design/` stays out of every PR (same rule as PR1–PR3).
- Public code never references milestone/phase/PR numbers or design docs (CLAUDE.md rule). Module docstrings describe what the code does, not when it shipped.
- PR bodies follow the existing skeleton (`## Why are these changes needed?` / `## What ships` / `## Test plan` / `## Related issue` / `## Checks` / `## AI assistance`).

### What landed (commits ready to push)

PR4 — `feat/network-pr4-foundation` off `main`:
- `5ed37b1080c` — `feat(beta/network): add HumanClient + Passport.kind for native HITL`
- `e78c23d8640` — `feat(beta/network): HubListener + HubArbiter observability layer`

PR5 — `feat/network-pr5-adapter-tools-and-subclass` off PR4:
- `97fd8bbef90` — `feat(beta/network): adapter-owned tools + subclass surface + latent fixes`

Validation snapshot when PR5 closed: 298 in-tree network tests + 17 anthropic smokes (`test_workflow_smoke`, `test_network_smoke`, `test_session_smoke`, `test_network_coverage_smoke`, `test_anthropic_integration`) all passing.
