# Workflow

`WorkflowAdapter` is the Network's answer to AG2-classic's `GroupChat` + `Handoffs` + `AfterWork` triad. It is one more `ChannelAdapter`: a flow whose next-speaker is determined by a declarative `TransitionGraph` over folded state.

## Why a separate adapter

`consulting` is strict 1:1. `discussion` is symmetric multi-party with `round_robin` / `dynamic` / `static` ordering. Neither expresses "Alice → conditionally → Bob | Carol with the choice driven by Alice's tool call." Rather than overload `discussion`, `WorkflowAdapter` is purpose-built for orchestrated flows where speaker selection is the central concern.

The mechanic itself is what `discussion(round_robin)` already uses — `AdapterState.expected_next_speaker` is folded from the WAL, `validate_send` rejects sends from anyone else. `WorkflowAdapter` only adds a richer rule for *how* `expected_next_speaker` advances. **No hub changes are required.**

## Transition vocabulary

```python
# autogen/beta/network/transitions.py

class TransitionTarget(Protocol):
    """Where the next turn goes. Pure resolver — no I/O.

    Takes only ``(state, envelope)``. ``WorkflowState`` carries
    ``participant_order`` and ``creator_id`` (snapshotted at
    ``initial_state``) so resolvers don't need ``ChannelMetadata`` —
    ``WorkflowAdapter.fold`` runs them in a context that has no
    metadata access.
    """

    name: ClassVar[str]                            # registry key

    def resolve(
        self,
        state: WorkflowState,
        envelope: Envelope,
    ) -> TransitionDecision: ...


@dataclass(slots=True)
class TransitionDecision:
    next_speaker: str | None                       # None = terminate
    close_reason: str = ""                         # populated only when terminating


class TransitionCondition(Protocol):
    """When a transition fires. Pure predicate — no I/O.

    Same ``(state, envelope)`` contract as ``TransitionTarget``.
    """

    name: ClassVar[str]                            # registry key

    def evaluate(
        self,
        state: WorkflowState,
        envelope: Envelope,
    ) -> bool: ...


@dataclass(slots=True)
class Transition:
    when: TransitionCondition
    then: TransitionTarget
    priority: int = 0                              # lower = earlier; ties → list order
```

### Built-in TransitionTargets (V1)

| Target | Args | Resolves to |
|---|---|---|
| `AgentTarget` | `agent_id: str` | the named agent |
| `RoundRobinTarget` | — | next participant in `state.participant_order` after `state.last_speaker_id` |
| `StayTarget` | — | `state.last_speaker_id` |
| `RevertToInitiatorTarget` | — | `state.creator_id` |
| `TerminateTarget` | `reason: str = "after_work"` | `next_speaker=None`, populates `close_reason` |

`LLMSelectorTarget` (selector agent picks the next speaker via a `Handoff`-returning tool) is also shipped. `RandomTarget`, `NestedSessionTarget`, and `SubGraph` are deferred until callers need them — see [Deferred](#deferred).

### Built-in TransitionConditions (V1)

| Condition | Args | Fires when |
|---|---|---|
| `Always` | — | every accepted turn |
| `FromSpeaker` | `agent_id: str` | the just-accepted envelope was sent by `agent_id` |
| `ToolCalled` | `tool_name: str` | the just-accepted envelope is an `EV_PACKET` whose `event_data["routing"]["tool"]` matches `tool_name` |
| `ContextEquals` | `key: str, value: Any` | `state.context_vars[key] == value` (missing keys compare as `None`) |

Richer condition kinds (e.g. `TurnCountReached`, full expression
evaluators) extend the open `Protocol` via the named registry.

These targets and conditions are deliberately the minimum that covers the common patterns without forcing architectural decisions (async resolution, expression evaluators, child-session lifecycle) before they're needed. The `Protocol` is open and the named registry (see [Registries](#registries)) accepts new types in two lines.

## TransitionGraph

```python
@dataclass(slots=True)
class TransitionGraph:
    initial_speaker: str
    transitions: list[Transition]
    default_target: TransitionTarget = field(default_factory=TerminateTarget)
    max_turns: int | None = None
```

**Evaluation order on each accepted envelope:**

1. If `max_turns` set and reached → terminate (`auto_close_reason="max_turns"`).
2. Walk `transitions` in `priority` order (ties = list order); first whose `when.evaluate(...)` returns `True` wins.
3. If no transition matches → `default_target.resolve(...)`.
4. Apply the `TransitionDecision`: update `state.expected_next_speaker` or transition the session to `CLOSED`.

The graph is **not Turing-complete by design**. No loops over the graph itself (only over WAL turns); no recursion of resolution. This is what makes it persistable and replayable.

## WorkflowAdapter

```python
# autogen/beta/network/adapters/workflow.py

WORKFLOW_TYPE = "workflow"


@dataclass(slots=True)
class WorkflowState:
    expected_next_speaker: str | None = None
    last_speaker_id: str | None = None
    last_envelope_id: str | None = None
    turn_count: int = 0


class WorkflowAdapter:
    """Generic orchestrated multi-party session.

    knobs:
        graph: TransitionGraph (serialized)        # required
    """

    def __init__(self) -> None:
        self.manifest = ChannelManifest(
            type=WORKFLOW_TYPE,
            version=1,
            participants=ParticipantSchema(min=2),
            knobs_schema={"graph": "TransitionGraph"},
            default_view_policy=WindowedSummary.name,
            expectations=[
                Expectation(name="turn_within", on_violation="warn",
                            params={"seconds": 120}),
                Expectation(name="turn_within", on_violation="auto_close",
                            params={"seconds": 600}),
            ],
        )

    def initial_state(self, metadata):
        graph = TransitionGraph.loads(metadata.knobs["graph"])
        return WorkflowState(expected_next_speaker=graph.initial_speaker)

    def fold(self, envelope, state):
        # Channel-protocol and task envelopes don't advance turns.
        # EV_TEXT and EV_PACKET envelopes update last_speaker_id and
        # turn_count; the fold then resolves the next transition (via
        # the embedded ``routing.target`` for handoff packets, or via
        # ``select_next`` for static rules) and advances
        # ``expected_next_speaker``.
        ...

    def validate_send(self, metadata, envelope, state):
        if state.expected_next_speaker and envelope.sender_id != state.expected_next_speaker:
            raise ProtocolError(
                f"workflow {metadata.channel_id!r} expects "
                f"{state.expected_next_speaker!r} to speak, got {envelope.sender_id!r}"
            )

    def on_accepted(self, metadata, envelope, state):
        graph = TransitionGraph.loads(state.graph_data)
        if graph.max_turns is not None and state.turn_count >= graph.max_turns:
            return AdapterResult(next_state=ChannelState.CLOSED,
                                 auto_close_reason="max_turns")
        if state.expected_next_speaker is None:
            return AdapterResult(next_state=ChannelState.CLOSED,
                                 auto_close_reason=state.pending_close_reason)
        return AdapterResult()

    @staticmethod
    def _select(graph, state, envelope) -> TransitionDecision:
        for tr in sorted(graph.transitions, key=lambda t: t.priority):
            if tr.when.evaluate(state, envelope):
                return tr.then.resolve(state, envelope)
        return graph.default_target.resolve(state, envelope)
```

The adapter is stateless and pure. All state lives in `WorkflowState`, folded from the WAL. `Hub.hydrate()` rebuilds it on restart by replaying the WAL through `fold` — same mechanism every other adapter uses.

## Dispatch

`WorkflowAdapter` rides the standard dispatch path with one per-recipient narrowing optimization:

1. Sender posts envelope. The hub asks the adapter for an optional narrowed audience via the `ChannelAdapter.dispatch_audience` hook; for substantive `EV_TEXT` / `EV_PACKET` envelopes `WorkflowAdapter` returns `[state.expected_next_speaker]` so only the next speaker gets a `NotifyFrame`. Other participants observe the turn through their WAL projection on their next read.
2. The recipient's notify handler still calls `adapter.validate_send` defensively; the narrowing skips wire round-trips, not the gate.
3. Protocol envelopes (invites, opens, closes), envelopes with an explicit audience, and terminated workflows fall back to the default broadcast.

## LLM-driven handoffs

The `OnCondition`-style "LLM picks the transition" pattern collapses to **one tool per next-speaker option**. Users author the tools directly — the framework reads the typed return value off the agent's local `ToolResultEvent` stream and routes accordingly:

```python
from autogen.beta.network import Handoff


@tool(description="Transfer the conversation to the engineering team.")
async def transfer_to_engineering(reason: str = "") -> Handoff:
    return Handoff(target="eng", reason=reason)
```

The `WorkflowAdapter` builds an `EV_PACKET` envelope per `Agent.ask` round, embedding the `Handoff` return value in `routing.target`. `fold` reads the packet, advances `state.expected_next_speaker` to the named target, and the dispatch path narrows to that recipient. The LLM never sees `expected_next_speaker` directly — it sees a button labeled "transfer," and the protocol does the rest. **Handoffs are a UX over the choreography.**

For the `AutoPattern` shape (one selector picking among N candidates), `TransitionGraph.auto_pattern(selector_id, candidates)` returns `(graph, tools)` so the caller wires both ends in a single shot:

```python
graph, tools = TransitionGraph.auto_pattern(
    selector_id="manager",
    candidates=["eng", "sales"],
)
manager_agent.tools.extend(tools)
await client.open(type="workflow", knobs={"graph": graph.dumps()})
```

No-LLM handoffs use `Transition(when=ContextEquals(key, value), then=...)` against the channel-scoped `state.context_vars` (mutated by `EV_CONTEXT_SET` envelopes and `EV_PACKET.event_data["context_updates"]`). A richer expression evaluator is open work — `ContextEquals` covers point-equality today, and custom conditions plug in via the registry.

`EV_PACKET` is the durable record of each round and is documented in [envelope.md](envelope.md). The `Handoff` dataclass lives at `autogen.beta.network.handoff`.

## Persistence

`TransitionGraph` is data, not code. It serializes to JSON via `TransitionGraph.dumps()` and restores via `TransitionGraph.loads(data)`. Targets and conditions resolve through named registries:

```python
# autogen/beta/network/transitions.py

_TARGET_REGISTRY: dict[str, type[TransitionTarget]] = {
    "agent": AgentTarget,
    "round_robin": RoundRobinTarget,
    "stay": StayTarget,
    "revert_to_initiator": RevertToInitiatorTarget,
    "terminate": TerminateTarget,
}

_CONDITION_REGISTRY: dict[str, type[TransitionCondition]] = {
    "always": Always,
    "from_speaker": FromSpeaker,
    "tool_called": ToolCalled,
}

def register_target(target_cls: type[TransitionTarget]) -> None: ...
def register_condition(condition_cls: type[TransitionCondition]) -> None: ...
```

`metadata.knobs["graph"]` stores the serialized form (a JSON dict tagged by registry name). `Hub.hydrate()` re-folds the WAL through `WorkflowAdapter.fold` exactly like any other adapter; `loads` looks up registered classes by name.

Re-registering a name replaces the prior class and logs a warning, mirroring `Hub.register_adapter`. Unknown names raise `WorkflowGraphError("no target/condition registered for X")`.

## Pattern recipes

Each classic AG2 pattern collapses to a `TransitionGraph` literal. `transitions.py` ships factory helpers:

```python
# Round-robin (matches discussion(round_robin) + AfterWork.TERMINATE)
WorkflowGraph.round_robin(
    participants=["alice", "bob", "carol"],
    max_turns=12,
)

# Sequential pipeline
WorkflowGraph.sequence(
    steps=["researcher", "writer", "reviewer"],
)

# Swarm with tool-driven handoffs (initiator routes; respondents revert)
WorkflowGraph(
    initial_speaker="triage",
    transitions=[
        Transition(when=ToolCalled("transfer_to_eng"),   then=AgentTarget("eng")),
        Transition(when=ToolCalled("transfer_to_legal"), then=AgentTarget("legal")),
        Transition(when=FromSpeaker("eng"),              then=RevertToInitiatorTarget()),
        Transition(when=FromSpeaker("legal"),            then=RevertToInitiatorTarget()),
    ],
    default_target=TerminateTarget(reason="triage_done"),
    max_turns=20,
)

# Manager-as-initiator (a hand-rolled equivalent of auto_pattern)
WorkflowGraph(
    initial_speaker="manager",
    transitions=[
        Transition(when=ToolCalled("ask_alice"), then=AgentTarget("alice")),
        Transition(when=ToolCalled("ask_bob"),   then=AgentTarget("bob")),
    ],
    default_target=RevertToInitiatorTarget(),
    max_turns=20,
)
```

The manager-as-initiator recipe expresses AG2-classic's `AutoPattern` by hand: the manager agent is in the participant list, gets every off-turn back via `RevertToInitiatorTarget`, and uses `ToolCalled` handoffs to direct. `TransitionGraph.auto_pattern(...)` builds the same shape declaratively and also materializes the `Handoff`-returning routing tools for the selector.

For users moving off `autogen.agentchat.group.patterns`, `from_classic_pattern(pattern, *, selector_id=...)` translates `RoundRobinPattern` and `AutoPattern` instances into the equivalent `TransitionGraph` (other classic patterns raise `UnsupportedPatternError` until their primitive lands).

## Registries — extending the vocabulary

Custom targets and conditions plug in via two-line registration:

```python
@dataclass(slots=True)
class WhenTurnCount:
    n: int
    name: ClassVar[str] = "turn_count"

    def evaluate(self, metadata, state, envelope) -> bool:
        return state.turn_count >= self.n

register_condition(WhenTurnCount)
```

Custom classes serialize the same way built-ins do, as long as they're `@dataclass(slots=True)` with JSON-friendly fields. The registry is process-local; cross-process callers must register the same name on both ends — there's no automatic class shipping.

## Deferred

Kept off the core surface. The Protocol design accommodates each without architectural disruption.

### Compositional conditions
- Full `ContextExpr` evaluator — pure-Python no-LLM expressions over `state.context_vars`. `ContextEquals` covers the simple-equality case today; a richer evaluator ships when callers need it (the open registry accepts custom conditions in two lines).
- `TurnCountReached` — pure-Python no-LLM condition over `state.turn_count`.
- `OnFailure` transitions — saga choreography composed from existing `Transition` vocabulary. Saga skeleton lives in `examples/saga.py`.

### Targets that need new framework primitives
- `RandomTarget` — random speaker pick. Needs a clock-independent RNG abstraction so `Hub.hydrate()` stays deterministic.
- `NestedSessionTarget` — opens a child channel under `parent_channel_id`. Needs close-cascade tweaks.
- `SubGraph` target — composing one workflow into another.

### Cut
- Cross-process auto-shipping of registered classes to a remote hub. Security smell — pickled callable code over the wire is a deserialisation hazard. The cross-process answer is "both ends deploy the same Python."

## Invariants

- A workflow channel is referenced by exactly one `TransitionGraph` for its lifetime; the graph is snapshotted into `metadata.knobs["graph"]` at create time and never mutates.
- `WorkflowState.expected_next_speaker` is always a current participant or `None`. Removing a participant (via `Expectation`'s `remove` handler) falls through to `default_target` on the next turn.
- `TransitionTarget.resolve` and `TransitionCondition.evaluate` are pure functions of `(state, envelope)`. Side-effecting implementations are forbidden — they break `Hub.hydrate()`.
- `WorkflowState.expected_next_speaker` advances exactly once per accepted substantive envelope (`EV_TEXT` or `EV_PACKET`).
- `max_turns` counts substantive envelopes (`EV_TEXT` and `EV_PACKET`); channel-protocol and task envelopes don't increment.
- A silent round — empty body, no routing — still posts an empty `EV_PACKET` so the speaker rotates and the workflow makes progress against `max_turns` / `turn_within`. The receiver may skip their LLM turn on an empty payload; subsequent rotations either find someone with something to say or the channel terminates.
