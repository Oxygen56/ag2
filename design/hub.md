# Hub

The hub is the router. It owns the registry, the session and task state machines, the WAL, the dispatch path, the adapter state cache, and the internal sweepers.

## What the hub is NOT

- Does not call `Agent.ask`.
- Does not execute tenant transforms (Phase 3).
- Does not participate in turn-by-turn LLM calls.
- Does not import tenant Python modules.
- **Does not create, assign, cancel, or retry tasks.** Tasks are agent-owned; hub observes via `observe_task` (see [tasks.md](tasks.md)).
- **Does not enforce response guarantees.** The hub flags protocol-shape violations (`Expectation`s) and surfaces liveness signals; reaction is the agent's choreography (see [failure_modes.md](failure_modes.md)).
- **Does not orchestrate across sessions.** One session at a time; multi-session flows are app code.
- **Does not judge content.** Whether a reply is "useful" is an LLM-quality call, not a wire concern.

The trust boundary runs through `HubClient` / `AgentClient` (see [clients.md](clients.md)).

## Hub vs Network

A **Hub** is a process. A **Network** is a logical addressable namespace. V1 has 1:1 mapping; Phase 2+ may have one Hub host multiple Networks (separate registries, separate WAL roots) by routing on a `network_id` parameter that defaults to `"default"`. The names are kept distinct in code from day one so the V2 split is non-breaking.

## Construction

```python
# autogen/beta/network/hub/core.py

class Hub:
    def __init__(
        self,
        store: KnowledgeStore,
        *,
        ttl_sweep_interval: float = 30.0,
        expectation_sweep_interval: float = 10.0,
        invite_ack_timeout: float = 30.0,
        clock: Callable[[], str] = _utc_now_iso,
        monotonic_clock: Callable[[], float] = time.monotonic,  # rate limiter
        auth: AuthRegistry | None = None,
    ) -> None: ...

    @classmethod
    async def open(cls, store: KnowledgeStore, **kwargs) -> "Hub":
        """Construct + hydrate from disk + start sweepers. Use this in
        production; the sync constructor is for tests with no disk state."""
        hub = cls(store, **kwargs)
        await hub.hydrate()
        await hub.start()
        return hub

    async def __aenter__(self) -> "Hub": ...
    async def __aexit__(self, *exc) -> None: ...
```

## Public API

```python
# ── Registration ────────────────────────────────────────────────────────────

async def register(
    self,
    passport: Passport,
    resume: Resume,
    *,
    skill_md: str | None = None,
    rule: Rule | None = None,
) -> Passport:
    """Stamp agent_id (UUID7), persist passport + resume + optional SKILL.md +
    rule, write an `agent_registered` audit line, return passport with id set."""

async def unregister(self, agent_id: str) -> None:
    """Remove registry entries; write an `agent_unregistered` audit line.
    Closed channels and observed tasks remain on disk."""

async def set_rule(self, agent_id: str, rule: Rule) -> None:
    """Replace rule; bump version; write `rule_set` audit line."""

# ── Discovery (read-side enumeration) ───────────────────────────────────────

async def get_agent(self, name_or_id: str) -> Passport:
    """Return passport. Raises NotFoundError if absent."""

async def get_resume(self, agent_id: str) -> Resume: ...

async def get_skill(self, agent_id: str) -> str | None:
    """Return SKILL.md body (without frontmatter parsed) or None if absent."""

async def list_agents(
    self, *,
    capability: str | None = None,
    query: str | None = None,
    sort_by: str | None = None,        # "name" | "cost" | "track_record" | None
    limit: int = 50,
) -> list[Passport]:
    """Filter + rank registered agents. `query` matches Resume.summary substring;
    `capability` matches `claimed_capabilities ∪ observed.keys()`. `sort_by`
    drives ranking — V1 supports `"name"` (lex), `"cost"` (input_per_mtok asc,
    None last), `"track_record"` (success_rate desc, requires non-zero observed.n),
    or None (registration order)."""

async def set_resume(self, agent_id: str, resume: Resume) -> None:
    """Tenant-driven resume replace; bump version + last_updated."""

async def set_skill(self, agent_id: str, skill_md: str | None) -> None:
    """Tenant-driven SKILL.md replace. None deletes the file."""

async def record_observation(
    self,
    agent_id: str,
    *,
    capability: str,
    outcome: str,                      # "completed" | "failed" | "expired"
    duration_ms: int | None = None,
    task_id: str | None = None,
) -> None:
    """Hub-driven resume mutation. Called by the task-mirror on terminal task
    events whose payload carries a `capability` tag. Updates
    Resume.observed[capability] in-place; bumps last_updated."""

async def describe_network(self) -> NetworkMetadata:
    """Adapters available, peer count, my own state. Used by NetworkPlugin's
    NetworkContextPolicy to build the per-turn prompt prefix."""

# ── Sessions ────────────────────────────────────────────────────────────────

async def create_channel(
    self, *,
    creator_id: str,
    manifest_type: str,
    manifest_version: int = 1,
    participants: list[str],           # agent ids
    required_acks: int | None = None,
    ttl: str | int | None = None,
    knobs: dict | None = None,
    intent: str | None = None,
    labels: dict[str, str] | None = None,
) -> ChannelMetadata:
    """Allocate channel_id, write metadata, broadcast EV_CHANNEL_INVITE.
    `intent` is stored on `metadata.labels["intent"]` if set — keeps
    ChannelMetadata stable as new fields appear."""

async def close_channel(self, channel_id: str, *, reason: str = "") -> ChannelMetadata: ...

async def get_channel(self, channel_id: str) -> ChannelMetadata:
    """Return metadata. Raises NotFoundError if absent."""

async def list_channels(
    self, *,
    agent_id: str | None = None,        # filter to sessions this agent participates in
    state: ChannelState | None = None,
    limit: int = 50,
) -> list[ChannelMetadata]: ...

async def post_envelope(self, envelope: Envelope) -> str:
    """Validate + WAL-append + fold + dispatch. Returns hub-stamped envelope_id."""

async def read_wal(
    self, channel_id: str, *, since: int = 0, until: int | None = None,
) -> list[Envelope]: ...

def find_envelope_by_causation(
    self,
    channel_id: str,
    *,
    sender_id: str,
    causation_id: str,
) -> Envelope | None:
    """Look up an envelope by ``(sender_id, causation_id)`` within a
    session's WAL. Used by the default notify handler to short-circuit
    duplicate replies after redelivery (see failure_modes.md mode 11).
    Returns the first match; ``None`` if absent.

    Synchronous because the index is in-memory; matches the
    ``can_send`` precedent for pure cache lookups. The index is rebuilt
    from the WAL on ``hydrate()`` — no separate persisted file. Phase 2.0."""

async def pending_turns_for(self, agent_id: str) -> list[PendingTurn]:
    """Return non-terminal sessions where adapter state expects this
    agent to act but no reply has landed since the triggering envelope.

    Each ``PendingTurn`` carries ``channel_id``, ``last_envelope_id``,
    and ``reason`` (e.g. ``"workflow_next_speaker"``,
    ``"consulting_respondent"``). Used by the default notify handler
    on reconnect to wake up unfinished turns. Phase 2.0."""

# ── Tasks (observe-only; tasks are owned by the agent — see tasks.md) ───────

async def observe_task(self, metadata: TaskMetadata) -> None:
    """Register an existing local task. Called by AgentClient when it sees
    TaskStarted on the agent's stream. Hub stores TaskMetadata, starts TTL
    accounting, and forwards subsequent task envelopes per audience addressing.
    The hub never creates, assigns, or cancels."""

async def get_task(self, task_id: str) -> TaskMetadata:
    """Return metadata. Raises NotFoundError if absent."""

async def list_tasks(
    self, *,
    agent_id: str | None = None,        # filter to tasks owned by this agent
    channel_id: str | None = None,
    state: TaskState | None = None,
    limit: int = 50,
) -> list[TaskMetadata]: ...

async def expire_due(self) -> None:
    """Sweeper hook: walk active channels and tasks, transition expired
    ones to ``EXPIRED``, emit ``ag2.channel.expired`` /
    ``ag2.task.expired``. Public so users running their own scheduler
    can drive it directly."""

async def evaluate_expectations(self) -> None:
    """Sweeper hook: evaluate every expectation on every active channel
    and apply registered violation handlers. Public sibling of
    ``expire_due()``."""

# ── Wire-mode RPC (for HubClient over WsLink) ───────────────────────────────
#
# A fixed allowlist of control-plane methods is callable via
# ``RpcCallFrame`` / ``RpcResultFrame`` over a wire transport. The
# allowlist mirrors the public surface above; see the ``HubClient``
# wire-mode docs in ``clients.md`` for the call shape. ``HubClient``
# branches transparently on whether it has an in-process ``hub``
# reference, so callers see the same API either way.

# ── Audit ───────────────────────────────────────────────────────────────────
#
# Hub-cross-cutting events (register, unregister, rule change,
# expectation fires, participant removed, channel close, etc.) are
# appended to ``audit/audit.jsonl`` via ``Hub._audit_log`` — see the
# audit-log section below for the line shape and producers. A reader
# API on Hub itself is not yet exposed; operators / tests read the
# file directly when needed.

# ── Adapter registry ────────────────────────────────────────────────────────

def register_adapter(self, adapter: ChannelAdapter) -> None: ...

# ── Lifecycle ───────────────────────────────────────────────────────────────

async def hydrate(self) -> None:
    """Walk the store; rebuild caches; re-fold AdapterState for every active
    session by replaying its WAL. Idempotent."""

async def start(self) -> None:
    """Spawn internal sweepers. Idempotent — calling twice is safe."""

async def close(self) -> None:
    """Cancel sweepers and bound endpoint tasks; drain queues."""
```

## Internal in-memory caches

The hub rebuilds these from disk on `hydrate()`:

- `_passports: dict[str, Passport]` — by agent_id
- `_resumes: dict[str, Resume]` — by agent_id
- `_skills: dict[str, str]` — small LRU; loaded on-demand by `peers(action="describe")`
- `_rules: dict[str, Rule]`
- `_name_to_id: dict[str, str]` — name index
- `_capability_index: dict[str, set[str]]` — capability → set of agent_ids
- `_channels: dict[str, ChannelMetadata]` — by channel_id
- `_active_channels: dict[str, ChannelMetadata]` — non-terminal subset
- `_adapter_states: dict[str, AdapterState]` — folded state per channel, advanced on every WAL append
- `_causation_index: dict[str, dict[(sender_id, causation_id), Envelope]]` — per-channel reply index, rebuilt from WAL on `hydrate()`
- `_tasks: dict[str, TaskMetadata]` — observed (not owned) tasks
- `_channel_tasks: dict[str, set[str]]` — task ids per channel
- `_inbox_cursors: dict[agent_id, dict[channel_id, envelope_id]]` — per-(agent, channel) replay cursor
- `_hidden_in_channel`, `_removed_from_channel` — per-channel sets driven by `hide` / `remove` violation handlers
- `_endpoints_by_id: dict[str, LinkEndpoint]` + `_agent_to_endpoint: dict[str, str]` — current connections + identity binding
- `_rate_buckets: dict[agent_id, TokenBucket | None]` — per-sender token-bucket cache, invalidated on `set_rule` / `unregister`

Every disk write is paired with a cache update; cache is never authoritative.

## Adapter state cache

The hub holds one `AdapterState` per active session, computed by folding WAL envelopes through `adapter.fold(envelope, state)`. This is what makes `validate_send` and `on_accepted` O(1) instead of O(WAL):

```python
async def post_envelope(self, envelope: Envelope) -> str:
    async with self._wal_lock(envelope.channel_id):
        meta = self._channels[envelope.channel_id]
        state = self._adapter_states[envelope.channel_id]
        adapter = self._adapter_for(meta.manifest.type, meta.manifest.version)

        adapter.validate_send(meta, envelope, state)              # O(1)

        envelope_id = await self._wal_append(envelope)
        new_state = adapter.fold(envelope, state)                 # O(1)
        self._adapter_states[envelope.channel_id] = new_state

        result = adapter.on_accepted(meta, envelope, new_state)   # O(1)

    # Dispatch + post-accept transitions happen outside the lock so
    # the broadcast of `EV_CHANNEL_CLOSED` does not deadlock on the
    # same per-channel lock.
    await self._dispatch(envelope, meta)
    if result.next_state is not None:
        await self._transition_channel(envelope.channel_id, result.next_state, result.auto_close_reason)
    return envelope_id
```

On `hydrate()`, the hub re-folds every active channel's WAL once to rebuild the cache. The fold is pure, so this is deterministic and idempotent. Closed channels are not folded — their state is irrelevant.

## Sweepers

V1 ships **two** sweepers, both internal. `Hub.start()` spawns an `asyncio.Task` per sweeper that loops on a fixed interval:

```python
# autogen/beta/network/hub/sweepers.py

class _IntervalSweeper:
    """Run a coroutine on a fixed interval until cancelled."""

    def __init__(self, name: str, interval: float, fn: Callable[[], Awaitable[None]]) -> None: ...
    def start(self) -> None: ...
    async def stop(self) -> None: ...
```

| Sweeper | Default interval | What it does |
|---|---|---|
| `_TtlSweeper` | `ttl_sweep_interval` (30s) | Walks `_active_channels` and `_tasks`; transitions anything past `expires_at` to `EXPIRED`; emits `ag2.channel.expired` / `ag2.task.expired`; cascades open tasks under closing channels. |
| `_ExpectationSweeper` | `expectation_sweep_interval` (10s) | Walks `_active_channels`; for each `ChannelManifest.expectations` entry, evaluates the registered evaluator against `(metadata, AdapterState, WAL, now)`; on violation, applies the declared `on_violation` handler (`audit` / `warn` / `notify_channel` / `hide` / `remove` / `auto_close`). Per-(channel, expectation, violator) dedup via `_fired_violations` prevents handlers from re-firing every tick. |

The framework-core `Watch` primitive is NOT used here — it is the trigger primitive for assembly/compact/aggregate inside the Agent harness, not a fleet manager. `asyncio.Task` + `asyncio.sleep` is enough; no public `Scheduler` surface.

All emitted envelopes go through `post_envelope` so they participate in the same WAL-append + dispatch path as agent-emitted envelopes. There is no parallel "hub-internal events" channel.

Phase 2.0's idempotency dedup is a **query** (`Hub.find_envelope_by_causation`), not a separate sweeper or stored table — the WAL is the source of truth and the in-memory index is rebuilt on `hydrate()` by walking it once. No sweeper needed.

## Audit log

Hub-cross-cutting events that don't belong on any single channel's WAL — registrations, rule changes, expectation fires, task terminations, channel lifecycle — are appended to `audit/audit.jsonl` (one line per event). Each line is `{at, kind, ...kind-specific fields}`:

| `kind` | Fields | Emitted by |
|---|---|---|
| `agent_registered` | `agent_id`, `name` | `register` |
| `agent_unregistered` | `agent_id`, `name` | `unregister` |
| `rule_set` | `agent_id`, `version` | `set_rule` |
| `resume_set` | `agent_id`, `version`, `source` (`"tenant"` \| `"observed"`), optional `capability` + `outcome` for observed updates | `set_resume`, `record_observation` |
| `skill_set` | `agent_id`, `removed` (true if cleared) | `set_skill` |
| `channel_created` | `channel_id`, `manifest_type`, `manifest_version`, `creator_id`, `participants` | `create_channel` |
| `channel_closed` | `channel_id`, `reason` | `close_channel`, terminal `_transition_channel` |
| `channel_expired` | `channel_id`, `reason` | TTL sweeper |
| `task_terminated` | `task_id`, `owner_id`, `channel_id`, `outcome`, `capability`, `reason` | `_transition_task` on terminal state |
| `expectation_violated` | `channel_id`, `expectation`, `on_violation`, `params`, `violators`, `detail` | `_ExpectationSweeper` |

No rotation policy ships — the log appends to a single
`audit/audit.jsonl`. Operators that need pruning rotate the file out
of band. Audit reading is a file-level operation today; a structured
`Hub.read_audit(...)` reader API may ship if a real use case appears.

## Quorum tracking

Multi-party `create_channel(required_acks=N)` tracks outstanding acks via `ChannelMetadata.pending_acks` (and rejects via `rejected_by`). Both shrink on every `EV_CHANNEL_INVITE_ACK` / `EV_CHANNEL_INVITE_REJECT`. The hub recomputes the achievable quorum after each reject: if `acks + pending < required_acks`, the channel transitions to `CLOSED` with reason `quorum_unreachable`; otherwise it keeps waiting, transitioning to `ACTIVE` as soon as the threshold is met.

A live multi-party channel can also lose participants via the `remove` violation handler, which calls `Hub.mark_removed(channel_id, agent_id)` and emits `ag2.channel.quorum_changed(remaining, required)`. `required_acks` snapshotted on `ChannelMetadata` so the threshold remains stable after participants are removed.

Handshake state is part of `ChannelMetadata` and persists with the channel — no separate ack file. `Hub.hydrate()` reads it back along with the rest of the metadata.

## Adapter version migration

Manifests are snapshotted into `ChannelMetadata.manifest` at create time. If `consulting@v1` ships and `consulting@v2` lands later, existing V1 sessions keep their V1 manifest for life — the hub looks up the adapter by `(manifest.type, manifest.version)`, and re-registering an adapter at a new `version` does not mutate any in-flight session. There is no migration tooling in V1; closed-session compaction (Phase 3) drops manifest detail along with the WAL.

## Dispatch invariants

- The hub never calls `Agent.ask` directly. Every delivery is via the `Link.notify(envelope)` frame; the receiving `AgentClient` runs the handler.
- Every WAL append is paired with the fold, the `on_accepted` decision, and subscription fan-out under a single per-session lock so subscribers see exactly-once delivery within one process and adapter state never desyncs from the WAL.
- Every state transition is paired with the envelope that drove it under the same lock.
- Hub-cross-cutting events (register/unregister, rule/resume/skill mutations, channel lifecycle, expectation fires, task termination) append to `_audit_log` from one place per event source — readers walk a single `audit/audit.jsonl`.

## At-least-once delivery

Across reconnects, every WAL envelope is delivered ≥1 time per recipient before its session closes. The receiving `AgentClient` checkpoints `inbox.cursor` on every successful `receipt(status="ack")`. On reconnect, hub replays from the cursor up to the WAL head.

| Phase | What ships |
|---|---|
| V1 | Exactly-once by lock construction (single-process, no cross-process replay needed). |
| Phase 2.0 | In-process redelivery via `inbox.cursor` over `LocalLink`. Default handler issues Receipt only after handler completes; on Hello, hub replays unacked. |
| Phase 3 | Cross-process variant over `WsLink`. Same semantics on the wire. |

This is an explicit framework invariant — not an implementation detail. New transports must preserve it.
