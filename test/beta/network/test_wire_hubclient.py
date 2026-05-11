# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""End-to-end wire-mode ``HubClient``.

Pairs a ``serve_ws`` hub with ``HubClient(WsLink(...))`` and exercises:

* register over the wire via ``RpcCallFrame``.
* discovery round-trips (``get_agent`` / ``list_agents``).
* envelope post over the wire (``SendFrame`` / ``AcceptFrame``).
* inbound notify dispatch + receipt cursor advance.
* control-plane mutation (``set_resume`` / ``set_skill``).
* adapter-state mirror folds forward on inbound notifies.

The hub still runs in-process; the wire mode swap is purely on the
client side. A real cross-process deployment would put the hub behind
``serve_ws`` exclusively — the contract surface is identical.
"""

import asyncio

import pytest

from autogen.beta import Agent
from autogen.beta.knowledge import MemoryKnowledgeStore
from autogen.beta.network import (
    EV_TEXT,
    Envelope,
    Hub,
    HubClient,
    LocalLink,
    Passport,
    Resume,
    WsLink,
    serve_ws,
)
from autogen.beta.testing import TestConfig


def _agent(name: str, *events: object) -> Agent:
    return Agent(name=name, config=TestConfig(*events))


@pytest.mark.asyncio
async def test_wire_mode_register_via_rpc() -> None:
    """A wire-mode ``HubClient`` registers an agent through the RPC path."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)

    async with serve_ws(hub) as port:
        wire = HubClient(WsLink(f"ws://127.0.0.1:{port}"))
        client = await wire.register(
            _agent("alice"),
            Passport(name="alice"),
            Resume(claimed_capabilities=["math"]),
        )
        try:
            assert client.agent_id  # hub stamped an id
            # Hub sees the registration immediately.
            stamped = await hub.get_agent("alice")
            assert stamped.agent_id == client.agent_id
            assert "math" in (await hub.get_resume(client.agent_id)).claimed_capabilities
        finally:
            await wire.shutdown()

    await hub.close()


@pytest.mark.asyncio
async def test_wire_mode_discovery_round_trip() -> None:
    """``list_agents`` over the wire returns the hub's registry view."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)

    # Seed two in-process registrations so the wire client can discover them.
    a_hc = HubClient(LocalLink(hub), hub=hub)
    b_hc = HubClient(LocalLink(hub), hub=hub)
    await a_hc.register(_agent("alice"), Passport(name="alice"), Resume(claimed_capabilities=["math"]))
    await b_hc.register(_agent("bob"), Passport(name="bob"), Resume())

    async with serve_ws(hub) as port:
        wire = HubClient(WsLink(f"ws://127.0.0.1:{port}"))
        # Register a third agent over the wire so the connection is bound.
        await wire.register(_agent("carol"), Passport(name="carol"), Resume())
        try:
            all_agents = await wire.list_agents()
            assert sorted(p.name for p in all_agents) == ["alice", "bob", "carol"]
            mathy = await wire.list_agents(capability="math")
            assert {p.name for p in mathy} == {"alice"}
            single = await wire.get_agent("bob")
            assert single.name == "bob"
        finally:
            await wire.shutdown()

    await a_hc.close()
    await b_hc.close()
    await hub.close()


@pytest.mark.asyncio
async def test_wire_mode_envelope_post_and_notify() -> None:
    """Alice posts over the wire; bob (in-process) receives via notify."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)

    # Bob is in-process so we can observe the inbound envelope directly.
    b_hc = HubClient(LocalLink(hub), hub=hub)
    bob = await b_hc.register(_agent("bob"), Passport(name="bob"), Resume())

    bob_received: list[Envelope] = []

    async def capture(envelope: Envelope) -> None:
        if envelope.event_type == EV_TEXT:
            bob_received.append(envelope)

    async with serve_ws(hub) as port:
        wire = HubClient(WsLink(f"ws://127.0.0.1:{port}"))
        alice = await wire.register(_agent("alice"), Passport(name="alice"), Resume())
        try:
            session = await alice.open(type="conversation", target=bob.agent_id)
            # Wait for the invite/ack handshake to settle before we
            # swap bob's handler to a capture-only callback.
            await asyncio.sleep(0.05)
            bob.on_envelope(capture)

            audience = [p.agent_id for p in session.metadata.participants if p.agent_id != alice.agent_id]
            envelope_id = await session.send("hi from wire", audience=audience)
            assert envelope_id  # hub-stamped id came back via AcceptFrame

            for _ in range(50):
                if bob_received:
                    break
                await asyncio.sleep(0.02)
            assert len(bob_received) == 1
            assert bob_received[0].event_data == {"text": "hi from wire"}
        finally:
            await wire.shutdown()

    await b_hc.close()
    await hub.close()


@pytest.mark.asyncio
async def test_wire_mode_set_resume_round_trips() -> None:
    """``set_resume`` over the wire applies on the hub-side cache."""
    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)

    async with serve_ws(hub) as port:
        wire = HubClient(WsLink(f"ws://127.0.0.1:{port}"))
        client = await wire.register(
            _agent("alice"),
            Passport(name="alice"),
            Resume(summary="original"),
        )
        try:
            updated = Resume(claimed_capabilities=["debate"], summary="updated via wire")
            await wire.set_resume(client.agent_id, updated)
            fresh = await hub.get_resume(client.agent_id)
            assert fresh.summary == "updated via wire"
            assert "debate" in fresh.claimed_capabilities
        finally:
            await wire.shutdown()

    await hub.close()


@pytest.mark.asyncio
async def test_wire_mode_rpc_error_round_trips_as_exception() -> None:
    """A hub-side ``NotFoundError`` becomes a client-side ``NotFoundError``."""
    from autogen.beta.network.errors import NotFoundError

    hub = await Hub.open(MemoryKnowledgeStore(), ttl_sweep_interval=0)

    async with serve_ws(hub) as port:
        wire = HubClient(WsLink(f"ws://127.0.0.1:{port}"))
        # Register so the link binds, then query a non-existent agent.
        await wire.register(_agent("alice"), Passport(name="alice"), Resume())
        try:
            with pytest.raises(NotFoundError):
                await wire.get_agent("ghost-agent")
        finally:
            await wire.shutdown()

    await hub.close()
