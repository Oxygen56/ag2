# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""``HubClient`` — one connection to one hub per process.

Two modes share the same public surface:

* **In-process** — constructed with an in-memory ``LocalLink`` and a
  direct ``hub`` reference. Control-plane calls cut through wire
  serialisation and execute on the hub synchronously.
* **Wire** — constructed with any ``LinkClient`` (e.g. ``WsLink``)
  and ``hub=None``. Control-plane calls travel as ``RpcCallFrame``
  pairs; the same ``NotifyFrame`` / ``ChunkFrame`` / ``ReceiptFrame``
  vocabulary handles the data plane.

The client lazy-opens the link on first use, demuxes inbound notifies
to the right ``AgentClient``, maintains a small discovery cache
invalidated by hub-pushed ``NetworkChangedFrame``s, and (in wire mode)
keeps a name → agent_id mirror so adapters that translate handoff
targets see the same map either side of the wire.
"""

import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from autogen.beta.agent import Agent
from autogen.beta.task import TaskMetadata, TaskSpec, TaskState

from ..adapters.base import ChannelAdapter
from ..adapters.consulting import ConsultingAdapter
from ..adapters.conversation import ConversationAdapter
from ..adapters.discussion import DiscussionAdapter
from ..adapters.workflow import WorkflowAdapter
from ..channel import ChannelMetadata, ChannelState
from ..envelope import Envelope
from ..errors import AccessDeniedError, NetworkError, NotFoundError, ProtocolError
from ..hub.core import PendingTurn
from ..identity import Passport, Resume
from ..rule import Rule
from ..transport.frames import (
    AcceptFrame,
    ChunkFrame,
    ErrorFrame,
    HelloFrame,
    NetworkChangedFrame,
    NotifyFrame,
    ReceiptFrame,
    RpcCallFrame,
    RpcResultFrame,
    SendFrame,
)
from ..transport.link import LinkClient
from ..transport.local import LocalLink
from ..views.base import ViewPolicy
from .agent_client import AgentClient
from .chunks import ChunkDelta
from .plugin import NetworkPlugin

if TYPE_CHECKING:
    from ..hub import Hub

__all__ = ("HubClient",)


logger = logging.getLogger(__name__)


def _builtin_adapters() -> list[ChannelAdapter]:
    """Adapters registered client-side by default in wire mode."""
    return [ConsultingAdapter(), ConversationAdapter(), DiscussionAdapter(), WorkflowAdapter()]


class HubClient:
    """One connection to a hub. Multiple ``AgentClient``s register through it.

    Pass a ``LocalLink`` together with the in-process ``hub`` for fast
    in-process callers, or pass a ``LinkClient`` factory (e.g. ``WsLink``)
    with ``hub=None`` to operate over a wire transport. The public
    method surface is identical either way; wire-mode calls round-trip
    via ``RpcCallFrame`` pairs while in-process calls execute against
    the hub directly.

    A single tenant process should hold one ``HubClient`` per hub it
    connects to.
    """

    def __init__(
        self,
        link: "LocalLink | LinkClient",
        *,
        hub: "Hub | None" = None,
        adapters: list[ChannelAdapter] | None = None,
    ) -> None:
        # __init__ stores params; side effects deferred to register()/close().
        self._link = link
        # ``link.hub`` is a ``LocalLink``-specific attribute used to
        # derive the in-process fast-path target. Wire-mode links don't
        # have it; we run as ``hub=None`` and route every call through
        # ``RpcCallFrame``.
        if hub is not None:
            self._hub: Hub | None = hub
        elif hasattr(link, "hub"):
            self._hub = link.hub  # type: ignore[assignment]
        else:
            self._hub = None
        self._wire_mode = self._hub is None
        self._client_link: LinkClient | None = None
        self._receive_task: asyncio.Task[None] | None = None
        self._clients: dict[str, AgentClient] = {}
        self._closed = False

        # Discovery cache for ``list_agents`` / ``get_agent`` /
        # ``get_resume`` / ``get_skill``. Each entry is a single result
        # keyed by call args. A ``NetworkChangedFrame`` from the hub
        # clears the entire dict — invalidation is event-driven, not
        # TTL-driven, because the hub is the only writer to the data
        # we cache.
        self._discovery_cache: dict[tuple[object, ...], object] = {}

        # Pending-RPC bookkeeping (wire mode only). ``_rpc`` posts an
        # ``RpcCallFrame`` keyed by a fresh request id, awaits the
        # matching ``RpcResultFrame`` via the future stored here.
        self._pending_rpc: dict[str, asyncio.Future[Any]] = {}

        # Pending ``SendFrame``-issued posts (wire mode only). The link
        # is single-consumer in-order, so we pair an inbound
        # ``AcceptFrame`` / ``ErrorFrame`` with the oldest outstanding
        # send by FIFO order.
        self._pending_sends: list[asyncio.Future[str]] = []

        # Client-side adapter registry. Used in wire mode for
        # ``adapter_for`` / ``default_view_policy`` / ``adapter_state``
        # so we don't need to round-trip for adapter code (which is
        # not data and can't be serialised). Both ends must register
        # the same adapter classes.
        self._adapter_registry: dict[tuple[str, int], ChannelAdapter] = {}
        chosen_adapters = adapters if adapters is not None else _builtin_adapters()
        for adapter in chosen_adapters:
            self._adapter_registry[(adapter.manifest.type, adapter.manifest.version)] = adapter

        # Wire-mode name → agent_id mirror. Populated as identities are
        # learned (register, get_agent, list_agents) and invalidated on
        # ``NetworkChangedFrame``. Adapters that translate handoff
        # target names (e.g. ``WorkflowAdapter``) read this dict.
        self._name_to_id: dict[str, str] = {}

        # Wire-mode adapter state cache. Maps channel_id → folded state.
        # Populated lazily by ``adapter_state`` (which walks the WAL via
        # RPC) and folded forward as ``NotifyFrame``s arrive. Cleared on
        # channel close. In-process callers never read this — they hit
        # the hub directly.
        self._wire_adapter_states: dict[str, object] = {}

    # ── Connection ───────────────────────────────────────────────────────────

    async def _ensure_connected(self) -> LinkClient:
        """Open the link on first use; subsequent calls reuse the connection.

        Async so wire transports can await the underlying ``open()``
        (e.g. ``websockets.connect``). ``LocalLinkClient.open`` is a
        no-op, so in-process callers see no behaviour change.
        """
        if self._client_link is None:
            client_link = self._link.client()  # type: ignore[union-attr]
            await client_link.open()
            self._client_link = client_link
            self._receive_task = asyncio.create_task(self._receive_loop())
        return self._client_link

    async def _receive_loop(self) -> None:
        """Demultiplex inbound frames to the appropriate ``AgentClient``."""
        assert self._client_link is not None
        try:
            async for frame in self._client_link.frames():
                if isinstance(frame, NotifyFrame):
                    try:
                        await self._dispatch_notify(frame)
                    except Exception:
                        logger.exception(
                            "receive loop dispatch failed: channel=%s event=%s recipient=%s",
                            frame.envelope.channel_id,
                            frame.envelope.event_type,
                            frame.recipient_id,
                        )
                elif isinstance(frame, ChunkFrame):
                    try:
                        await self._dispatch_chunk(frame)
                    except Exception:
                        logger.exception(
                            "receive loop chunk dispatch failed: channel=%s parent=%s recipient=%s",
                            frame.channel_id,
                            frame.parent_envelope_id,
                            frame.recipient_id,
                        )
                elif isinstance(frame, NetworkChangedFrame):
                    # Hub-pushed cache invalidation. One frame per
                    # identity mutation; nuke everything we cached
                    # rather than reasoning about which entries the
                    # mutation touches. Also drop the name mirror
                    # entries — they'll repopulate on next discovery.
                    self._discovery_cache.clear()
                    if frame.change in ("agent_unregistered",):
                        # Find the name bound to this id and forget it.
                        stale_names = [n for n, aid in self._name_to_id.items() if aid == frame.agent_id]
                        for name in stale_names:
                            self._name_to_id.pop(name, None)
                elif isinstance(frame, RpcResultFrame):
                    future = self._pending_rpc.pop(frame.request_id, None)
                    if future is not None and not future.done():
                        if frame.error is not None:
                            future.set_exception(_rpc_error_to_exception(frame.error))
                        else:
                            future.set_result(frame.result)
                else:
                    # ``AcceptFrame`` / ``ErrorFrame`` pair with the
                    # oldest outstanding ``SendFrame`` in FIFO order.
                    # Other kinds (Pong, Event) currently have no
                    # demuxer — they bypass.
                    if isinstance(frame, AcceptFrame):
                        send_future = self._pending_sends.pop(0) if self._pending_sends else None
                        if send_future is not None and not send_future.done():
                            send_future.set_result(frame.envelope_id)
                    elif isinstance(frame, ErrorFrame):
                        send_future = self._pending_sends.pop(0) if self._pending_sends else None
                        if send_future is not None and not send_future.done():
                            send_future.set_exception(
                                _rpc_error_to_exception({"code": frame.code, "message": frame.message})
                            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("receive loop terminated unexpectedly")

    async def _dispatch_chunk(self, frame: ChunkFrame) -> None:
        """Route an inbound chunk to the matching ``AgentClient``."""
        if not frame.recipient_id:
            return
        client = self._clients.get(frame.recipient_id)
        if client is None:
            return
        delta = ChunkDelta(
            sender_id=frame.sender_id,
            sequence=frame.sequence,
            text=frame.text,
            is_final=frame.is_final,
        )
        await client.receive_chunk(
            delta,
            channel_id=frame.channel_id,
            parent_envelope_id=frame.parent_envelope_id,
        )

    async def _dispatch_notify(self, frame: NotifyFrame) -> None:
        """Route the envelope to the recipient stamped on the frame.

        In wire mode the adapter-state mirror is folded forward as
        envelopes arrive so subsequent ``can_send`` / ``adapter_state``
        queries don't have to re-fetch the WAL.
        """
        envelope = frame.envelope
        if self._wire_mode and envelope.channel_id in self._wire_adapter_states:
            adapter = self._adapter_registry.get(self._wire_channel_key(envelope.channel_id))
            if adapter is not None:
                self._wire_adapter_states[envelope.channel_id] = adapter.fold(
                    envelope, self._wire_adapter_states[envelope.channel_id]
                )
        if frame.recipient_id:
            client = self._clients.get(frame.recipient_id)
            if client is not None:
                await client.receive(envelope)
            return
        if envelope.audience is None:
            return
        for recipient_id in envelope.audience:
            client = self._clients.get(recipient_id)
            if client is not None:
                await client.receive(envelope)

    # Wire-mode helpers — track channel manifest type/version so the
    # local adapter registry can resolve without an extra round trip
    # on every fold.
    def _wire_channel_key(self, channel_id: str) -> tuple[str, int]:
        cached = self._discovery_cache.get(("__wire_channel_key__", channel_id))
        if isinstance(cached, tuple):
            return cached  # type: ignore[return-value]
        # Default key — caller is responsible for populating via a real
        # ``get_channel`` round trip before relying on it.
        return ("", 0)

    def _remember_wire_channel(self, metadata: ChannelMetadata) -> None:
        self._discovery_cache[("__wire_channel_key__", metadata.channel_id)] = (
            metadata.manifest.type,
            metadata.manifest.version,
        )

    # ── Wire-mode RPC helper ─────────────────────────────────────────────────

    async def _rpc(self, method: str, **args: Any) -> Any:
        """Issue a control-plane RPC over the wire. Hub-mode callers
        bypass this entirely.

        Raises a ``NetworkError`` subclass matching the server-side
        error code; raises ``RuntimeError`` if the link drops before
        the result lands.
        """
        client_link = await self._ensure_connected()
        request_id = uuid4().hex
        future: asyncio.Future[Any] = asyncio.get_event_loop().create_future()
        self._pending_rpc[request_id] = future
        try:
            await client_link.send_frame(RpcCallFrame(request_id=request_id, method=method, args=args))
            return await future
        finally:
            self._pending_rpc.pop(request_id, None)

    # ── Registration ─────────────────────────────────────────────────────────

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
        """Register an agent and return its ``AgentClient`` handle.

        In wire mode, sends an ``RpcCallFrame(method="register")``; the
        hub stamps the ``agent_id``, persists, and binds the new id to
        this endpoint before returning. In-process mode does the same
        work via a direct hub call.

        ``attach_plugin=True`` (default) attaches the ``NetworkPlugin``
        which adds ``say`` and ``delegate`` to ``agent.tools`` and
        appends ``NetworkContextPolicy`` to the assembly chain.
        """
        if self._closed:
            raise RuntimeError("HubClient is closed")

        client_link = await self._ensure_connected()
        effective_rule = rule if rule is not None else Rule()

        if self._hub is not None:
            stamped = await self._hub.register(passport, resume, skill_md=skill_md, rule=effective_rule)
            assert stamped.agent_id is not None
            self._hub.bind_endpoint(client_link.endpoint_id, stamped.agent_id)
        else:
            payload = await self._rpc(
                "register",
                passport=passport.to_dict(),
                resume=resume.to_dict(),
                skill_md=skill_md,
                rule=effective_rule.to_dict(),
            )
            stamped = Passport.from_dict(payload["passport"])

        assert stamped.agent_id is not None
        self._name_to_id[stamped.name] = stamped.agent_id

        client = AgentClient(
            agent=agent,
            passport=stamped,
            resume=resume,
            rule=effective_rule,
            hub=self._hub,
            hub_client=self,
        )
        self._clients[stamped.agent_id] = client

        if attach_plugin:
            plugin = NetworkPlugin(client)
            plugin.register(agent)

        return client

    async def attach(
        self,
        agent: Agent,
        *,
        name: str,
        attach_plugin: bool = True,
    ) -> AgentClient:
        """Reconnect ``agent`` to an existing identity by name.

        Looks up the existing ``agent_id`` for ``name``, binds this
        connection's endpoint to it, constructs a fresh ``AgentClient``,
        and resumes any pending turns the prior incarnation left behind.
        """
        if self._closed:
            raise RuntimeError("HubClient is closed")

        client_link = await self._ensure_connected()

        if self._hub is not None:
            passport = await self._hub.get_agent(name)
            if passport.agent_id is None:
                raise RuntimeError(f"agent {name!r} has no agent_id")
            agent_id = passport.agent_id
            resume = await self._hub.get_resume(agent_id)
            rule = self._hub.get_rule(agent_id)
            self._hub.bind_endpoint(client_link.endpoint_id, agent_id)
        else:
            payload = await self._rpc("get_agent", name_or_id=name)
            passport = Passport.from_dict(payload["passport"])
            if passport.agent_id is None:
                raise RuntimeError(f"agent {name!r} has no agent_id")
            agent_id = passport.agent_id
            resume_payload = await self._rpc("get_resume", agent_id=agent_id)
            resume = Resume.from_dict(resume_payload["resume"])
            # No public ``get_rule`` RPC yet — wire-mode attach uses a
            # default ``Rule``. This means tenant-supplied limits don't
            # round-trip on reconnect; tenants needing a tightened rule
            # call ``set_rule`` after attach.
            rule = Rule()
            # Issue a ``HelloFrame`` so the hub binds this endpoint to
            # the existing identity for inbound dispatch.
            await client_link.send_frame(HelloFrame(name=name))

        self._name_to_id[passport.name] = agent_id

        client = AgentClient(
            agent=agent,
            passport=passport,
            resume=resume,
            rule=rule,
            hub=self._hub,
            hub_client=self,
        )
        self._clients[agent_id] = client

        if attach_plugin:
            plugin = NetworkPlugin(client)
            plugin.register(agent)

        # Wake up any unfinished turns from before the disconnect.
        await client.resume_pending_turns()

        return client

    # ── Discovery ────────────────────────────────────────────────────────────

    async def get_agent(self, name_or_id: str) -> Passport:
        key = ("get_agent", name_or_id)
        cached = self._discovery_cache.get(key)
        if cached is not None:
            return cached  # type: ignore[return-value]
        if self._hub is not None:
            passport = await self._hub.get_agent(name_or_id)
        else:
            payload = await self._rpc("get_agent", name_or_id=name_or_id)
            passport = Passport.from_dict(payload["passport"])
        self._discovery_cache[key] = passport
        if passport.agent_id is not None:
            self._name_to_id[passport.name] = passport.agent_id
        return passport

    async def get_resume(self, agent_id: str) -> Resume:
        key = ("get_resume", agent_id)
        cached = self._discovery_cache.get(key)
        if cached is not None:
            return cached  # type: ignore[return-value]
        if self._hub is not None:
            resume = await self._hub.get_resume(agent_id)
        else:
            payload = await self._rpc("get_resume", agent_id=agent_id)
            resume = Resume.from_dict(payload["resume"])
        self._discovery_cache[key] = resume
        return resume

    async def get_skill(self, agent_id: str) -> str | None:
        key = ("get_skill", agent_id)
        if key in self._discovery_cache:
            return self._discovery_cache[key]  # type: ignore[return-value]
        if self._hub is not None:
            skill = await self._hub.get_skill(agent_id)
        else:
            payload = await self._rpc("get_skill", agent_id=agent_id)
            skill = payload.get("skill_md")
        self._discovery_cache[key] = skill
        return skill

    async def list_agents(
        self,
        *,
        capability: str | None = None,
        query: str | None = None,
        sort_by: str | None = None,
        limit: int = 50,
    ) -> list[Passport]:
        key = ("list_agents", capability, query, sort_by, limit)
        cached = self._discovery_cache.get(key)
        if cached is not None:
            return list(cached)  # type: ignore[arg-type]
        if self._hub is not None:
            result = await self._hub.list_agents(
                capability=capability,
                query=query,
                sort_by=sort_by,
                limit=limit,
            )
        else:
            payload = await self._rpc(
                "list_agents",
                capability=capability,
                query=query,
                sort_by=sort_by,
                limit=limit,
            )
            result = [Passport.from_dict(p) for p in payload["agents"]]
        self._discovery_cache[key] = result
        for passport in result:
            if passport.agent_id is not None:
                self._name_to_id[passport.name] = passport.agent_id
        return result

    # ── Receipt path ─────────────────────────────────────────────────────────

    async def _send_receipt(
        self,
        *,
        envelope_id: str,
        channel_id: str,
        status: str,
        reason: str = "",
    ) -> None:
        """Send a ``ReceiptFrame`` back to the hub via the link.

        Hub uses receipts to advance the per-(agent, channel) inbox
        cursor; a wire reconnect replays only what's past the cursor.
        Silently skipped if the link isn't open — receipts are a
        durability optimization, not a correctness primitive.
        """
        if self._client_link is None:
            return
        await self._client_link.send_frame(
            ReceiptFrame(
                envelope_id=envelope_id,
                channel_id=channel_id,
                status=status,
                reason=reason,
            )
        )

    # ── Identity mutation ────────────────────────────────────────────────────

    async def set_resume(self, agent_id: str, resume: Resume) -> None:
        if self._hub is not None:
            await self._hub.set_resume(agent_id, resume)
        else:
            await self._rpc("set_resume", agent_id=agent_id, resume=resume.to_dict())

    async def set_skill(self, agent_id: str, skill_md: str | None) -> None:
        if self._hub is not None:
            await self._hub.set_skill(agent_id, skill_md)
        else:
            await self._rpc("set_skill", agent_id=agent_id, skill_md=skill_md)

    async def set_rule(self, agent_id: str, rule: Rule) -> None:
        if self._hub is not None:
            await self._hub.set_rule(agent_id, rule)
        else:
            await self._rpc("set_rule", agent_id=agent_id, rule=rule.to_dict())

    async def unregister_agent(self, agent_id: str) -> None:
        if self._hub is not None:
            await self._hub.unregister(agent_id)
        else:
            await self._rpc("unregister", agent_id=agent_id)
        # Drop the name-to-id mirror entry on local unregister so
        # subsequent re-registers under the same name use the fresh id.
        stale_names = [name for name, aid in self._name_to_id.items() if aid == agent_id]
        for name in stale_names:
            self._name_to_id.pop(name, None)

    # ── Channel control ──────────────────────────────────────────────────────

    async def create_channel(
        self,
        *,
        creator_id: str,
        manifest_type: str,
        manifest_version: int = 1,
        participants: list[str],
        required_acks: int | None = None,
        ttl: str | int | None = None,
        knobs: dict[str, object] | None = None,
        intent: str | None = None,
        labels: dict[str, str] | None = None,
    ) -> ChannelMetadata:
        if self._hub is not None:
            metadata = await self._hub.create_channel(
                creator_id=creator_id,
                manifest_type=manifest_type,
                manifest_version=manifest_version,
                participants=participants,
                required_acks=required_acks,
                ttl=ttl,
                knobs=knobs,
                intent=intent,
                labels=labels,
            )
        else:
            payload = await self._rpc(
                "create_channel",
                creator_id=creator_id,
                manifest_type=manifest_type,
                manifest_version=manifest_version,
                participants=participants,
                required_acks=required_acks,
                ttl=ttl,
                knobs=knobs,
                intent=intent,
                labels=labels,
            )
            metadata = ChannelMetadata.from_dict(payload["channel"])
        self._remember_wire_channel(metadata)
        return metadata

    async def get_channel(self, channel_id: str) -> ChannelMetadata:
        if self._hub is not None:
            metadata = await self._hub.get_channel(channel_id)
        else:
            payload = await self._rpc("get_channel", channel_id=channel_id)
            metadata = ChannelMetadata.from_dict(payload["channel"])
        self._remember_wire_channel(metadata)
        return metadata

    async def list_channels(
        self,
        *,
        agent_id: str | None = None,
        include_terminal: bool = False,
        limit: int = 50,
    ) -> list[ChannelMetadata]:
        if self._hub is not None:
            results = await self._hub.list_channels(agent_id=agent_id, limit=limit * 4)
        else:
            payload = await self._rpc("list_channels", agent_id=agent_id, limit=limit * 4)
            results = [ChannelMetadata.from_dict(m) for m in payload["channels"]]
        if not include_terminal:
            results = [m for m in results if m.state not in (ChannelState.CLOSED, ChannelState.EXPIRED)]
        return results[:limit]

    async def close_channel(self, channel_id: str, *, reason: str = "") -> ChannelMetadata:
        if self._hub is not None:
            return await self._hub.close_channel(channel_id, reason=reason)
        payload = await self._rpc("close_channel", channel_id=channel_id, reason=reason)
        # Drop the wire-mode adapter-state mirror for closed channels.
        self._wire_adapter_states.pop(channel_id, None)
        return ChannelMetadata.from_dict(payload["channel"])

    async def post_envelope(self, envelope: Envelope) -> str:
        if self._hub is not None:
            return await self._hub.post_envelope(envelope)
        # Wire mode: send via ``SendFrame`` and await the matching
        # ``AcceptFrame`` (success) or ``ErrorFrame`` (failure). The
        # link is single-consumer in-order, so the next inbound
        # Accept/Error pairs with this send via FIFO.
        client_link = await self._ensure_connected()
        # ``SendFrame`` doesn't carry a request id; we use a single
        # outstanding-post slot keyed on envelope content. Since the
        # link is single-consumer, ordering matches and the next
        # Accept/Error pairs with this send.
        future: asyncio.Future[str] = asyncio.get_event_loop().create_future()
        self._pending_sends.append(future)
        await client_link.send_frame(SendFrame(envelope=envelope))
        try:
            return await future
        finally:
            with contextlib.suppress(ValueError):
                self._pending_sends.remove(future)

    async def post_chunk(self, frame: ChunkFrame) -> None:
        """Hand a streaming chunk to the hub for fan-out.

        Chunks are ephemeral — not persisted to the WAL. The hub
        validates the sender owns the parent envelope and forwards
        one ``ChunkFrame`` per recipient.
        """
        if self._hub is not None:
            await self._hub.post_chunk(frame)
            return
        client_link = await self._ensure_connected()
        await client_link.send_frame(frame)

    async def read_wal(self, channel_id: str, *, since: int = 0, until: int | None = None) -> list[Envelope]:
        if self._hub is not None:
            return await self._hub.read_wal(channel_id, since=since, until=until)
        payload = await self._rpc("read_wal", channel_id=channel_id, since=since, until=until)
        return [Envelope.from_dict(e) for e in payload["envelopes"]]

    async def find_envelope_by_causation(
        self,
        channel_id: str,
        *,
        sender_id: str,
        causation_id: str,
    ) -> Envelope | None:
        """Idempotency query.

        In-process: O(1) lookup against the hub's causation index.
        Wire mode: RPC round trip — the hub still answers in O(1) from
        its in-memory index; only the transport cost differs.
        """
        if self._hub is not None:
            return self._hub.find_envelope_by_causation(channel_id, sender_id=sender_id, causation_id=causation_id)
        payload = await self._rpc(
            "find_envelope_by_causation",
            channel_id=channel_id,
            sender_id=sender_id,
            causation_id=causation_id,
        )
        body = payload.get("envelope")
        return Envelope.from_dict(body) if body is not None else None

    async def pending_turns_for(self, agent_id: str) -> list[PendingTurn]:
        if self._hub is not None:
            return await self._hub.pending_turns_for(agent_id)
        payload = await self._rpc("pending_turns_for", agent_id=agent_id)
        return [
            PendingTurn(
                channel_id=t["channel_id"],
                last_envelope_id=t["last_envelope_id"],
                reason=t["reason"],
            )
            for t in payload["turns"]
        ]

    async def can_send(
        self,
        channel_id: str,
        sender_id: str,
        *,
        event_type: str | None = None,
    ) -> bool:
        if self._hub is not None:
            return self._hub.can_send(channel_id, sender_id, event_type=event_type)
        payload = await self._rpc(
            "can_send",
            channel_id=channel_id,
            sender_id=sender_id,
            event_type=event_type,
        )
        return bool(payload.get("allowed"))

    async def default_view_policy(self, channel_id: str, participant_id: str) -> ViewPolicy:
        if self._hub is not None:
            return self._hub.default_view_policy(channel_id, participant_id)
        metadata = await self.get_channel(channel_id)
        adapter = self._adapter_registry.get((metadata.manifest.type, metadata.manifest.version))
        if adapter is None:
            raise NotFoundError(
                f"no client-side adapter registered for {metadata.manifest.type!r}@v{metadata.manifest.version}"
            )
        return adapter.default_view_policy(metadata, participant_id)

    async def adapter_for(self, channel_id: str) -> ChannelAdapter:
        """Resolve the adapter for ``channel_id``.

        In-process: returns the hub's adapter instance. Wire mode:
        fetches channel metadata via RPC and looks up the adapter in
        the client-side registry (both ends must register the same
        adapter classes).
        """
        if self._hub is not None:
            return self._hub.adapter_for(channel_id)
        metadata = await self.get_channel(channel_id)
        adapter = self._adapter_registry.get((metadata.manifest.type, metadata.manifest.version))
        if adapter is None:
            raise NotFoundError(
                f"no client-side adapter registered for {metadata.manifest.type!r}@v{metadata.manifest.version}"
            )
        return adapter

    async def adapter_state(self, channel_id: str) -> object | None:
        """Return the folded ``AdapterState`` for ``channel_id``.

        In-process: O(1) lookup from the hub's cache. Wire mode: walks
        the WAL via RPC once, folds via the client-side adapter, and
        caches; subsequent calls update incrementally as
        ``NotifyFrame``s arrive on the receive loop.
        """
        if self._hub is not None:
            return self._hub.adapter_state(channel_id)
        cached = self._wire_adapter_states.get(channel_id)
        if cached is not None:
            return cached
        metadata = await self.get_channel(channel_id)
        adapter = self._adapter_registry.get((metadata.manifest.type, metadata.manifest.version))
        if adapter is None:
            return None
        state = adapter.initial_state(metadata)
        wal = await self.read_wal(channel_id)
        for envelope in wal:
            state = adapter.fold(envelope, state)
        self._wire_adapter_states[channel_id] = state
        return state

    # ── Task observation ─────────────────────────────────────────────────────

    async def get_task(self, task_id: str) -> TaskMetadata:
        if self._hub is not None:
            return await self._hub.get_task(task_id)
        payload = await self._rpc("get_task", task_id=task_id)
        return _task_metadata_from_wire(payload["metadata"])

    async def list_tasks(
        self,
        *,
        agent_id: str | None = None,
        channel_id: str | None = None,
        state: TaskState | None = None,
        limit: int = 50,
    ) -> list[TaskMetadata]:
        if self._hub is not None:
            return await self._hub.list_tasks(
                agent_id=agent_id,
                channel_id=channel_id,
                state=state,
                limit=limit,
            )
        payload = await self._rpc(
            "list_tasks",
            agent_id=agent_id,
            channel_id=channel_id,
            state=state.value if state is not None else None,
            limit=limit,
        )
        return [_task_metadata_from_wire(t) for t in payload["tasks"]]

    async def observe_task(self, metadata: TaskMetadata) -> None:
        if self._hub is not None:
            await self._hub.observe_task(metadata)
            return
        await self._rpc("observe_task", metadata=_task_metadata_to_wire(metadata))

    async def update_task(
        self,
        task_id: str,
        *,
        state: TaskState | None = None,
        progress: dict[str, object] | None = None,
        result: object | None = None,
        error: str | None = None,
    ) -> None:
        if self._hub is not None:
            await self._hub.update_task(
                task_id,
                state=state,
                progress=progress,
                result=result,
                error=error,
            )
            return
        await self._rpc(
            "update_task",
            task_id=task_id,
            state=state.value if state is not None else None,
            progress=progress,
            result=result,
            error=error,
        )

    async def record_observation(
        self,
        *,
        owner_id: str,
        capability: str,
        outcome: TaskState,
        latency_ms: int | None = None,
        task_id: str | None = None,
    ) -> None:
        if self._hub is not None:
            await self._hub.record_observation(
                owner_id=owner_id,
                capability=capability,
                outcome=outcome,
                latency_ms=latency_ms,
                task_id=task_id,
            )
            return
        await self._rpc(
            "record_observation",
            owner_id=owner_id,
            capability=capability,
            outcome=outcome.value,
            latency_ms=latency_ms,
            task_id=task_id,
        )

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the connection and stop the receive loop. Idempotent."""
        if self._closed:
            return
        self._closed = True
        # Fail any in-flight RPCs / sends so awaiters don't hang.
        for future in list(self._pending_rpc.values()):
            if not future.done():
                future.set_exception(RuntimeError("HubClient closed"))
        self._pending_rpc.clear()
        for future in list(self._pending_sends):
            if not future.done():
                future.set_exception(RuntimeError("HubClient closed"))
        self._pending_sends.clear()
        if self._client_link is not None:
            await self._client_link.close()
        if self._receive_task is not None:
            self._receive_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._receive_task

    async def shutdown(self) -> None:
        """Unregister every ``AgentClient`` then ``close()``."""
        for client in list(self._clients.values()):
            with contextlib.suppress(Exception):
                await client.unregister()
        self._clients.clear()
        await self.close()

    async def __aenter__(self) -> "HubClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()


# ── Wire-side task metadata coercion ────────────────────────────────────────


def _task_metadata_to_wire(metadata: TaskMetadata) -> dict[str, Any]:
    """Serialise ``TaskMetadata`` for wire transport.

    Matches the on-disk layout the hub's ``_task_metadata_to_dict`` uses
    so the same ``_rpc`` handler on the server side can deserialise.
    """
    return {
        "task_id": metadata.task_id,
        "owner_id": metadata.owner_id,
        "spec": {
            "title": metadata.spec.title,
            "description": metadata.spec.description,
            "payload": dict(metadata.spec.payload),
            "capability": metadata.spec.capability,
        },
        "state": metadata.state.value,
        "created_at": metadata.created_at,
        "started_at": metadata.started_at,
        "completed_at": metadata.completed_at,
        "expires_at": metadata.expires_at,
        "last_progress_at": metadata.last_progress_at,
        "progress": dict(metadata.progress),
        "result": metadata.result,
        "error": metadata.error,
        "channel_id": metadata.channel_id,
    }


def _task_metadata_from_wire(data: dict[str, Any]) -> TaskMetadata:
    spec_data = data.get("spec") or {}
    spec = TaskSpec(
        title=str(spec_data.get("title", "")),
        description=str(spec_data.get("description", "")),
        payload=dict(spec_data.get("payload") or {}),
        capability=spec_data.get("capability"),
    )
    state = TaskState(data.get("state", TaskState.CREATED.value))
    return TaskMetadata(
        task_id=str(data["task_id"]),
        owner_id=str(data["owner_id"]),
        spec=spec,
        state=state,
        created_at=str(data.get("created_at", "")),
        started_at=data.get("started_at"),
        completed_at=data.get("completed_at"),
        expires_at=data.get("expires_at"),
        last_progress_at=data.get("last_progress_at"),
        progress=dict(data.get("progress") or {}),
        result=data.get("result"),
        error=str(data.get("error", "")),
        channel_id=data.get("channel_id"),
    )


def _rpc_error_to_exception(error: dict[str, Any]) -> Exception:
    """Reconstruct a typed exception from an ``RpcResultFrame.error`` dict."""
    code = error.get("code", "error")
    message = error.get("message", "")
    if code == "not_found":
        return NotFoundError(message)
    if code == "protocol_error":
        return ProtocolError(message)
    if code == "access_denied":
        return AccessDeniedError(message)
    return NetworkError(message)
