# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Transport layer — frames + Link Protocol + ``LocalLink`` + optional
WebSocket / HTTP transports.

Ships ``LocalLink`` (in-memory duplex) unconditionally. ``WsLink`` and
``make_http_app`` require optional deps (``websockets``, ``starlette``)
and fall back to ``missing_optional_dependency`` stubs when those are
absent — importing this package never crashes on a slim install.
"""

from autogen.beta.exceptions import missing_optional_dependency

from .frames import (
    AcceptFrame,
    ChunkFrame,
    ErrorFrame,
    EventFrame,
    Frame,
    HelloFrame,
    NetworkChangedFrame,
    NotifyFrame,
    PingFrame,
    PongFrame,
    ReceiptFrame,
    RpcCallFrame,
    RpcResultFrame,
    SendFrame,
    SubscribeFrame,
    UnsubscribeFrame,
    WelcomeFrame,
    decode_frame,
    encode_frame,
)
from .link import LinkClient, LinkEndpoint
from .local import LocalLink, LocalLinkClient, LocalLinkEndpoint

try:
    from .ws import WsLink, WsLinkClient, WsLinkEndpoint, serve_ws
except ImportError as e:
    WsLink = missing_optional_dependency("WsLink", "websockets", e)  # type: ignore[misc]
    WsLinkClient = missing_optional_dependency("WsLinkClient", "websockets", e)  # type: ignore[misc]
    WsLinkEndpoint = missing_optional_dependency("WsLinkEndpoint", "websockets", e)  # type: ignore[misc]
    serve_ws = missing_optional_dependency("serve_ws", "websockets", e)  # type: ignore[misc]

try:
    from .http import make_http_app
except ImportError as e:
    make_http_app = missing_optional_dependency("make_http_app", "starlette", e)  # type: ignore[misc]

__all__ = (
    "AcceptFrame",
    "ChunkFrame",
    "ErrorFrame",
    "EventFrame",
    "Frame",
    "HelloFrame",
    "LinkClient",
    "LinkEndpoint",
    "LocalLink",
    "LocalLinkClient",
    "LocalLinkEndpoint",
    "NetworkChangedFrame",
    "NotifyFrame",
    "PingFrame",
    "PongFrame",
    "ReceiptFrame",
    "RpcCallFrame",
    "RpcResultFrame",
    "SendFrame",
    "SubscribeFrame",
    "UnsubscribeFrame",
    "WelcomeFrame",
    "WsLink",
    "WsLinkClient",
    "WsLinkEndpoint",
    "decode_frame",
    "encode_frame",
    "make_http_app",
    "serve_ws",
)
