# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""``PendingTurn`` — the trigger envelope an agent owes a reply for.

Defined here (not in ``hub/core.py``) so ``client/hub_client.py`` can
import the dataclass without pulling the full hub package — which
would cycle back through ``adapters.consulting`` →
``client.tools.say`` → ``client/__init__`` → ``hub_client``.
"""

from dataclasses import dataclass

__all__ = ("PendingTurn",)


@dataclass(slots=True)
class PendingTurn:
    """One pending turn for an agent: the trigger envelope they should react to.

    Returned by :meth:`autogen.beta.network.hub.Hub.pending_turns_for`.
    ``last_envelope_id`` identifies the inbound substantive envelope
    (typically ``EV_TEXT`` or ``EV_PACKET``) that put this agent on
    the hook; the default notify handler re-runs against it on
    reconnect to wake up unfinished turns. ``reason`` is a short
    diagnostic string.
    """

    channel_id: str
    last_envelope_id: str
    reason: str
