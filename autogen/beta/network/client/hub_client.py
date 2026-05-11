# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""``HubClient`` — one connection to one hub per process.

Lazy-connects the underlying ``LinkClient`` on first ``register``;
demultiplexes inbound ``NotifyFrame``s to the appropriate
``AgentClient``; provides discovery passthroughs.

With ``LocalLink``, the ``HubClient`` holds an explicit in-process
``hub`` reference so register / discovery / mutation cut through wire
serialisation. A cross-process transport keeps ``hub=None`` and runs
every operation through frames.
"""

import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING

from autogen.beta.agent import Agent
from autogen.beta.task import TaskMetadata, TaskState

from ..adapters.base import ChannelAdapter
from ..channel import ChannelMetadata, ChannelState
from ..envelope import Envelope
from ..identity import Passport, Resume
from ..rule import Rule
from ..transport.frames import ChunkFrame, NetworkChangedFrame, NotifyFrame, ReceiptFrame
from ..transport.local import LocalLink, LocalLinkClient
from ..views.base import ViewPolicy
from .agent_client import AgentClient
from .chunks import ChunkDelta
from .plugin import NetworkPlugin

if TYPE_CHECKING:
    from ..hub import Hub
    from ..hub.core import PendingTurn

__all__ = ("HubClient",)


logger = logging.getLogger(__name__)


class HubClient:
    """One connection to a hub. Multiple ``AgentClient``s register through it.

    Takes a ``link`` (currently ``LocalLink``) and an explicit ``hub``
    reference. The link carries dispatched envelopes via
    ``NotifyFrame``; the direct hub reference is used for register /
    discovery / mutation calls (cuts through wire serialisation when
    we're in-process).

    A single tenant process should hold one ``HubClient`` per hub it
    connects to.
    """

    def __init__(self, link: LocalLink, *, hub: "Hub | None" = None) -> None:
        # __init__ stores params; side effects deferred to register()/close().
        self._link = link
        self._hub = hub if hub is not None else link.hub
        self._client_link: LocalLinkClient | None = None
        self._receive_task: asyncio.Task[None] | None = None
        self._clients: dict[str, AgentClient] = {}
        self._closed = False

        # Discovery cache for ``list_agents`` / ``get_agent`` /
        # ``get_resume`` / ``get_skill``. Each entry is a single result
        # keyed by call args. A ``NetworkChangedFrame`` from the hub
        # clears the entire dict — invalidation is event-driven, not
        # TTL-driven, because the hub is the only writer to the data
        # we cache. The cache adds no value for in-process callers
        # (direct hub access is already cheap) but pays for itself
        # over the wire where every call is a round-trip.
        self._discovery_cache: dict[tuple[object, ...], object] = {}

    # ── Connection ───────────────────────────────────────────────────────────

    def _ensure_connected(self) -> LocalLinkClient:
        """Open the link on first use; subsequent calls reuse the connection."""
        if self._client_link is None:
            self._client_link = self._link.client()
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
                        # Per-frame dispatch failure (handler/observer/middleware
                        # bug). Log with traceback so the failure is diagnosable
                        # instead of silently hanging the awaiter, then keep the
                        # loop alive so other channels still flow.
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
                    # mutation touches.
                    self._discovery_cache.clear()
                # Other frame kinds (Accept/Error/Pong/Event) bypass the
                # demuxer — the in-process send path goes direct via
                # ``Hub.post_envelope`` so ``AcceptFrame`` is unused here.
        except asyncio.CancelledError:
            raise
        except Exception:
            # Iterator-level failure (transport teardown, decode error).
            # Receive loops must not propagate, but we log so the cause
            # of a dead loop is at least discoverable.
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

        The hub sets ``recipient_id`` per delivery so broadcasts
        (``audience=None``) reach the right ``AgentClient`` without
        the demuxer re-walking channel participants. Frames missing a
        ``recipient_id`` fall back to ``audience``-based routing.
        """
        if frame.recipient_id:
            client = self._clients.get(frame.recipient_id)
            if client is not None:
                await client.receive(frame.envelope)
            return
        if frame.envelope.audience is None:
            return
        for recipient_id in frame.envelope.audience:
            client = self._clients.get(recipient_id)
            if client is not None:
                await client.receive(frame.envelope)

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

        Direct hub call for register (in-process); the resulting
        ``agent_id`` is bound to this connection's endpoint so
        dispatched ``NotifyFrame``s reach the right ``AgentClient``. A
        cross-process transport binds via ``HelloFrame`` instead.

        ``attach_plugin=True`` (default) attaches the ``NetworkPlugin``
        which adds ``say`` and ``delegate`` to ``agent.tools`` and
        appends ``NetworkContextPolicy`` to the assembly chain. Pass
        ``False`` for tests that need a bare agent without LLM tools.
        """
        if self._closed:
            raise RuntimeError("HubClient is closed")

        client_link = self._ensure_connected()

        effective_rule = rule if rule is not None else Rule()
        passport = await self._hub.register(passport, resume, skill_md=skill_md, rule=effective_rule)
        assert passport.agent_id is not None
        self._hub.bind_endpoint(client_link.endpoint_id, passport.agent_id)

        client = AgentClient(
            agent=agent,
            passport=passport,
            resume=resume,
            rule=effective_rule,
            hub=self._hub,
            hub_client=self,
        )
        self._clients[passport.agent_id] = client

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
        and resumes any pending turns the prior incarnation left behind
        (see :meth:`AgentClient.resume_pending_turns`).

        Use this instead of :meth:`register` when restarting an agent
        process whose identity was already persisted by a prior run.
        """
        if self._closed:
            raise RuntimeError("HubClient is closed")

        client_link = self._ensure_connected()

        passport = await self._hub.get_agent(name)
        if passport.agent_id is None:
            raise RuntimeError(f"agent {name!r} has no agent_id")
        agent_id = passport.agent_id

        resume = await self._hub.get_resume(agent_id)
        rule = self._hub.get_rule(agent_id)

        self._hub.bind_endpoint(client_link.endpoint_id, agent_id)

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
        # Done after plugin attach so the LLM tools resolve correctly
        # if the resumed handler immediately fires the agent's LLM.
        await client.resume_pending_turns()

        return client

    # ── Hub control-plane passthrough ────────────────────────────────────────
    #
    # Forwards directly to the in-process hub. A cross-process transport
    # would replace these bodies with frame-based RPC; the call sites on
    # ``AgentClient`` / handlers stay the same.

    # — Discovery —

    async def get_agent(self, name_or_id: str) -> Passport:
        key = ("get_agent", name_or_id)
        cached = self._discovery_cache.get(key)
        if cached is not None:
            return cached  # type: ignore[return-value]
        passport = await self._hub.get_agent(name_or_id)
        self._discovery_cache[key] = passport
        return passport

    async def get_resume(self, agent_id: str) -> Resume:
        key = ("get_resume", agent_id)
        cached = self._discovery_cache.get(key)
        if cached is not None:
            return cached  # type: ignore[return-value]
        resume = await self._hub.get_resume(agent_id)
        self._discovery_cache[key] = resume
        return resume

    async def get_skill(self, agent_id: str) -> str | None:
        key = ("get_skill", agent_id)
        if key in self._discovery_cache:
            return self._discovery_cache[key]  # type: ignore[return-value]
        skill = await self._hub.get_skill(agent_id)
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
        result = await self._hub.list_agents(
            capability=capability,
            query=query,
            sort_by=sort_by,
            limit=limit,
        )
        self._discovery_cache[key] = result
        return result

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
        durability optimization, not a correctness primitive (the
        handler-side ``find_envelope_by_causation`` dedup already
        absorbs duplicates).
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

    # — Identity mutation —

    async def set_resume(self, agent_id: str, resume: Resume) -> None:
        await self._hub.set_resume(agent_id, resume)

    async def set_skill(self, agent_id: str, skill_md: str | None) -> None:
        await self._hub.set_skill(agent_id, skill_md)

    async def set_rule(self, agent_id: str, rule: Rule) -> None:
        await self._hub.set_rule(agent_id, rule)

    async def unregister_agent(self, agent_id: str) -> None:
        await self._hub.unregister(agent_id)

    # — Channel control —

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
        return await self._hub.create_channel(
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

    async def get_channel(self, channel_id: str) -> ChannelMetadata:
        return await self._hub.get_channel(channel_id)

    async def list_channels(
        self,
        *,
        agent_id: str | None = None,
        include_terminal: bool = False,
        limit: int = 50,
    ) -> list[ChannelMetadata]:
        results = await self._hub.list_channels(agent_id=agent_id, limit=limit * 4)
        if not include_terminal:
            results = [m for m in results if m.state not in (ChannelState.CLOSED, ChannelState.EXPIRED)]
        return results[:limit]

    async def close_channel(self, channel_id: str, *, reason: str = "") -> ChannelMetadata:
        return await self._hub.close_channel(channel_id, reason=reason)

    async def post_envelope(self, envelope: Envelope) -> str:
        return await self._hub.post_envelope(envelope)

    async def post_chunk(self, frame: ChunkFrame) -> None:
        """Hand a streaming chunk to the hub for fan-out.

        Chunks are ephemeral — not persisted to the WAL. The hub
        validates audience/access and forwards one ``ChunkFrame`` per
        recipient.
        """
        await self._hub.post_chunk(frame)

    async def read_wal(self, channel_id: str, *, since: int = 0, until: int | None = None) -> list[Envelope]:
        return await self._hub.read_wal(channel_id, since=since, until=until)

    def find_envelope_by_causation(
        self,
        channel_id: str,
        *,
        sender_id: str,
        causation_id: str,
    ) -> Envelope | None:
        """Idempotency query passthrough; see :meth:`Hub.find_envelope_by_causation`."""
        return self._hub.find_envelope_by_causation(
            channel_id,
            sender_id=sender_id,
            causation_id=causation_id,
        )

    async def pending_turns_for(self, agent_id: str) -> list["PendingTurn"]:
        """Wake-up query passthrough; see :meth:`Hub.pending_turns_for`."""
        return await self._hub.pending_turns_for(agent_id)

    def can_send(
        self,
        channel_id: str,
        sender_id: str,
        *,
        event_type: str | None = None,
    ) -> bool:
        return self._hub.can_send(channel_id, sender_id, event_type=event_type)

    def default_view_policy(self, channel_id: str, participant_id: str) -> ViewPolicy:
        return self._hub.default_view_policy(channel_id, participant_id)

    def adapter_for(self, channel_id: str) -> ChannelAdapter:
        """Resolve the adapter for ``channel_id``.

        Delegates to ``Hub.adapter_for`` so the default notify handler
        and other client-side code can fetch the adapter without
        reaching into ``_hub`` privates.
        """
        return self._hub.adapter_for(channel_id)

    def adapter_state(self, channel_id: str) -> object | None:
        """Return the cached folded ``AdapterState`` for ``channel_id``.

        Delegates to ``Hub.adapter_state``. Returns ``None`` when the
        channel has no state yet (e.g. not opened).
        """
        return self._hub.adapter_state(channel_id)

    # — Task observation (network is one observer) —

    async def get_task(self, task_id: str) -> TaskMetadata:
        return await self._hub.get_task(task_id)

    async def list_tasks(
        self,
        *,
        agent_id: str | None = None,
        channel_id: str | None = None,
        state: TaskState | None = None,
        limit: int = 50,
    ) -> list[TaskMetadata]:
        return await self._hub.list_tasks(
            agent_id=agent_id,
            channel_id=channel_id,
            state=state,
            limit=limit,
        )

    async def observe_task(self, metadata: TaskMetadata) -> None:
        await self._hub.observe_task(metadata)

    async def update_task(
        self,
        task_id: str,
        *,
        state: TaskState | None = None,
        progress: dict[str, object] | None = None,
        result: object | None = None,
        error: str | None = None,
    ) -> None:
        await self._hub.update_task(
            task_id,
            state=state,
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
        await self._hub.record_observation(
            owner_id=owner_id,
            capability=capability,
            outcome=outcome,
            latency_ms=latency_ms,
            task_id=task_id,
        )

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the connection and stop the receive loop. Idempotent."""
        if self._closed:
            return
        self._closed = True
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
