# Sessions

A `Channel` is a stateful, durable, multi-turn container with a hub-enforced state machine and a pluggable adapter that defines its delivery semantics.

## Manifest vs adapter

V1 splits the session description in two:

- `ChannelManifest` — **data**. Persisted with metadata. Describes what the session is.
- `ChannelAdapter` — **code**. Registered in the hub process; looked up by manifest type/version.

This lets a hub in another process restore a session from disk and look up the adapter by name without import-time coupling. It also makes admin endpoints `list_manifests()` trivial (Phase 3).

```python
# autogen/beta/network/session.py

@dataclass(slots=True)
class ParticipantSchema:
    min: int                                   # inclusive
    max: int | None = None                     # inclusive; None = unbounded
    roles: list[str] = field(default_factory=list)


@dataclass(slots=True)
class Expectation:
    """A protocol-shape contract the hub evaluates over WAL + clock.

    `name` selects a built-in evaluator (V1 ships 6); custom evaluators
    register in Phase 2.
    """

    name: str                                  # see "Expectations" below
    on_violation: str                          # "audit" | "warn" | "notify_channel" | "hide" | "remove" | "auto_close"
    params: dict[str, Any] = field(default_factory=dict)
    applies_to: list[str] | None = None        # role names or agent ids; None = all participants


@dataclass(slots=True)
class ChannelManifest:
    type: str                                  # adapter dispatch key, e.g. "consulting"
    version: int = 1
    participants: ParticipantSchema = field(default_factory=lambda: ParticipantSchema(min=2))
    allowed_events: list[str] = field(default_factory=list)
    knobs_schema: dict[str, str] = field(default_factory=dict)   # name -> type hint
    default_view_policy: str = "full_transcript"                  # name resolved by views registry
    expectations: list[Expectation] = field(default_factory=list)
```

## Channel metadata

```python
class ChannelState(str, Enum):
    PENDING = "pending"                        # invite sent, waiting on acks
    ACTIVE = "active"
    CLOSING = "closing"
    CLOSED = "closed"
    EXPIRED = "expired"


class ParticipantRole(str, Enum):
    INITIATOR = "initiator"
    RESPONDENT = "respondent"                  # 2-party non-initiator
    PARTICIPANT = "participant"                # multi-party non-initiator


@dataclass(slots=True)
class Participant:
    agent_id: str
    role: ParticipantRole
    order: int                                 # 0 for initiator; insertion order otherwise
    joined_at: str = ""


@dataclass(slots=True)
class ChannelMetadata:
    channel_id: str
    manifest: ChannelManifest
    creator_id: str
    participants: list[Participant]
    state: ChannelState
    created_at: str
    expires_at: str | None = None
    closed_at: str | None = None
    close_reason: str = ""
    parent_session_id: str | None = None        # nested sessions
    knobs: dict[str, Any] = field(default_factory=dict)         # adapter-specific
    labels: dict[str, str] = field(default_factory=dict)        # includes "intent" if creator passed one

    # Multi-party handshake state (only meaningful while state == PENDING)
    required_acks: int | None = None
    pending_acks: list[str] = field(default_factory=list)       # agent_ids whose ack is still outstanding
    rejected_by: list[str] = field(default_factory=list)        # agent_ids who explicitly rejected
```

Adapter-specific knobs (e.g., `{"ordering": "round_robin"}`) live in `metadata.knobs` and are validated by the adapter's `validate_create`. They are **not** top-level fields. This keeps `ChannelMetadata` stable as adapters proliferate.

`intent` (free-form one-line description, e.g. `"debate framework X adoption"`) lives in `labels["intent"]` rather than as a dedicated field — labels are the catch-all for tenant-supplied annotations and `intent` is one. The hub does not interpret it; `NetworkContextPolicy` renders it into the per-turn prompt.

`pending_acks` and `rejected_by` track multi-party handshake state. They are populated at session creation, mutated on each `EV_CHANNEL_INVITE_ACK` / `EV_CHANNEL_INVITE_REJECT`, and frozen once the session transitions to `ACTIVE` (quorum reached) or fails creation (`quorum_unreachable`). On a partial reject, the hub recomputes whether `len(invitees) - len(rejected_by) >= required_acks` is still satisfiable.

## Adapter Protocol

```python
# autogen/beta/network/adapters/base.py


class AdapterState(Protocol):
    """Per-adapter derived state, folded from the WAL.

    Adapters define their own dataclass implementing this Protocol — e.g.
    DiscussionState(turn_index, expected_next_speaker, last_speaker_id).
    """


@dataclass(slots=True)
class AdapterResult:
    """What an adapter wants the hub to do after accepting an envelope."""

    next_state: ChannelState | None = None     # transition the session, or None to leave
    auto_close_reason: str = ""                # if next_state == CLOSED


class ChannelAdapter(Protocol):
    manifest: ChannelManifest

    def initial_state(self, metadata: ChannelMetadata) -> AdapterState:
        """Empty state for a fresh channel."""

    def fold(self, envelope: Envelope, state: AdapterState) -> AdapterState:
        """Append `envelope` into the derived state. Pure function.

        Called once per WAL append by the hub, and called repeatedly during
        `Hub.hydrate()` to rebuild state from disk.
        """

    def validate_create(self, metadata: ChannelMetadata) -> None:
        """Raise on invalid creation (bad participant count, missing knobs, ...)."""

    def validate_send(
        self,
        metadata: ChannelMetadata,
        envelope: Envelope,
        state: AdapterState,
    ) -> None:
        """Raise if this envelope is not allowed by the protocol at this point."""

    def on_accepted(
        self,
        metadata: ChannelMetadata,
        envelope: Envelope,
        state: AdapterState,
    ) -> AdapterResult:
        """Decide post-accept transitions (auto-close, advance turn order, ...).

        Receives the state AFTER `fold(envelope, ...)` has run.
        """

    def default_view_policy(
        self,
        metadata: ChannelMetadata,
        participant_id: str,
    ) -> ViewPolicy:
        """Per-participant default projection for this channel type."""

    def extract_turn_input(self, envelope: Envelope) -> str | Input | list[Input] | None:
        """Decode an inbound substantive envelope into the next
        speaker's prompt. Return ``None`` (or empty) for envelopes the
        adapter doesn't act on — the handler will skip the LLM round.

        Default helper ``default_extract_turn_input`` covers ``EV_TEXT``.
        Adapters with richer round shapes (e.g. ``WorkflowAdapter``
        with ``EV_PACKET``) override to decode their additional types.
        """

    def build_round_envelope(
        self,
        metadata: ChannelMetadata,
        sender_id: str,
        reply: "AgentReply",
        events: list[BaseEvent],
        state: AdapterState,
        hub: "Hub | HubClient",
    ) -> Envelope | None:
        """Build the envelope capturing one ``Agent.ask`` round.

        Called by the handler after the LLM round completes. The
        default helper ``default_build_round_envelope`` emits
        ``EV_TEXT(reply.body)`` when non-empty, else ``None``.
        ``WorkflowAdapter`` overrides to emit ``EV_PACKET`` packets
        carrying routing + body + context updates atomically.

        Returning ``None`` means "no envelope worth posting" — the
        caller skips the post entirely.
        """

    def render_envelope(self, envelope: Envelope) -> str | None:
        """Project ``envelope`` to its LLM-visible string for view
        policies. Adapters that emit only ``EV_TEXT`` delegate to
        ``default_render_envelope``; richer adapters render their own
        substantive types and fall through to the default for the
        universal cases.

        Returning ``None`` skips the envelope in the projection.
        """

    # Optional: per-recipient routing narrowing. Adapters omit this
    # member entirely to keep the broadcast default; ``WorkflowAdapter``
    # implements it to send substantive envelopes only to the expected
    # next speaker.
    #
    # def dispatch_audience(
    #     self,
    #     envelope: Envelope,
    #     metadata: ChannelMetadata,
    #     state: AdapterState,
    # ) -> list[str] | None: ...
```

Adapters are stateless and pure. Every decision derives from `(metadata, AdapterState)`. The hub caches the latest folded state per session in memory and reconstructs it from the WAL on `hydrate()`. **`validate_send` and `on_accepted` are O(1), not O(WAL)** — this is the load-bearing fix vs. the original design and is what lets a 1000-turn discussion stay fast.

## Expectations

Adapters declare protocol-shape contracts that the hub enforces. Expectations are derivable from `(metadata, AdapterState, WAL tail, clock)` — the hub already has all of it. They run in a small periodic sweeper (see [hub.md](hub.md)) that is independent of the per-envelope `validate_send` / `on_accepted` path: `validate_send` rejects bad **sends**, expectations react to bad **silence** (or bad pacing).

### Built-in expectation kinds (V1)

| `name` | Params | Hub flags violation when |
|---|---|---|
| `acks_within` | `seconds` | Invitee hasn't ack'd or rejected within T after `EV_CHANNEL_INVITE` |
| `reply_within` | `seconds` | A participant with envelopes addressed to them hasn't sent a response within T |
| `turn_within` | `seconds` | When `AdapterState` says it's my turn, I don't post within T |
| `progress_within` | `seconds` | Owner of a non-terminal task hasn't emitted a progress envelope within T |
| `max_silence` | `seconds` | Channel has had no envelopes from anyone for T |
| `min_participation` | `count`, `window_seconds` | Participant posts fewer than `count` envelopes per `window_seconds` |

Custom evaluators (user-registered Python callables `(metadata, state, wal_tail, now) -> bool`) are a Phase 2.1 extension.

### Built-in violation handlers

All handlers are **passive** — the hub records, signals, hides, removes, or closes. It never re-tries, substitutes content, or makes outcome decisions for the agent.

| `on_violation` | Hub action |
|---|---|
| `audit` | Log `ag2.expectation.violated` to WAL only; no `notify` delivery |
| `warn` | Emit `ag2.expectation.violated` envelope, audience = violator |
| `notify_channel` | Emit `ag2.expectation.violated` envelope, broadcast to channel |
| `hide` | Drop violator from future `notify` in this session; WAL still records their absence; sender can still post but recipients won't see |
| `remove` | State transition: violator removed from `metadata.participants`; cannot send into this session anymore. Emits `ag2.participant.removed`. |
| `auto_close` | Transition session to `CLOSING` with `close_reason="expectation_violated:{name}"` |

Multiple expectations of the same `name` with different thresholds compose as escalation: e.g. warn at 120s, hide at 600s.

### Built-in adapter expectations (V1)

| Adapter | Default expectations |
|---|---|
| `consulting` | `acks_within(30s, auto_close)`, `reply_within(600s, auto_close)` |
| `conversation` | `max_silence(1h, audit)` (long sessions, light enforcement) |
| `discussion(round_robin)` | `turn_within(120s, warn)`, `turn_within(600s, hide)` |
| `discussion(dynamic)` | `max_silence(10m, audit)` |
| `discussion(static)` | `turn_within(120s, warn)`, `turn_within(300s, auto_close)` (fail-fast pipeline) |

Tenants override per-session by passing `manifest_overrides={"expectations": [...]}` to `client.open(...)`.

## Built-in adapters (V1)

| Type | Participants | Semantics | Default view |
|---|---|---|---|
| `consulting` | 1+1 | Strict 1Q1R: initiator sends one envelope, respondent sends one reply, session auto-closes. | `FullTranscript` |
| `conversation` | 1+1 | Bidirectional, multi-turn. Either side may send. Explicit `close()` or TTL ends. | `WindowedSummary(recent_n=10)` |
| `discussion` | 1+N (≥2) | Multi-participant turn-taking. `knobs={"ordering": "dynamic" \| "static" \| "round_robin"}`. | `WindowedSummary(recent_n=N*2)` |
| `workflow` | 1+N (≥2) | Orchestrated flow driven by a declarative `TransitionGraph` in `knobs["graph"]`. Replaces AG2-classic's `GroupChat` + `Handoffs` + `AfterWork`. See [workflow.md](workflow.md). | `WindowedSummary(recent_n=N*2)` |

Each adapter is < 250 LOC. `notification`, `broadcast`, `auction` live in `examples/` as proofs that the Protocol is genuinely extensible — framework-core doesn't include them.

### Discussion ordering knobs

| `knobs.ordering` | Behavior |
|---|---|
| `dynamic` (default) | Any participant may send when they have a contribution; initiator picks next via `audience` if needed |
| `round_robin` | `AdapterState.expected_next_speaker` rotates through participants in `order` |
| `static` | Pre-declared sequence in `knobs.sequence: list[str]`; fail-fast if a non-listed speaker sends |

`static` + `PreviousOnly` view (Phase 2) is the equivalent of a sequential pipeline: each participant sees only the prior speaker's output.

## Channel creation flow

```
Initiator                      Hub                          Recipients
   │                             │                              │
   │  client.sessions(           │                              │
   │    action="open",           │                              │
   │    type, target,            │                              │
   │    knobs?, ttl?)            │                              │
   │ ──────────────────────────▶ │                              │
   │                             │  validate access + adapter   │
   │                             │  allocate channel_id (UUID7) │
   │                             │  initial_state               │
   │                             │  write metadata.json         │
   │                             │  open empty wal.jsonl        │
   │                             │  ── EV_CHANNEL_INVITE ─────▶ │
   │                             │                              │── notify()
   │                             │                              │
   │                             │ ◀── EV_CHANNEL_INVITE_ACK ── │
   │                             │  state → ACTIVE              │
   │                             │  EV_CHANNEL_OPENED to all    │
   │                             │                              │
   │  Channel handle             │                              │
   │ ◀────────────────────────── │                              │
```

For 2-party types, the hub waits for the recipient's ack before returning. For multi-recipient types, the initiator passes `required_acks: int | None` (default = all). On partial reject the hub computes whether quorum is still reachable; if not, the handshake fails.

## Adapter extensibility

Third parties register adapters explicitly:

```python
class TournamentAdapter:
    manifest = ChannelManifest(
        type="tournament",
        version=1,
        participants=ParticipantSchema(min=4, max=16),
        knobs_schema={"rounds": "int"},
        default_view_policy="windowed_summary",
    )

    def initial_state(self, metadata): ...
    def fold(self, envelope, state): ...
    def validate_create(self, metadata): ...
    def validate_send(self, metadata, envelope, state): ...
    def on_accepted(self, metadata, envelope, state): ...
    def default_view_policy(self, metadata, participant_id): ...

hub.register_adapter(TournamentAdapter())
```

Re-registering an existing `(type, version)` replaces the prior adapter and logs a warning. `metadata.manifest.type` is a plain string on disk and on the wire; unknown types raise `SessionTypeError("no adapter registered for X@v1")`.

## Invariants

- A session is referenced by exactly one `ChannelAdapter` for its lifetime, picked by `(manifest.type, manifest.version)` at create time.
- Manifests are snapshotted into `ChannelMetadata.manifest` at create time. Re-registering an adapter at a new `version` (e.g., `consulting@v2` after `consulting@v1`) does **not** mutate any in-flight session; existing sessions keep their original manifest for life. There is no migration tooling in V1.
- Adapter decisions are deterministic functions of `(metadata, AdapterState)` where `AdapterState = fold(envᵢ, fold(envᵢ₋₁, ... fold(env₁, initial_state())))`.
- The WAL is append-only. Mutating past envelopes is never allowed.
- Closing a session is hub-initiated (`Hub.close_channel` or TTL sweep) and cascades: every non-terminal task in the session transitions to `expired` (V1) before `EV_CHANNEL_CLOSED` is broadcast. Phase 2.0 adds `cancelled` as the cascade target.
