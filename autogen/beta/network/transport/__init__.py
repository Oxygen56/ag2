# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Transport layer — frames + Link Protocol + ``LocalLink``.

Ships ``LocalLink`` (in-memory duplex). The ``Link`` Protocol surface
lets cross-process transports plug in without affecting layers above.
"""

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
    SendFrame,
    SubscribeFrame,
    UnsubscribeFrame,
    WelcomeFrame,
    decode_frame,
    encode_frame,
)
from .link import LinkClient, LinkEndpoint
from .local import LocalLink, LocalLinkClient, LocalLinkEndpoint

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
    "SendFrame",
    "SubscribeFrame",
    "UnsubscribeFrame",
    "WelcomeFrame",
    "decode_frame",
    "encode_frame",
)
