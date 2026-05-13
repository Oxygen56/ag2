# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Tenant-side clients — ``NetworkClient`` Protocol, ``HubClient``, ``AgentClient``.

The trust boundary runs through this package: tenant code (notify
handlers, future transforms, LLM tool execution) only runs inside the
tenant process. The hub never imports anything from here.

``HubClient`` is exposed via :pep:`562` module-level ``__getattr__`` so
the symbol is resolvable as ``autogen.beta.network.client.HubClient``
without forcing ``hub_client.py`` to load at package-import time. This
matters because ``hub_client`` imports the concrete adapter classes at
module top, and each adapter in turn imports ``make_say_tool`` from
``client.tools.say`` — which forces evaluation of *this* ``__init__``.
Lazy ``HubClient`` resolution breaks that cycle without resorting to
function-level imports.
"""

import importlib
from typing import TYPE_CHECKING, Any

from .agent_client import AgentClient
from .channel import Channel
from .handlers import (
    default_handler,
    read_wal_until,
    resolve_view_policy,
    stamp_dependencies,
)
from .human_client import HumanClient
from .inject import AgentClientInject, ChannelInject, ChannelStateInject, HubInject, TaskInject
from .network_client import NetworkClient
from .plugin import NetworkContextPolicy, NetworkPlugin
from .skill_render import ParsedSkill, parse_skill_frontmatter, render_fallback_skill
from .task import ClientTask

if TYPE_CHECKING:
    from .hub_client import HubClient

__all__ = (
    "AgentClient",
    "AgentClientInject",
    "Channel",
    "ChannelInject",
    "ChannelStateInject",
    "ClientTask",
    "HubClient",
    "HubInject",
    "HumanClient",
    "NetworkClient",
    "NetworkContextPolicy",
    "NetworkPlugin",
    "ParsedSkill",
    "TaskInject",
    "default_handler",
    "parse_skill_frontmatter",
    "read_wal_until",
    "render_fallback_skill",
    "resolve_view_policy",
    "stamp_dependencies",
)


def __getattr__(name: str) -> Any:
    if name == "HubClient":
        module = importlib.import_module(".hub_client", __name__)
        value = module.HubClient
        globals()[name] = value
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
