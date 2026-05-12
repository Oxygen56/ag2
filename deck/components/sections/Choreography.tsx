export function Choreography() {
  return (
    <section id="choreography" className="wide">
      <div className="marker">08 / Choreography</div>
      <h2>
        Choreography you can <em>dial in.</em>
      </h2>
      <p className="lead">
        From an open multi&#8209;party discussion to a fully declared workflow — same primitive, same
        fold semantics. Choose the level of control. Mix when the work calls for it.
      </p>

      <div className="grid-2 wider" style={{ marginTop: 32 }}>
        <div>
          <h4>Why choreography is the right default</h4>
          <p>
            When agents decide the next move from a local view of a shared, durable log — rather than
            from a central conductor — the properties you actually want fall out by construction.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 24px" }}>
            <li style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <strong>No bottleneck.</strong>{" "}
              <span style={{ color: "var(--ink-soft)" }}>No conductor, no single point of latency or failure.</span>
            </li>
            <li style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <strong>Parallelism by default.</strong>{" "}
              <span style={{ color: "var(--ink-soft)" }}>Multi&#8209;party fan&#8209;out happens at the network, not in user code.</span>
            </li>
            <li style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <strong>Cross&#8209;process by construction.</strong>{" "}
              <span style={{ color: "var(--ink-soft)" }}>No shared orchestrator state — participants live anywhere.</span>
            </li>
            <li style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <strong>Human as peer.</strong>{" "}
              <span style={{ color: "var(--ink-soft)" }}>A person is just another participant with a different reply latency.</span>
            </li>
            <li style={{ padding: "8px 0" }}>
              <strong>Resumable by construction.</strong>{" "}
              <span style={{ color: "var(--ink-soft)" }}>Each turn is recomputed from the WAL — restart any participant.</span>
            </li>
          </ul>
          <h4>Controlled choreography</h4>
          <p>
            Pure choreography is loose; full orchestration is rigid. The framework offers control as a
            dial: pick how much, where, and when.
          </p>
        </div>

        <svg viewBox="0 0 540 540" aria-hidden="true">
          <line x1="40" y1="56" x2="490" y2="56" className="ax" />
          <polygon points="488,52 498,56 488,60" fill="var(--ink-mute)" />
          <text x="40" y="40" className="lab lab-soft">open</text>
          <text x="500" y="40" textAnchor="end" className="lab lab-soft">strict</text>

          <line x1="90" y1="50" x2="90" y2="62" className="ax" />
          <line x1="215" y1="50" x2="215" y2="62" className="ax" />
          <line x1="345" y1="50" x2="345" y2="62" className="ax" />
          <line x1="465" y1="50" x2="465" y2="62" className="ax" />

          <line x1="90" y1="62" x2="90" y2="100" stroke="var(--action)" />
          <line x1="215" y1="62" x2="215" y2="100" stroke="var(--channel)" />
          <line x1="345" y1="62" x2="345" y2="100" stroke="var(--identity)" />
          <line x1="465" y1="62" x2="465" y2="100" stroke="var(--violation)" />

          {/* dynamic */}
          <g transform="translate(50 100)">
            <rect width="80" height="80" rx="4" fill="var(--card)" stroke="var(--action)" />
            <circle cx="22" cy="22" r="5" fill="var(--channel)" />
            <circle cx="58" cy="26" r="5" fill="var(--channel)" />
            <circle cx="30" cy="56" r="5" fill="var(--channel)" />
            <circle cx="60" cy="58" r="5" fill="var(--channel)" />
            <line x1="26" y1="24" x2="54" y2="26" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="58" y1="30" x2="60" y2="54" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="34" y1="56" x2="56" y2="58" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="22" y1="26" x2="30" y2="52" stroke="var(--channel)" strokeWidth="0.7" />
          </g>
          <text x="90" y="204" textAnchor="middle" className="title">dynamic</text>
          <text x="90" y="222" textAnchor="middle" className="lab lab-soft">discussion</text>
          <text x="90" y="236" textAnchor="middle" className="lab lab-soft">anyone speaks</text>
          <text x="90" y="250" textAnchor="middle" className="lab lab-soft">when ready</text>

          {/* round_robin */}
          <g transform="translate(175 100)">
            <rect width="80" height="80" rx="4" fill="var(--card)" stroke="var(--channel)" />
            <circle cx="40" cy="20" r="4" fill="var(--channel)" />
            <circle cx="62" cy="40" r="4" fill="var(--channel)" />
            <circle cx="50" cy="62" r="4" fill="var(--channel)" />
            <circle cx="25" cy="58" r="4" fill="var(--channel)" />
            <circle cx="18" cy="32" r="4" fill="var(--channel)" />
            <path d="M 42 24 Q 58 28 60 38" stroke="var(--channel)" fill="none" strokeWidth="0.7" />
            <path d="M 60 42 Q 58 60 52 60" stroke="var(--channel)" fill="none" strokeWidth="0.7" />
            <path d="M 48 62 Q 36 64 28 60" stroke="var(--channel)" fill="none" strokeWidth="0.7" />
            <path d="M 23 56 Q 16 46 18 34" stroke="var(--channel)" fill="none" strokeWidth="0.7" />
            <path d="M 20 30 Q 28 22 38 22" stroke="var(--channel)" fill="none" strokeWidth="0.7" />
          </g>
          <text x="215" y="204" textAnchor="middle" className="title">round&#8209;robin</text>
          <text x="215" y="222" textAnchor="middle" className="lab lab-soft">discussion</text>
          <text x="215" y="236" textAnchor="middle" className="lab lab-soft">turn order</text>
          <text x="215" y="250" textAnchor="middle" className="lab lab-soft">enforced</text>

          {/* static */}
          <g transform="translate(305 100)">
            <rect width="80" height="80" rx="4" fill="var(--card)" stroke="var(--identity)" />
            <circle cx="14" cy="40" r="4" fill="var(--channel)" />
            <circle cx="32" cy="40" r="4" fill="var(--channel)" />
            <circle cx="50" cy="40" r="4" fill="var(--channel)" />
            <circle cx="68" cy="40" r="4" fill="var(--channel)" />
            <line x1="18" y1="40" x2="28" y2="40" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="36" y1="40" x2="46" y2="40" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="54" y1="40" x2="64" y2="40" stroke="var(--channel)" strokeWidth="0.7" />
            <polygon points="62,38 66,40 62,42" fill="var(--channel)" />
          </g>
          <text x="345" y="204" textAnchor="middle" className="title">static</text>
          <text x="345" y="222" textAnchor="middle" className="lab lab-soft">discussion</text>
          <text x="345" y="236" textAnchor="middle" className="lab lab-soft">pre&#8209;declared</text>
          <text x="345" y="250" textAnchor="middle" className="lab lab-soft">pipeline</text>

          {/* workflow */}
          <g transform="translate(425 100)">
            <rect width="80" height="80" rx="4" fill="var(--card)" stroke="var(--violation)" />
            <circle cx="14" cy="40" r="4" fill="var(--channel)" />
            <circle cx="40" cy="20" r="4" fill="var(--channel)" />
            <circle cx="40" cy="60" r="4" fill="var(--channel)" />
            <circle cx="66" cy="40" r="4" fill="var(--channel)" />
            <line x1="18" y1="38" x2="36" y2="22" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="18" y1="42" x2="36" y2="58" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="44" y1="22" x2="62" y2="38" stroke="var(--channel)" strokeWidth="0.7" />
            <line x1="44" y1="58" x2="62" y2="42" stroke="var(--channel)" strokeWidth="0.7" />
          </g>
          <text x="465" y="204" textAnchor="middle" className="title">workflow</text>
          <text x="465" y="222" textAnchor="middle" className="lab lab-soft">declarative</text>
          <text x="465" y="236" textAnchor="middle" className="lab lab-soft">graph over</text>
          <text x="465" y="250" textAnchor="middle" className="lab lab-soft">folded state</text>

          <line x1="40" y1="290" x2="490" y2="290" stroke="var(--violation)" strokeDasharray="6 6" />
          <text x="265" y="284" textAnchor="middle" className="lab lab-vi">
            expectations bound every mode
          </text>

          <g transform="translate(40 310)">
            <rect width="450" height="180" rx="4" fill="var(--violation-pale)" stroke="var(--violation-soft)" />
            <text x="225" y="30" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
              six declarative protocol&#8209;shape contracts
            </text>
            <line x1="20" y1="46" x2="430" y2="46" className="ax-soft" />
            <g style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
              <text x="20" y="74" className="lab lab-em">acks_within</text>
              <text x="170" y="74" className="lab lab-em">reply_within</text>
              <text x="320" y="74" className="lab lab-em">turn_within</text>
              <text x="20" y="100" className="lab lab-em">max_silence</text>
              <text x="170" y="100" className="lab lab-em">progress_within</text>
              <text x="320" y="100" className="lab lab-em">min_participation</text>
            </g>
            <line x1="20" y1="118" x2="430" y2="118" className="ax-soft" />
            <text x="225" y="138" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 11 }}>
              on violation, the framework runs one of:
            </text>
            <g style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
              <text x="20" y="162" className="lab lab-ch">audit</text>
              <text x="80" y="162" className="lab lab-ch">warn</text>
              <text x="140" y="162" className="lab lab-ch">notify</text>
              <text x="210" y="162" className="lab lab-ch">hide</text>
              <text x="270" y="162" className="lab lab-ch">remove</text>
              <text x="350" y="162" className="lab lab-ch">auto_close</text>
            </g>
          </g>

          <text x="265" y="510" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            the framework records, signals, narrows, or closes
          </text>
          <text x="265" y="524" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            never invents content · never substitutes for an agent
          </text>
        </svg>
      </div>

      <div className="meta-strip">
        <div>
          <div className="key">The framework provides</div>
          <div className="val">Bounded waits · protocol&#8209;shape enforcement · at&#8209;least&#8209;once delivery</div>
        </div>
        <div>
          <div className="key">The agent provides</div>
          <div className="val">The reply, the work, the reaction to a violation signal</div>
        </div>
        <div>
          <div className="key">Net effect</div>
          <div className="val">Dependable substrate beneath · creative latitude above</div>
        </div>
      </div>
    </section>
  );
}
