"use client";

import { useEffect, useRef, useState } from "react";

export type Participant = {
  id: string;
  name: string;
  kind: "agent" | "human" | "system";
  device?: string;
  hub?: string;
  x: number;
  y: number;
  joinTime?: number;
  leaveTime?: number;
};

export type Channel = {
  id: string;
  label: string;
  type: "consulting" | "conversation" | "discussion" | "workflow";
  openTime: number;
  closeTime?: number;
  participants: string[];
};

export type Envelope = {
  t: number;
  from: string;
  to: string;
  type: "text" | "task" | "handoff" | "protocol";
  label?: string;
};

export type EventStep = {
  t: number;
  text: string;
  kind?: "info" | "join" | "leave" | "open" | "close" | "alert";
};

export type Hub = {
  id: string;
  label: string;
  box: [number, number, number, number]; // x, y, w, h
};

export type ReplayData = {
  participants: Participant[];
  channels: Channel[];
  envelopes: Envelope[];
  events: EventStep[];
  duration: number;
  hubs?: Hub[];
  width?: number;
  height?: number;
};

const COLORS: Record<Envelope["type"], string> = {
  text: "var(--channel)",
  task: "var(--action)",
  handoff: "var(--identity)",
  protocol: "var(--ink-mute)",
};

const formatT = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export function EventReplay({ data }: { data: ReplayData }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // animation loop
  useEffect(() => {
    if (!playing) return;
    let rafId: number;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (next >= data.duration) {
          setPlaying(false);
          return data.duration;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, speed, data.duration]);

  // autoplay on scroll-into-view, once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            setPlaying(true);
          }
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const activeParticipants = data.participants.filter(
    (p) => (p.joinTime ?? 0) <= t && (p.leaveTime === undefined || p.leaveTime > t)
  );

  const justJoined = (p: Participant) =>
    p.joinTime !== undefined && p.joinTime > 0 && t - p.joinTime < 1.2;
  const aboutToLeave = (p: Participant) =>
    p.leaveTime !== undefined && p.leaveTime - t < 1 && p.leaveTime > t;

  const ENV_DUR = 0.7;
  const inFlight = data.envelopes.filter(
    (env) => env.t <= t && env.t + ENV_DUR > t
  );

  const activeChannels = data.channels.filter(
    (c) => c.openTime <= t && (c.closeTime === undefined || c.closeTime > t)
  );

  const passed = data.events.filter((e) => e.t <= t);
  const recent = passed.slice(-6);

  const W = data.width ?? 800;
  const H = data.height ?? 480;

  // channel edges between active participants
  const seenEdges = new Set<string>();
  const channelEdges: { from: Participant; to: Participant }[] = [];
  for (const ch of activeChannels) {
    const inCh = ch.participants
      .map((id) => activeParticipants.find((p) => p.id === id))
      .filter(Boolean) as Participant[];
    for (let i = 0; i < inCh.length; i++) {
      for (let j = i + 1; j < inCh.length; j++) {
        const key = [inCh[i].id, inCh[j].id].sort().join("-");
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          channelEdges.push({ from: inCh[i], to: inCh[j] });
        }
      }
    }
  }

  const onReset = () => {
    setT(0);
    setPlaying(true);
  };

  return (
    <div ref={containerRef} className="replay">
      <div className="replay-status">
        <div className="replay-time">
          <span className="replay-time-label">t</span>
          <span className="replay-time-value">{formatT(t)}</span>
          <span className="replay-time-total">/ {formatT(data.duration)}</span>
        </div>
        <div className="replay-counts">
          <span>
            <strong>{activeParticipants.length}</strong> participants
          </span>
          <span>
            <strong>{activeChannels.length}</strong> active channel
            {activeChannels.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="replay-channels">
          {activeChannels.map((c) => (
            <span key={c.id} className={`pill ${c.type === "workflow" ? "id" : "ch"}`}>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="replay-body">
        <div className="replay-canvas">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            {data.hubs?.map((hub) => (
              <g key={hub.id}>
                <rect
                  x={hub.box[0]}
                  y={hub.box[1]}
                  width={hub.box[2]}
                  height={hub.box[3]}
                  rx={6}
                  fill="rgba(220, 233, 236, 0.32)"
                  stroke="var(--channel-soft)"
                  strokeDasharray="6 4"
                />
                <text
                  x={hub.box[0] + 14}
                  y={hub.box[1] + 22}
                  className="lab lab-ch"
                  style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}
                >
                  {hub.label}
                </text>
              </g>
            ))}

            {channelEdges.map((edge, i) => (
              <line
                key={i}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                stroke="var(--channel-soft)"
                strokeWidth={0.7}
                strokeOpacity={0.45}
              />
            ))}

            {activeParticipants.map((p) => {
              const joining = justJoined(p);
              const leaving = aboutToLeave(p);
              const fadeIn = joining ? Math.min(1, (t - (p.joinTime ?? 0)) / 0.7) : 1;
              const fadeOut = leaving
                ? Math.max(0.25, ((p.leaveTime ?? Infinity) - t) / 1)
                : 1;
              const opacity = Math.min(fadeIn, fadeOut);
              const r = joining ? 16 + (1 - fadeIn) * 12 : 20;
              const stroke =
                p.kind === "human"
                  ? "var(--ink-soft)"
                  : p.kind === "system"
                  ? "var(--channel)"
                  : "var(--identity)";
              return (
                <g key={p.id} opacity={opacity}>
                  {joining && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 8}
                      fill="none"
                      stroke="var(--action)"
                      strokeWidth={1}
                      opacity={0.6 * (1 - fadeIn)}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill="var(--card)"
                    stroke={stroke}
                    strokeWidth={1.5}
                    strokeDasharray={p.kind === "human" ? "3 3" : undefined}
                  />
                  <text
                    x={p.x}
                    y={p.y + 3}
                    textAnchor="middle"
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      fill: "var(--ink)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {p.name}
                  </text>
                  {p.device && (
                    <text
                      x={p.x}
                      y={p.y + 38}
                      textAnchor="middle"
                      style={{
                        fontSize: 9,
                        fill: "var(--ink-mute)",
                        fontFamily: "var(--mono)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {p.device}
                    </text>
                  )}
                  {joining && (
                    <text
                      x={p.x}
                      y={p.y - 30}
                      textAnchor="middle"
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        fill: "var(--action)",
                        fontFamily: "var(--mono)",
                        opacity: fadeIn,
                      }}
                    >
                      + joined
                    </text>
                  )}
                  {leaving && (
                    <text
                      x={p.x}
                      y={p.y - 30}
                      textAnchor="middle"
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        fill: "var(--ink-mute)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      − leaving
                    </text>
                  )}
                </g>
              );
            })}

            {inFlight.map((env, i) => {
              const from = data.participants.find((p) => p.id === env.from);
              const to = data.participants.find((p) => p.id === env.to);
              if (!from || !to) return null;
              const progress = (t - env.t) / ENV_DUR;
              const ease = progress; // linear is fine; envelope is a discrete move
              const ex = from.x + (to.x - from.x) * ease;
              const ey = from.y + (to.y - from.y) * ease;
              const color = COLORS[env.type];
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={ex}
                    y2={ey}
                    stroke={color}
                    strokeWidth={1}
                    strokeOpacity={0.4}
                    strokeDasharray="2 3"
                  />
                  <circle cx={ex} cy={ey} r={5} fill={color} />
                  {env.label && progress < 0.55 && (
                    <text
                      x={ex}
                      y={ey - 12}
                      textAnchor="middle"
                      style={{
                        fontSize: 10,
                        fill: color,
                        fontFamily: "var(--mono)",
                        fontWeight: 500,
                      }}
                    >
                      {env.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="replay-log">
          <div className="replay-log-head">event log</div>
          <ol>
            {recent.map((e, i) => {
              const isLast = i === recent.length - 1;
              return (
                <li key={`${e.t}-${i}`} className={isLast ? "current" : ""}>
                  <span className="ts">{formatT(e.t)}</span>
                  <span className={`text kind-${e.kind ?? "info"}`}>{e.text}</span>
                </li>
              );
            })}
            {recent.length === 0 && (
              <li className="empty">…awaiting first event…</li>
            )}
          </ol>
          <div className="replay-legend">
            <span>
              <i style={{ background: "var(--channel)" }} /> text
            </span>
            <span>
              <i style={{ background: "var(--action)" }} /> task
            </span>
            <span>
              <i style={{ background: "var(--identity)" }} /> handoff
            </span>
            <span>
              <i style={{ background: "var(--ink-mute)" }} /> protocol
            </span>
          </div>
        </div>
      </div>

      <div className="replay-controls">
        <button
          className="replay-btn"
          onClick={() =>
            t >= data.duration ? onReset() : setPlaying((p) => !p)
          }
        >
          {t >= data.duration ? "↻ replay" : playing ? "⏸ pause" : "▶ play"}
        </button>
        <input
          type="range"
          min={0}
          max={data.duration}
          step={0.1}
          value={t}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setT(v);
            if (v >= data.duration) setPlaying(false);
          }}
          className="replay-scrub"
        />
        <button className="replay-btn replay-btn-icon" onClick={onReset} title="Reset">
          ↻
        </button>
        <select
          className="replay-speed"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>
    </div>
  );
}
