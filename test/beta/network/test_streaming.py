# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Streaming chunk frames.

Covers:

* ``Channel.send_chunk`` posts a ``ChunkFrame``; sequence numbers are
  sender-monotonic per parent envelope id.
* ``Channel.iter_chunks`` yields deltas in order and terminates on the
  ``is_final=True`` chunk.
* Chunks are **not** persisted to the WAL — only the parent text
  envelope is durable.
* Audience scoping: chunks landed under ``audience=[bob_id]`` reach
  bob but skip carol.
* Concurrent subscriptions on the same parent each receive a full
  copy of every chunk (independent queues).
* Multiple in-flight streams to the same agent stay isolated by
  parent envelope id.
"""

import asyncio
import contextlib

import pytest

from autogen.beta import Agent
from autogen.beta.knowledge import MemoryKnowledgeStore
from autogen.beta.network import (
    EV_TEXT,
    Channel,
    Hub,
    HubClient,
    LocalLink,
    Passport,
    Resume,
)
from autogen.beta.testing import TestConfig


def _agent(name: str) -> Agent:
    return Agent(name=name, config=TestConfig())


async def _noop(_envelope: object) -> None:
    """Replacement handler — auto-ack happened during session open; we don't
    want bob's default handler trying to call ``Agent.ask`` on EV_TEXT
    because the empty ``TestConfig()`` has no scripted reply."""
    return None


async def _consulting_pair(hub: Hub) -> tuple[object, object, object]:
    link = LocalLink(hub)
    alice_hc = HubClient(link, hub=hub)
    bob_hc = HubClient(link, hub=hub)
    alice = await alice_hc.register(_agent("alice"), Passport(name="alice"), Resume())
    bob = await bob_hc.register(_agent("bob"), Passport(name="bob"), Resume())
    session = await alice.open(type="conversation", target="bob")
    bob.on_envelope(_noop)
    return alice, bob, session


async def _three_party(hub: Hub) -> tuple[object, object, object, object]:
    link = LocalLink(hub)
    alice_hc = HubClient(link, hub=hub)
    bob_hc = HubClient(link, hub=hub)
    carol_hc = HubClient(link, hub=hub)
    alice = await alice_hc.register(_agent("alice"), Passport(name="alice"), Resume())
    bob = await bob_hc.register(_agent("bob"), Passport(name="bob"), Resume())
    carol = await carol_hc.register(_agent("carol"), Passport(name="carol"), Resume())
    session = await alice.open(type="discussion", target=["bob", "carol"])
    bob.on_envelope(_noop)
    carol.on_envelope(_noop)
    return alice, bob, carol, session


@pytest.mark.asyncio
async def test_iter_chunks_yields_in_order_and_terminates_on_final() -> None:
    """Chunks land in sequence; iterator exits on ``is_final=True``."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, bob, session = await _consulting_pair(hub)
    audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
    parent_id = await session.send("[streaming]", audience=audience)

    bob_session_metadata = await bob._hub_client.get_channel(session.channel_id)
    bob_session = Channel(metadata=bob_session_metadata, client=bob)

    async def collect() -> list[tuple[int, str, bool]]:
        result = []
        async for delta in bob_session.iter_chunks(parent_id):
            result.append((delta.sequence, delta.text, delta.is_final))
        return result

    collector = asyncio.create_task(collect())
    await asyncio.sleep(0.01)  # ensure subscriber registered before chunks fire

    await session.send_chunk(parent_id, "Hello, ", audience=audience)
    await session.send_chunk(parent_id, "world", audience=audience)
    await session.send_chunk(parent_id, "!", is_final=True, audience=audience)

    received = await asyncio.wait_for(collector, timeout=2.0)
    assert received == [(0, "Hello, ", False), (1, "world", False), (2, "!", True)]


@pytest.mark.asyncio
async def test_chunks_are_not_persisted_to_wal() -> None:
    """Streaming chunks are ephemeral; WAL only has the parent envelope."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, _bob, session = await _consulting_pair(hub)
    audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
    parent_id = await session.send("[streaming]", audience=audience)

    await session.send_chunk(parent_id, "a", audience=audience)
    await session.send_chunk(parent_id, "b", audience=audience)
    await session.send_chunk(parent_id, "c", is_final=True, audience=audience)

    wal = await hub.read_wal(session.channel_id)
    text_envelopes = [e for e in wal if e.event_type == EV_TEXT]
    assert len(text_envelopes) == 1
    assert text_envelopes[0].envelope_id == parent_id


@pytest.mark.asyncio
async def test_audience_scoping_skips_excluded_recipient() -> None:
    """Chunks targeted at bob do not deliver to carol."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, bob, carol, session = await _three_party(hub)

    parent_id = await session.send("[streaming to bob]", audience=[bob.agent_id])

    bob_meta = await bob._hub_client.get_channel(session.channel_id)
    carol_meta = await carol._hub_client.get_channel(session.channel_id)
    bob_session = Channel(metadata=bob_meta, client=bob)
    carol_session = Channel(metadata=carol_meta, client=carol)

    bob_received: list[str] = []
    carol_received: list[str] = []

    async def collect_bob() -> None:
        async for delta in bob_session.iter_chunks(parent_id):
            bob_received.append(delta.text)

    async def collect_carol() -> None:
        async for delta in carol_session.iter_chunks(parent_id):
            carol_received.append(delta.text)

    bob_task = asyncio.create_task(collect_bob())
    carol_task = asyncio.create_task(collect_carol())
    await asyncio.sleep(0.01)

    await session.send_chunk(parent_id, "private", is_final=True, audience=[bob.agent_id])

    await asyncio.wait_for(bob_task, timeout=2.0)
    # Carol's iterator never receives a final chunk; close it ourselves.
    carol_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await carol_task

    assert bob_received == ["private"]
    assert carol_received == []


@pytest.mark.asyncio
async def test_concurrent_subscribers_receive_independent_copies() -> None:
    """Two iter_chunks() calls on the same parent get independent queues."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, bob, session = await _consulting_pair(hub)
    audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
    parent_id = await session.send("[streaming]", audience=audience)

    bob_meta = await bob._hub_client.get_channel(session.channel_id)
    bob_session = Channel(metadata=bob_meta, client=bob)

    async def collect() -> list[str]:
        result = []
        async for delta in bob_session.iter_chunks(parent_id):
            result.append(delta.text)
        return result

    sub_a = asyncio.create_task(collect())
    sub_b = asyncio.create_task(collect())
    await asyncio.sleep(0.01)

    await session.send_chunk(parent_id, "x", audience=audience)
    await session.send_chunk(parent_id, "y", is_final=True, audience=audience)

    a = await asyncio.wait_for(sub_a, timeout=2.0)
    b = await asyncio.wait_for(sub_b, timeout=2.0)
    assert a == ["x", "y"]
    assert b == ["x", "y"]


@pytest.mark.asyncio
async def test_parallel_streams_stay_isolated_by_parent_id() -> None:
    """Two distinct parent envelopes in the same session don't cross-talk."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, bob, session = await _consulting_pair(hub)
    audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
    parent_a = await session.send("[stream A]", audience=audience)
    parent_b = await session.send("[stream B]", audience=audience)

    bob_meta = await bob._hub_client.get_channel(session.channel_id)
    bob_session = Channel(metadata=bob_meta, client=bob)

    async def collect(parent_id: str) -> list[str]:
        result = []
        async for delta in bob_session.iter_chunks(parent_id):
            result.append(delta.text)
        return result

    task_a = asyncio.create_task(collect(parent_a))
    task_b = asyncio.create_task(collect(parent_b))
    await asyncio.sleep(0.01)

    await session.send_chunk(parent_a, "A1", audience=audience)
    await session.send_chunk(parent_b, "B1", audience=audience)
    await session.send_chunk(parent_a, "A2", is_final=True, audience=audience)
    await session.send_chunk(parent_b, "B2", is_final=True, audience=audience)

    got_a = await asyncio.wait_for(task_a, timeout=2.0)
    got_b = await asyncio.wait_for(task_b, timeout=2.0)
    assert got_a == ["A1", "A2"]
    assert got_b == ["B1", "B2"]


@pytest.mark.asyncio
async def test_non_owner_cannot_chunk_someone_elses_envelope() -> None:
    """Only the sender of the parent envelope may post chunks for it.

    Alice posts a stub envelope and starts streaming. Bob tries to
    inject a chunk claiming the same parent — rejected because bob
    doesn't own the parent. Adapter-agnostic: this holds for every
    channel type.
    """
    from autogen.beta.network.errors import ProtocolError
    from autogen.beta.network.transport.frames import ChunkFrame

    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, bob, session = await _consulting_pair(hub)
    audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
    parent_id = await session.send("[streaming]", audience=audience)

    bad = ChunkFrame(
        channel_id=session.channel_id,
        parent_envelope_id=parent_id,
        sender_id=bob.agent_id,
        sequence=0,
        text="injection",
        is_final=True,
    )
    with pytest.raises(ProtocolError, match="does not own parent envelope"):
        await hub.post_chunk(bad)


@pytest.mark.asyncio
async def test_chunk_on_unknown_parent_is_rejected() -> None:
    """A chunk referencing a non-existent parent envelope raises."""
    from autogen.beta.network.errors import ProtocolError
    from autogen.beta.network.transport.frames import ChunkFrame

    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, _bob, session = await _consulting_pair(hub)

    bad = ChunkFrame(
        channel_id=session.channel_id,
        parent_envelope_id="env-does-not-exist",
        sender_id=alice.agent_id,
        sequence=0,
        text="ghost",
        is_final=True,
    )
    with pytest.raises(ProtocolError, match="parent envelope.*not found"):
        await hub.post_chunk(bad)


@pytest.mark.asyncio
async def test_workflow_chunk_blocked_when_sender_did_not_post_parent() -> None:
    """In a workflow where alice spoke and bob is now expected, bob
    cannot inject a chunk claiming alice's parent envelope."""
    from autogen.beta.network.adapters.workflow import WORKFLOW_TYPE
    from autogen.beta.network.errors import ProtocolError
    from autogen.beta.network.transitions import (
        AgentTarget,
        Always,
        TerminateTarget,
        Transition,
        TransitionGraph,
    )
    from autogen.beta.network.transport.frames import ChunkFrame

    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    link = LocalLink(hub)
    a_hc = HubClient(link, hub=hub)
    b_hc = HubClient(link, hub=hub)
    alice = await a_hc.register(_agent("alice"), Passport(name="alice"), Resume())
    bob = await b_hc.register(_agent("bob"), Passport(name="bob"), Resume())

    graph = TransitionGraph(
        initial_speaker=alice.agent_id,
        transitions=[Transition(when=Always(), then=AgentTarget(bob.agent_id))],
        default_target=TerminateTarget(reason="end"),
    )
    # Open the channel first so bob's default handler auto-acks the invite,
    # then swap to a no-op handler so we control the turn-taking explicitly.
    session = await alice.open(
        type=WORKFLOW_TYPE,
        target=[bob.agent_id],
        knobs={"graph": graph.to_dict()},
    )
    bob.on_envelope(_noop)

    # Alice takes her turn — posts an envelope. After fold, bob is
    # expected_next_speaker.
    from autogen.beta.network.envelope import EV_PACKET, Envelope

    parent = Envelope(
        channel_id=session.channel_id,
        sender_id=alice.agent_id,
        audience=None,
        event_type=EV_PACKET,
        event_data={"routing": {"kind": "text"}, "body": "hello"},
    )
    parent_id = await hub.post_envelope(parent)

    # Bob tries to chunk against alice's parent — rejected.
    bad = ChunkFrame(
        channel_id=session.channel_id,
        parent_envelope_id=parent_id,
        sender_id=bob.agent_id,
        sequence=0,
        text="bob-injection",
        is_final=True,
    )
    with pytest.raises(ProtocolError, match="does not own parent envelope"):
        await hub.post_chunk(bad)

    # Alice can still stream against her own parent — even though
    # she's no longer the current speaker.
    ok = ChunkFrame(
        channel_id=session.channel_id,
        parent_envelope_id=parent_id,
        sender_id=alice.agent_id,
        sequence=0,
        text="alice-late-chunk",
        is_final=True,
    )
    await hub.post_chunk(ok)  # no raise


@pytest.mark.asyncio
async def test_send_chunk_returns_monotonic_sequence() -> None:
    """Sender-side sequence is 0, 1, 2, … per parent envelope id."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)
    alice, _bob, session = await _consulting_pair(hub)
    audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
    parent_id = await session.send("[streaming]", audience=audience)

    seqs = []
    seqs.append(await session.send_chunk(parent_id, "a", audience=audience))
    seqs.append(await session.send_chunk(parent_id, "b", audience=audience))
    seqs.append(await session.send_chunk(parent_id, "c", is_final=True, audience=audience))
    assert seqs == [0, 1, 2]
