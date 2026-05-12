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

export type Phase = {
  id: string;
  label: string;
  start: number;
  end: number;
};

export type ReplayData = {
  participants: Participant[];
  channels: Channel[];
  envelopes: Envelope[];
  events: EventStep[];
  duration: number;
  hubs?: Hub[];
  phases?: Phase[];
  width?: number;
  height?: number;
};

const COLORS: Record<Envelope["type"], string> = {
  text: "var(--channel)",
  task: "var(--action)",
  handoff: "var(--identity)",
  protocol: "var(--ink-mute)",
};

const TYPE_LABEL: Record<Envelope["type"], string> = {
  text: "message",
  task: "task event",
  handoff: "handoff",
  protocol: "protocol",
};

const formatT = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

// envelope flight duration (slowed for visibility)
const ENV_DUR = 1.1;
// how long after an envelope lands its participants stay highlighted
const ACTIVE_LINGER = 1.4;

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

  const inFlight = data.envelopes.filter(
    (env) => env.t <= t && env.t + ENV_DUR > t
  );

  // recent envelopes — used to spotlight active participants even briefly after delivery
  const recentEnvelopes = data.envelopes.filter(
    (env) => env.t <= t && env.t + ENV_DUR + ACTIVE_LINGER > t
  );
  const activeIds = new Set<string>();
  for (const e of recentEnvelopes) {
    activeIds.add(e.from);
    activeIds.add(e.to);
  }
  // also light up anyone who just joined
  for (const p of activeParticipants) {
    if (justJoined(p)) activeIds.add(p.id);
  }
  const hasAnyActivity = activeIds.size > 0;

  const passed = data.events.filter((e) => e.t <= t);
  const currentEvent = passed[passed.length - 1];
  const previousEvents = passed.slice(-5, -1).reverse();

  const W = data.width ?? 800;
  const H = data.height ?? 480;

  // phase logic
  const phases = data.phases ?? [];
  const currentPhaseIndex = phases.findIndex(
    (p) => p.start <= t && p.end > t
  );

  const onReset = () => {
    setT(0);
    setPlaying(true);
  };

  return (
    <div ref={containerRef} className="replay">
      {/* Phase stepper */}
      {phases.length > 0 && (
        <div className="replay-phases">
          {phases.map((phase, i) => {
            const isCurrent = i === currentPhaseIndex;
            const isPast = phase.end <= t;
            const progress = isCurrent
              ? Math.min(1, Math.max(0, (t - phase.start) / (phase.end - phase.start)))
              : isPast
              ? 1
              : 0;
            return (
              <div
                key={phase.id}
                className={`replay-phase ${
                  isCurrent ? "current" : isPast ? "past" : "future"
                }`}
              >
                <div className="replay-phase-dot">
                  {isCurrent ? (
                    <svg viewBox="0 0 16 16" width="16" height="16">
                      <circle cx="8" cy="8" r="7" fill="none" stroke="var(--channel-soft)" strokeWidth="1.5" />
                      <path
                        d={`M 8 1 A 7 7 0 ${progress > 0.5 ? 1 : 0} 1 ${
                          8 + 7 * Math.sin(progress * Math.PI * 2)
                        } ${8 - 7 * Math.cos(progress * Math.PI * 2)} L 8 8 Z`}
                        fill="var(--channel)"
                        opacity="0.85"
                      />
                    </svg>
                  ) : isPast ? (
                    <svg viewBox="0 0 16 16" width="16" height="16">
                      <circle cx="8" cy="8" r="6" fill="var(--channel)" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" width="16" height="16">
                      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--line-strong)" strokeWidth="1.2" />
                    </svg>
                  )}
                </div>
                <div className="replay-phase-label">
                  <div className="replay-phase-num">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="replay-phase-name">{phase.label}</div>
                </div>
                {i < phases.length - 1 && <div className="replay-phase-bar" />}
              </div>
            );
          })}
          <div className="replay-phase-time">{formatT(t)}</div>
        </div>
      )}

      {/* Now-playing banner */}
      <div className="replay-now">
        <div className="replay-now-stamp">
          {currentEvent ? formatT(currentEvent.t) : "—"}
          <span className="replay-now-tick" />
        </div>
        <div className="replay-now-body">
          <div className={`replay-now-text kind-${currentEvent?.kind ?? "info"}`}>
            {currentEvent ? currentEvent.text : "awaiting first event…"}
          </div>
          <div className="replay-now-meta">
            <span>
              {activeParticipants.length} participant
              {activeParticipants.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{data.channels.filter(
              (c) => c.openTime <= t && (c.closeTime === undefined || c.closeTime > t)
            ).length} active channel{data.channels.filter(
              (c) => c.openTime <= t && (c.closeTime === undefined || c.closeTime > t)
            ).length === 1 ? "" : "s"}</span>
          </div>
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

            {activeParticipants.map((p) => {
              const joining = justJoined(p);
              const leaving = aboutToLeave(p);
              const isActive = !hasAnyActivity || activeIds.has(p.id);
              const fadeIn = joining ? Math.min(1, (t - (p.joinTime ?? 0)) / 0.7) : 1;
              const fadeOut = leaving
                ? Math.max(0.25, ((p.leaveTime ?? Infinity) - t) / 1)
                : 1;
              const baseOpacity = Math.min(fadeIn, fadeOut);
              const opacity = baseOpacity * (isActive ? 1 : 0.38);
              const r = joining ? 18 + (1 - fadeIn) * 12 : 22;
              const stroke =
                p.kind === "human"
                  ? "var(--ink-soft)"
                  : p.kind === "system"
                  ? "var(--channel)"
                  : "var(--identity)";
              return (
                <g key={p.id} opacity={opacity}>
                  {/* glow ring for active */}
                  {isActive && !joining && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 6}
                      fill="none"
                      stroke="var(--channel)"
                      strokeWidth={1.2}
                      opacity={0.5}
                    />
                  )}
                  {joining && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 10}
                      fill="none"
                      stroke="var(--action)"
                      strokeWidth={1.2}
                      opacity={0.6 * (1 - fadeIn)}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill="var(--card)"
                    stroke={stroke}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeDasharray={p.kind === "human" ? "3 3" : undefined}
                  />
                  <text
                    x={p.x}
                    y={p.y + 3}
                    textAnchor="middle"
                    style={{
                      fontSize: 10,
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
                      y={p.y + 42}
                      textAnchor="middle"
                      style={{
                        fontSize: 9.5,
                        fill: isActive ? "var(--ink-soft)" : "var(--ink-mute)",
                        fontFamily: "var(--mono)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {p.device}
                    </text>
                  )}
                  {joining && (
                    <g>
                      <rect
                        x={p.x - 38}
                        y={p.y - 50}
                        width={76}
                        height={20}
                        rx={10}
                        fill="var(--action-pale)"
                        stroke="var(--action)"
                        strokeWidth={1}
                        opacity={fadeIn}
                      />
                      <text
                        x={p.x}
                        y={p.y - 36}
                        textAnchor="middle"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "var(--action)",
                          fontFamily: "var(--mono)",
                          opacity: fadeIn,
                        }}
                      >
                        + joined
                      </text>
                    </g>
                  )}
                  {leaving && (
                    <g>
                      <rect
                        x={p.x - 40}
                        y={p.y - 50}
                        width={80}
                        height={20}
                        rx={10}
                        fill="var(--card-2)"
                        stroke="var(--ink-mute)"
                        strokeWidth={1}
                      />
                      <text
                        x={p.x}
                        y={p.y - 36}
                        textAnchor="middle"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "var(--ink-mute)",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        − leaving
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {inFlight.map((env, i) => {
              const from = data.participants.find((p) => p.id === env.from);
              const to = data.participants.find((p) => p.id === env.to);
              if (!from || !to) return null;
              const progress = (t - env.t) / ENV_DUR;
              const ex = from.x + (to.x - from.x) * progress;
              const ey = from.y + (to.y - from.y) * progress;
              const color = COLORS[env.type];
              return (
                <g key={i}>
                  {/* trail line */}
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={ex}
                    y2={ey}
                    stroke={color}
                    strokeWidth={1.4}
                    strokeOpacity={0.5}
                    strokeDasharray="3 4"
                  />
                  {/* outer glow */}
                  <circle cx={ex} cy={ey} r={11} fill={color} opacity={0.18} />
                  {/* dot */}
                  <circle cx={ex} cy={ey} r={6} fill={color} />
                  {/* label — visible most of the flight */}
                  {env.label && progress < 0.85 && (
                    <g>
                      <rect
                        x={ex - 50}
                        y={ey - 30}
                        width={100}
                        height={18}
                        rx={9}
                        fill="var(--card)"
                        stroke={color}
                        strokeWidth={1}
                        opacity={Math.min(1, (1 - progress) * 1.6)}
                      />
                      <text
                        x={ex}
                        y={ey - 17}
                        textAnchor="middle"
                        style={{
                          fontSize: 10,
                          fill: color,
                          fontFamily: "var(--mono)",
                          fontWeight: 500,
                          opacity: Math.min(1, (1 - progress) * 1.6),
                        }}
                      >
                        {env.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="replay-log">
          <div className="replay-log-head">recent activity</div>
          <ol>
            {previousEvents.length === 0 && currentEvent && (
              <li className="empty">— this is the start —</li>
            )}
            {previousEvents.map((e, i) => (
              <li key={`${e.t}-${i}`}>
                <span className="ts">{formatT(e.t)}</span>
                <span className={`text kind-${e.kind ?? "info"}`}>{e.text}</span>
              </li>
            ))}
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
        <span className="replay-time-readout">{formatT(t)}</span>
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
