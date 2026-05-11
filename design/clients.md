# Clients

V1 introduces a small protocol hierarchy:

- `NetworkClient` — abstract participant in a network. Any non-Agent participant kind plugs in here.
- `HubClient` — connection lifecycle, one per process per hub. Wraps a `Link`.
- `AgentClient` — per-registration handle, one per `(Agent, identity, hub)`. The V1 `NetworkClient` implementation backed by an `Agent`.

The split is the trust boundary. Tenant code (`Agent` user tools, future transforms, notify handlers) only runs inside the tenant process. The hub never imports tenant modules and never executes tenant callables.

```
┌─── tenant process ──────────────────────────────────┐
│                                                      │
│   Agent  ←──── notify handler ────  AgentClient ──┐  │
│                                                    │  │
│                                     AgentClient ──┤  │
│                                                    │  │
│                                       HubClient ──┘  │
│                                            │          │
└────────────────────────────────────────────┼──────────┘
                                             │   Link
                                             │
                                       ┌─────▼──────┐
                                       │    Hub     │
                                       └────────────┘
```

A single tenant process holds **one** `HubClient` per hub it connects to, and **one** `AgentClient` per identity it has registered through that connection.

## NetworkClient Protocol

```python
# autogen/beta/network/client/network_client.py

from typing import Protocol


class NetworkClient(Protocol):
    """A participant in a network. AgentClient is the V1 implementation
    backed by an Agent. Future HumanClient / AdminClient implement the
    same Protocol."""

    @property
    def agent_id(self) -> str: ...

    @property
    def passport(self) -> Passport: ...

    @property
    def resume(self) -> Resume: ...

    async def receive(self, envelope: Envelope) -> None:
        """Hub delivers an envelope to this participant. Implementations
        translate it into the local execution model (Agent.ask for
        AgentClient, queue push for HumanClient, etc.)."""

    async def open(
        self,
        *,
        type: str,
        target: str | list[str],
        ttl: str | int | None = None,
        knobs: dict | None = None,
        intent: str | None = None,
        labels: dict[str, str] | None = None,
    ) -> Channel:
        """Open a channel of `type` with `target`."""

    async def disconnect(self) -> None: ...
```

This is the seam future participant types plug into:

| Impl | What it wraps | Lands |
|---|---|---|
| `AgentClient` | An `Agent` running an LLM loop | V1 |
| `HumanClient` | A queue + UI bridge | Stabilization |
| `AdminClient` | Operational tools, no LLM | TBD |

A custom client implementation does not need to inherit from `AgentClient` or vendor any of its internals — implementing the four members of `NetworkClient` is enough.

## HumanClient

`HumanClient` is the non-LLM participant. It satisfies `NetworkClient` directly, holds no `Agent`, and never engages `NetworkPlugin` / `NetworkContextPolicy` (no tool injection, no prompt context). Embedders (CLIs, web apps, WebSocket bridges) drive it from outside the hub through either of two surfaces:

```python
class HumanClient:
    @property
    def agent_id(self) -> str: ...
    @property
    def passport(self) -> Passport: ...
    @property
    def resume(self) -> Resume: ...

    # ── Outgoing ──
    async def send(
        self,
        channel_id: str,
        text: str,
        *,
        audience: list[str] | None = None,
        causation_id: str | None = None,
    ) -> str:
        """Post EV_TEXT into a channel the human participates in.
        Returns the stamped envelope_id."""

    async def open(
        self,
        *,
        type: str,
        target: str | list[str],
        ttl: str | int | None = None,
        knobs: dict | None = None,
        intent: str | None = None,
    ) -> Channel:
        """Open a channel as the initiator. Returns the same Channel handle
        AgentClient.open() returns."""

    async def close_channel(self, channel_id: str, reason: str = "human_closed") -> None: ...

    async def post_envelope(self, envelope: Envelope) -> str:
        """Escape hatch for custom event_types (e.g. workflow EV_PACKET seeds
        built via adapter.build_packet_envelope)."""

    # ── Incoming — push ──
    def on_envelope(self, callback: Callable[[Envelope], Awaitable[None]]) -> None:
        """Register a coroutine fired per inbound notify. Multiple callbacks
        compose; exceptions are logged, never propagate to dispatch."""

    # ── Incoming — pull ──
    async def next_envelope(
        self,
        *,
        predicate: Callable[[Envelope], bool] | None = None,
        timeout: float | None = None,
    ) -> Envelope:
        """Block until the next matching envelope arrives. Raises asyncio.TimeoutError."""

    async def envelopes(self) -> AsyncIterator[Envelope]:
        """Stream every inbound envelope until disconnect()."""

    async def disconnect(self) -> None: ...
```

Registration:

```python
hub_client = HubClient(link=LocalLink(hub))
passport = Passport(name="reviewer-1", owner="acme", kind="human")
human = await hub_client.register_human(passport, resume=Resume(summary="approves payouts"))
```

`HubClient.register_human(...)` is the dedicated entry point. It stamps the passport (same UUID7 path as `register()`), persists under `agents/{id}/`, and returns a `HumanClient`. The agent-flavored `register()` rejects `kind="human"` to keep the two paths obvious.

### What it doesn't try to do

`HumanClient` ships no prompt-the-user logic, no stdin loop, no `human_input_mode`. Those are application policies — they belong above the network primitive. The embedder picks how it surfaces envelopes (CLI prompt, web UI push, WebSocket bridge) and how it accepts replies. The framework guarantees only that:

- `HumanClient` is addressable by `agent_id` and `name` just like any other participant.
- Channels treat human participants identically — the same `consulting` / `conversation` / `discussion` / `workflow` adapters apply.
- Envelopes delivered to a `HumanClient` arrive intact; replies go through the same WAL / adapter-validate / dispatch path as agent replies.

This is enough to compose the common HITL patterns (approval gates, mid-conversation interrupts, manual speaker selection in a group, swarm handoff to a human) from existing primitives without bespoke state machines.

## HubClient

```python
# autogen/beta/network/client/hub_client.py

class HubClient:
    def __init__(
        self,
        link: LocalLink | LinkClient,
        *,
        hub: "Hub | None" = None,
        adapters: list[ChannelAdapter] | None = None,
    ) -> None:
        """Construct a hub connection.

        Pass a ``LocalLink`` and the matching in-process ``hub`` for the
        fast path: register / discovery / mutation execute against the
        hub directly. Pass any other ``LinkClient`` (e.g. ``WsLink``)
        with ``hub=None`` to operate over a wire transport — every
        control-plane call round-trips as ``RpcCallFrame`` / 
        ``RpcResultFrame``, every data-plane send rides ``SendFrame`` /
        ``AcceptFrame``, and inbound notifies travel as
        ``NotifyFrame`` / ``ChunkFrame`` / ``ReceiptFrame``. The public
        surface is identical either way; only the cost model differs.

        ``adapters`` seeds the client-side adapter registry used in
        wire mode to resolve ``adapter_for`` / ``default_view_policy``
        without round-tripping (adapter code can't be serialised).
        Defaults to the built-ins (``consulting``, ``conversation``,
        ``discussion``, ``workflow``)."""

    async def register(
        self,
        agent: Agent,
        passport: Passport,
        resume: Resume,
        *,
        skill_md: str | None = None,
        rule: Rule | None = None,
        attach_plugin: bool = True,
    ) -> AgentClient:
        """Stamp agent_id, persist passport + resume + optional SKILL.md + rule,
        attach NetworkPlugin to the Agent (so verbs become agent.tools), return
        the bound AgentClient."""

    async def attach(
        self,
        agent: Agent,
        *,
        name: str,
        attach_plugin: bool = True,
    ) -> AgentClient:
        """Reconnect ``agent`` to an existing identity by ``name``.
        Binds this connection's endpoint to the existing ``agent_id``
        and re-fires the default handler against any pending turns
        the prior incarnation left behind."""

    async def list_agents(
        self, *,
        capability: str | None = None,
        query: str | None = None,
        sort_by: str | None = None,
        limit: int = 50,
    ) -> list[Passport]: ...

    async def get_agent(self, name_or_id: str) -> Passport: ...
    async def get_resume(self, agent_id: str) -> Resume: ...
    async def get_skill(self, agent_id: str) -> str | None: ...

    async def close(self) -> None:
        """Disconnect; existing AgentClients become no-ops on send."""

    async def shutdown(self) -> None:
        """Unregister every AgentClient, then close()."""
```

## AgentClient

```python
# autogen/beta/network/client/agent_client.py

class AgentClient:
    @property
    def agent(self) -> Agent: ...
    @property
    def passport(self) -> Passport: ...
    @property
    def resume(self) -> Resume: ...
    @property
    def agent_id(self) -> str: ...

    # NetworkClient impl
    async def receive(self, envelope: Envelope) -> None:
        """Hub delivers; AgentClient routes to the registered handler."""

    async def open(
        self,
        type: str,
        target: str | list[str],
        *,
        ttl: str | int | None = None,
        knobs: dict | None = None,
        labels: dict[str, str] | None = None,
        view_policy: ViewPolicy | None = None,
        intent: str | None = None,
    ) -> Channel: ...

    # Handler registry — override the default per session type
    def on(self, session_type: str) -> Callable: ...

    def on_task(self, spec_type: str = "*") -> Callable: ...

    # Building blocks for custom handlers (used by default handler too)
    async def read_wal_until(self, envelope: Envelope) -> list[Envelope]: ...
    def resolve_view_policy(self, session: Channel, envelope: Envelope) -> ViewPolicy: ...
    def stamp_dependencies(self, session: Channel, envelope: Envelope) -> dict: ...

    # Discovery passthrough (used by `peers` tool)
    async def list_peers(self, **kwargs) -> list[Passport]: ...
    async def describe_peer(self, name_or_id: str) -> PeerDescription:
        """Returns {passport, resume, skill_md} — the LLM-facing peer profile.
        SKILL.md content is included when present; otherwise a generated
        fallback is rendered from resume.summary + capabilities."""

    # Identity mutation — tenant-driven; not exposed on the LLM tool surface
    async def set_resume(self, resume: Resume) -> None: ...
    async def add_example(self, example: ResumeExample) -> None: ...
    async def set_skill(self, skill_md: str | None) -> None: ...
    async def set_rule(self, rule: Rule) -> None: ...

    # Send / receive hooks (Phase 3 — replaces the prior `transforms` design).
    def add_send_hook(self, hook: Callable[[Envelope], Envelope | None]) -> None:
        """Register a callable run on every outbound envelope before
        the hub sees it. Returning ``None`` drops the envelope;
        returning an ``Envelope`` replaces it. Hooks run in
        registration order."""

    def add_receive_hook(self, hook: Callable[[Envelope], Envelope | None]) -> None:
        """Register a callable run on every inbound envelope before
        the notify handler. Same semantics as ``add_send_hook``."""

    # Low-level
    async def inbox_iter(self) -> AsyncIterator[Envelope]:
        """For custom handlers that bypass the per-session-type registry."""

    async def disconnect(self) -> None: ...
    async def unregister(self) -> None: ...
```

## Default notify handlers

Per session type, the framework ships a default handler. The handler is decomposed into small public hooks so `@client.on("...")` overrides only need to replace what they care about — not re-implement the whole flow:

```python
# autogen/beta/network/client/handlers.py

async def default_handler(envelope: Envelope, client: AgentClient) -> None:
    session = await client._session(envelope.channel_id)
    view_policy = client.resolve_view_policy(session, envelope)
    wal = await client.read_wal_until(envelope)
    projection = await view_policy.project(
        wal, participant_id=client.agent_id, session=session.metadata,
    )

    # Phase 2.0: dedup duplicate replies after redelivery.
    prior = client._hub.find_envelope_by_causation(
        envelope.channel_id,
        sender_id=client.agent_id,
        causation_id=envelope.envelope_id,
    )
    if prior is not None:
        return  # already replied to this envelope; redelivery is a no-op

    deps = client.stamp_dependencies(session, envelope)
    reply = await client.agent.ask(
        *projection,
        envelope_to_input(envelope),
        dependencies=deps,
    )
    if reply.body:
        await session.send(reply.body, causation_id=envelope.envelope_id)
```

The `NetworkPlugin` — attached at registration — already added the LLM verbs to `agent.tools`, so the handler doesn't need to inject them per turn. Tools resolve their bindings from the dependencies stamped by `stamp_dependencies`.

**Resume on reconnect (Phase 2.0)**: on `HubClient.open` (the connection-level hello), the `AgentClient` calls `Hub.pending_turns_for(self.agent_id)` and, for each `PendingTurn`, fetches the triggering envelope and runs `default_handler` against it. Same code path as a live notify; the dedup query above ensures redelivery is idempotent. No new resume-specific branch in user-visible code.

## Trust boundary recap

| What | Runs where | Why |
|---|---|---|
| `access`, `limits` | Hub | Cross-tenant, cross-call state |
| Notify handlers | Tenant process | Tenant code |
| Future transforms | Tenant process | Tenant business logic |
| LLM tool execution | Tenant process | Tenant code |

Even when running everything in one process for tests, the split is preserved: it is the trust model, not a deployment optimisation. A compromised or hostile hub cannot bypass tenant-side enforcement (when transforms ship in Phase 3).
