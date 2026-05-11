# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""``AgentClient`` — per-registration tenant handle.

Surface:

* Properties (agent, passport, resume, agent_id).
* ``receive`` (NetworkClient impl) — routes envelopes to the optional
  per-channel inbox queue (used by ``delegate``) AND to the registered
  notify-handler callback (default = ``handlers.default_handler``,
  which auto-acks invites and runs ``Agent.ask`` on text envelopes).
* ``send_envelope`` — direct ``Hub.post_envelope`` call.
* ``open(type=..., target=..., ...)`` — create a channel via the hub;
  returns a :class:`Channel` handle.
* ``wait_for_channel_event`` — block until an inbound envelope on a
  channel matches a predicate; used by ``delegate`` to await replies.
* Tenant-driven mutation (``set_resume`` / ``set_skill`` / ``set_rule``).
* ``on_envelope(callback)`` — override the default notify handler
  (testing seam).

The ``NetworkPlugin`` is attached at registration by ``HubClient`` so
``agent.tools`` includes ``say`` / ``delegate`` and the assembly chain
includes ``NetworkContextPolicy``.
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import TYPE_CHECKING

from autogen.beta.agent import Agent
from autogen.beta.task import CheckpointStore

from ..envelope import Envelope
from ..identity import Passport, Resume, ResumeExample
from ..rule import Rule
from ..transport.frames import ChunkFrame
from .channel import Channel
from .checkpoint import HubBackedCheckpointStore
from .chunks import ChunkDelta, ChunkSubscription
from .handlers import default_handler

if TYPE_CHECKING:
    from ..hub import Hub
    from .hub_client import HubClient

__all__ = ("AgentClient",)


EnvelopeHandler = Callable[[Envelope], Awaitable[None]]
EnvelopePredicate = Callable[[Envelope], bool]

# Tenant-side per-envelope transform hooks. A hook receives the
# in-flight envelope and returns either a modified envelope (often the
# same instance) to continue dispatch, or ``None`` to drop. Hooks run
# in registration order; the first ``None`` short-circuits the chain.
EnvelopeSendHook = Callable[[Envelope], Awaitable["Envelope | None"]]
EnvelopeReceiveHook = Callable[[Envelope], Awaitable["Envelope | None"]]


class AgentClient:
    """Tenant-side handle for one ``(Agent, identity, hub)`` registration."""

    def __init__(
        self,
        *,
        agent: Agent,
        passport: Passport,
        resume: Resume,
        rule: Rule,
        hub: "Hub",
        hub_client: "HubClient",
        attach_default_handler: bool = True,
    ) -> None:
        # __init__ stores params; no side effects.
        self._agent = agent
        self._passport = passport
        self._resume = resume
        self._rule = rule
        self._hub = hub
        self._hub_client = hub_client
        self._on_envelope: EnvelopeHandler | None = self._run_default_handler if attach_default_handler else None
        self._disconnected = False

        # Per-channel inbox queues for ``wait_for_channel_event``
        # (used by the ``delegate`` tool to await consulting replies).
        self._channel_inboxes: dict[str, asyncio.Queue[Envelope]] = {}

        # Channels where the default notify handler should NOT run —
        # used by ``delegate`` while it owns the channel lifecycle.
        self._handler_suppressed_channels: set[str] = set()

        # Stack of envelopes currently being handled. The top of the
        # stack is the envelope this agent is processing right now;
        # ``delegate`` reads its ``depth`` to stamp the outgoing prompt
        # for delegation-depth enforcement (Rule.limits.delegation_depth).
        self._handling_envelope_stack: list[Envelope] = []

        # Hub-backed checkpoint store for ``Task.checkpoint`` persistence.
        # Lazy — only constructed if accessed; standalone agents that
        # never checkpoint pay no cost.
        self._checkpoint_store: CheckpointStore | None = None

        # Per-(channel_id, parent_envelope_id) chunk subscription map.
        # Multiple concurrent subscribers may listen on the same parent
        # (e.g. two awaiting coroutines in the same agent); each gets
        # an independent ``ChunkSubscription`` and the same delta is
        # fanned out to every entry.
        self._chunk_subscriptions: dict[tuple[str, str], list[ChunkSubscription]] = {}
        # Sender-side monotonic sequence counter per
        # (channel_id, parent_envelope_id) so callers don't have to
        # track it. Cleared on the final chunk.
        self._chunk_sequences: dict[tuple[str, str], int] = {}

        # Tenant-side per-envelope hook chains. Run in registration
        # order on send (outbound) and receive (inbound). A hook
        # returning ``None`` drops the envelope.
        self._send_hooks: list[EnvelopeSendHook] = []
        self._receive_hooks: list[EnvelopeReceiveHook] = []

    # ── Properties ───────────────────────────────────────────────────────────

    @property
    def agent(self) -> Agent:
        return self._agent

    @property
    def passport(self) -> Passport:
        return self._passport

    @property
    def resume(self) -> Resume:
        return self._resume

    @property
    def rule(self) -> Rule:
        return self._rule

    @property
    def agent_id(self) -> str:
        if self._passport.agent_id is None:
            raise RuntimeError("AgentClient has unstamped passport (not registered)")
        return self._passport.agent_id

    @property
    def checkpoint_store(self) -> CheckpointStore:
        """Hub-backed ``CheckpointStore`` for ``Task.checkpoint``.

        Pass to ``agent.task(checkpoint_store=...)`` when you want a
        long-running task to survive interruption — the checkpoint
        lands next to the task's metadata under
        ``/tasks/{task_id}/checkpoint.json`` in the hub's
        ``KnowledgeStore``. Constructed lazily on first access.
        """
        if self._checkpoint_store is None:
            self._checkpoint_store = HubBackedCheckpointStore(self._hub._store)
        return self._checkpoint_store

    # ── NetworkClient impl ───────────────────────────────────────────────────

    async def receive(self, envelope: Envelope) -> None:
        """Hub delivery → fan out to inbox + (suppressible) handler.

        Receive hooks run before fan-out. A hook returning ``None``
        drops the envelope entirely (no inbox put, no handler
        invocation); the WAL still has the original because hooks run
        client-side after hub-side persistence.

        After the handler returns cleanly (or the handler is
        suppressed), an ``ack`` ``ReceiptFrame`` is sent back to the
        hub so the per-(agent, channel) inbox cursor advances and a
        wire reconnect won't replay this delivery. ``nack`` is sent if
        the handler raised. Receipts are best-effort — failures are
        swallowed.
        """
        for hook in self._receive_hooks:
            result = await hook(envelope)
            if result is None:
                return
            envelope = result
        inbox = self.ensure_channel_inbox(envelope.channel_id)
        await inbox.put(envelope)
        handler_status = "ack"
        handler_reason = ""
        if (
            envelope.channel_id not in self._handler_suppressed_channels
            and self._on_envelope is not None
        ):
            try:
                await self._on_envelope(envelope)
            except Exception as exc:
                handler_status = "nack"
                handler_reason = repr(exc)
                # Re-raise so observers / pytest see the failure; receipt
                # was already prepared before re-raise.
                with contextlib.suppress(Exception):
                    await self._hub_client._send_receipt(
                        envelope_id=envelope.envelope_id,
                        channel_id=envelope.channel_id,
                        status=handler_status,
                        reason=handler_reason,
                    )
                raise
        # Only emit receipts for envelopes the hub has actually stamped.
        if envelope.envelope_id:
            with contextlib.suppress(Exception):
                await self._hub_client._send_receipt(
                    envelope_id=envelope.envelope_id,
                    channel_id=envelope.channel_id,
                    status=handler_status,
                    reason=handler_reason,
                )

    def on_envelope(self, callback: EnvelopeHandler) -> None:
        """Override the default notify handler with a custom callback.

        Calling with the default handler restores it: pass
        ``self._run_default_handler`` (or simply construct without
        ``attach_default_handler=False``).
        """
        self._on_envelope = callback

    async def disconnect(self) -> None:
        self._disconnected = True
        self._on_envelope = None

    async def _run_default_handler(self, envelope: Envelope) -> None:
        """Bound-method wrapper around :func:`handlers.default_handler`.

        Pushes the inbound envelope onto the handling stack so any
        ``delegate``/``channels.open`` invoked from inside the LLM turn
        can stamp ``Envelope.depth = outer.depth + 1`` and the hub can
        enforce ``Rule.limits.delegation_depth``.
        """
        self._handling_envelope_stack.append(envelope)
        try:
            await default_handler(envelope, self)
        finally:
            self._handling_envelope_stack.pop()

    @property
    def current_handling_depth(self) -> int:
        """Depth of the envelope this agent is currently handling.

        Returns ``0`` when no handler is on the stack (i.e. the agent
        initiated the call from outside any inbound delivery). Used by
        ``delegate`` to stamp ``Envelope.depth = current + 1``.
        """
        if not self._handling_envelope_stack:
            return 0
        return self._handling_envelope_stack[-1].depth

    # ── Channel lifecycle ────────────────────────────────────────────────────

    async def open(
        self,
        *,
        type: str,
        target: str | list[str],
        ttl: str | int | None = None,
        knobs: dict[str, object] | None = None,
        intent: str | None = None,
        labels: dict[str, str] | None = None,
    ) -> Channel:
        """Open a channel via the hub and return its :class:`Channel` handle.

        ``target`` accepts peer **names** or agent_ids; resolution goes
        through the bound :class:`HubClient` so in-process and any
        future cross-process transport take the same code path.
        """
        if self._disconnected:
            raise RuntimeError("AgentClient is disconnected")

        targets = [target] if isinstance(target, str) else list(target)
        target_ids: list[str] = []
        for t in targets:
            passport = await self._hub_client.get_agent(t)
            if passport.agent_id is None:
                raise RuntimeError(f"target {t!r} has no agent_id")
            target_ids.append(passport.agent_id)

        metadata = await self._hub_client.create_channel(
            creator_id=self.agent_id,
            manifest_type=type,
            participants=target_ids,
            ttl=ttl,
            knobs=knobs,
            intent=intent,
            labels=labels,
        )
        self.ensure_channel_inbox(metadata.channel_id)
        return Channel(metadata=metadata, client=self)

    def ensure_channel_inbox(self, channel_id: str) -> "asyncio.Queue[Envelope]":
        """Create (or fetch) the per-channel inbox queue.

        Callers that send first and then ``wait_for_channel_event`` MUST
        call this BEFORE the send. Otherwise a fast reply (e.g. via
        ``LocalLink`` where dispatch happens on the same event-loop tick)
        can be delivered to ``receive`` before the wait creates the
        inbox — the envelope would then be dropped silently.

        Idempotent: returns the existing queue if one is already bound.
        """
        inbox = self._channel_inboxes.get(channel_id)
        if inbox is None:
            inbox = asyncio.Queue()
            self._channel_inboxes[channel_id] = inbox
        return inbox

    def discard_channel_inbox(self, channel_id: str) -> None:
        """Drop the per-channel inbox queue.

        Callers should invoke this after they've finished waiting on a
        channel so the per-client memory footprint doesn't grow with
        every consulted channel.
        """
        self._channel_inboxes.pop(channel_id, None)

    async def wait_for_channel_event(
        self,
        *,
        channel_id: str,
        predicate: EnvelopePredicate,
        timeout: float = 300.0,
    ) -> Envelope:
        """Block until an inbound envelope on ``channel_id`` matches.

        Used by ``delegate`` to await the consulting respondent's
        reply. The inbox is created on demand and shared across waits;
        callers should not hold multiple concurrent waits on the same
        channel.

        Raises ``asyncio.TimeoutError`` on timeout.
        """
        inbox = self.ensure_channel_inbox(channel_id)

        loop = asyncio.get_event_loop()
        deadline = loop.time() + timeout
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise asyncio.TimeoutError()
            envelope = await asyncio.wait_for(inbox.get(), timeout=remaining)
            if predicate(envelope):
                return envelope

    def _suppress_handler(self, channel_id: str) -> None:
        """Internal: stop running the default notify handler for ``channel_id``.

        Used by ``delegate`` to own the channel lifecycle while waiting
        for the respondent's reply — the default handler would
        otherwise try to ``Agent.ask`` on every inbound EV_TEXT.
        """
        self._handler_suppressed_channels.add(channel_id)

    def _unsuppress_handler(self, channel_id: str) -> None:
        self._handler_suppressed_channels.discard(channel_id)

    # ── Envelope send ────────────────────────────────────────────────────────

    async def send_envelope(self, envelope: Envelope) -> str:
        """Post an envelope through the hub. Returns the stamped envelope_id.

        Send hooks run before posting. A hook returning ``None`` drops
        the send and returns an empty envelope_id — callers that care
        about delivery must check the return value.
        """
        if self._disconnected:
            raise RuntimeError("AgentClient is disconnected")
        if envelope.sender_id == "":
            envelope.sender_id = self.agent_id
        for hook in self._send_hooks:
            result = await hook(envelope)
            if result is None:
                return ""
            envelope = result
        return await self._hub_client.post_envelope(envelope)

    # ── Tenant-side per-envelope hooks ──────────────────────────────────────

    def add_send_hook(self, hook: EnvelopeSendHook) -> None:
        """Register a per-envelope outbound transform.

        Hooks run in registration order on every ``send_envelope`` call,
        before the envelope reaches the hub. Each hook returns the
        (possibly-modified) envelope to continue, or ``None`` to drop.
        The first ``None`` short-circuits the chain.
        """
        self._send_hooks.append(hook)

    def add_receive_hook(self, hook: EnvelopeReceiveHook) -> None:
        """Register a per-envelope inbound transform.

        Hooks run in registration order on every ``receive`` call,
        before the inbox put and notify handler. Each hook returns
        the (possibly-modified) envelope to continue, or ``None`` to
        drop. Hub-side WAL is unaffected — hooks are client-local.
        """
        self._receive_hooks.append(hook)

    # ── Streaming chunks ─────────────────────────────────────────────────────

    async def send_chunk(
        self,
        *,
        channel_id: str,
        parent_envelope_id: str,
        text: str,
        sequence: int | None = None,
        audience: list[str] | None = None,
        is_final: bool = False,
    ) -> int:
        """Post a streaming chunk attached to ``parent_envelope_id``.

        Chunks are ephemeral — not persisted to the WAL. The hub fans
        out per recipient using the same audience/access path as
        ``NotifyFrame``. If ``sequence`` is not supplied, the client
        auto-increments from a per-(channel, parent) counter so the
        caller doesn't need to track it. Returns the assigned
        sequence.
        """
        if self._disconnected:
            raise RuntimeError("AgentClient is disconnected")
        if sequence is None:
            key = (channel_id, parent_envelope_id)
            next_seq = self._chunk_sequences.get(key, 0)
            sequence = next_seq
            self._chunk_sequences[key] = next_seq + 1
            if is_final:
                # Drop the counter so a future re-use of the parent id
                # starts fresh.
                self._chunk_sequences.pop(key, None)
        frame = ChunkFrame(
            channel_id=channel_id,
            parent_envelope_id=parent_envelope_id,
            sender_id=self.agent_id,
            sequence=sequence,
            text=text,
            audience=audience,
            is_final=is_final,
        )
        await self._hub_client.post_chunk(frame)
        return sequence

    async def receive_chunk(
        self,
        delta: ChunkDelta,
        *,
        channel_id: str,
        parent_envelope_id: str,
    ) -> None:
        """Internal hook: route an inbound ``ChunkFrame`` to every
        matching subscription. Called by ``HubClient._dispatch_chunk``.
        """
        subs = self._chunk_subscriptions.get((channel_id, parent_envelope_id))
        if not subs:
            return
        for sub in list(subs):
            await sub.put(delta)
        # Drop the subscription list once the terminal chunk lands so
        # a future re-use of the parent id starts with fresh subscribers.
        if delta.is_final:
            self._chunk_subscriptions.pop((channel_id, parent_envelope_id), None)

    async def iter_chunks(
        self,
        channel_id: str,
        parent_envelope_id: str,
    ) -> AsyncIterator[ChunkDelta]:
        """Yield inbound chunks for ``(channel_id, parent_envelope_id)``.

        Yields until the terminal chunk lands or the caller breaks.
        Multiple in-flight streams stay isolated by ``parent_envelope_id``;
        multiple concurrent subscribers per parent each get an
        independent copy of every delta.
        """
        sub = ChunkSubscription()
        key = (channel_id, parent_envelope_id)
        self._chunk_subscriptions.setdefault(key, []).append(sub)
        try:
            async for delta in sub:
                yield delta
        finally:
            await sub.close()
            bucket = self._chunk_subscriptions.get(key)
            if bucket is not None:
                with contextlib.suppress(ValueError):
                    bucket.remove(sub)
                if not bucket:
                    self._chunk_subscriptions.pop(key, None)

    # ── Tenant-driven mutation ───────────────────────────────────────────────

    async def set_resume(self, resume: Resume) -> None:
        await self._hub_client.set_resume(self.agent_id, resume)
        # Refresh local cache so subsequent reads see the bumped version.
        self._resume = await self._hub_client.get_resume(self.agent_id)

    async def add_example(self, example: ResumeExample) -> None:
        """Append a ``ResumeExample`` to this agent's resume.

        Fetches the latest resume from the hub first so concurrent
        ``set_resume`` / ``record_observation`` updates don't get
        clobbered.
        """
        current = await self._hub_client.get_resume(self.agent_id)
        current.examples.append(example)
        await self.set_resume(current)

    async def set_skill(self, skill_md: str | None) -> None:
        await self._hub_client.set_skill(self.agent_id, skill_md)

    async def set_rule(self, rule: Rule) -> None:
        await self._hub_client.set_rule(self.agent_id, rule)
        self._rule = rule

    async def unregister(self) -> None:
        if not self._disconnected:
            await self._hub_client.unregister_agent(self.agent_id)
            self._disconnected = True

    async def __aenter__(self) -> "AgentClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.unregister()

    # ── Durability ──────────────────────────────────────────────────────────

    async def resume_pending_turns(self) -> int:
        """Re-run the registered envelope handler for any pending turns.

        Queries the hub for channels where this agent is the expected
        speaker but no reply has landed since the triggering envelope
        (see :meth:`Hub.pending_turns_for`). For each, fetches the
        triggering envelope from the WAL and re-fires the registered
        handler against it — same code path as a live ``NotifyFrame``
        delivery, so workflows resume seamlessly.

        Idempotency is preserved by the default handler's
        ``find_envelope_by_causation`` dedup query: if the prior run
        already posted a reply, the handler short-circuits and posts
        nothing.

        Returns the number of turns re-fired.
        """
        if self._on_envelope is None:
            return 0
        pending = await self._hub_client.pending_turns_for(self.agent_id)
        count = 0
        for turn in pending:
            wal = await self._hub_client.read_wal(turn.channel_id)
            trigger: Envelope | None = None
            for env in wal:
                if env.envelope_id == turn.last_envelope_id:
                    trigger = env
                    break
            if trigger is None:
                # WAL changed between query and read — skip; the next
                # pending_turns sweep will catch any leftover.
                continue
            await self._on_envelope(trigger)
            count += 1
        return count
