export function Channels() {
  return (
    <section id="channels" className="wide">
      <div className="marker">06 / Channels</div>
      <h2>
        The channel <em>is</em> the action.
      </h2>
      <p className="lead">
        A durable, identity&#8209;scoped, protocol&#8209;typed container with an append&#8209;only WAL.
        Open it, work inside it, close it — the channel is what survives.
      </p>

      <div className="grid-2 wider" style={{ marginTop: 32 }}>
        <div>
          <h4>Manifest (data) + Adapter (code)</h4>
          <p>
            <code>ChannelManifest</code> is persisted data — type, version, participant schema, view
            policy, declared expectations. <code>ChannelAdapter</code> is stateless code registered by
            <code>(type, version)</code>. The state is a pure fold of the WAL.
          </p>
          <h4 style={{ marginTop: 22 }}>Audience addressing</h4>
          <p>
            Every envelope carries an <code>audience</code>: a subset of participants who see it, or
            <code> None </code> for broadcast. WAL records all; per&#8209;participant projection filters by
            visibility. Private side&#8209;channels and group context live on one primitive.
          </p>
        </div>

        <svg viewBox="0 0 540 320" aria-hidden="true">
          <rect x="20" y="50" width="100" height="44" rx="22" className="panel" />
          <text x="70" y="76" textAnchor="middle" className="title">PENDING</text>
          <text x="70" y="108" textAnchor="middle" className="lab lab-soft">invite sent</text>

          <rect x="170" y="50" width="100" height="44" rx="22" className="panel" stroke="var(--action)" />
          <text x="220" y="76" textAnchor="middle" className="title">ACTIVE</text>
          <text x="220" y="108" textAnchor="middle" className="lab lab-soft">running</text>

          <rect x="320" y="50" width="100" height="44" rx="22" className="panel" />
          <text x="370" y="76" textAnchor="middle" className="title">CLOSING</text>
          <text x="370" y="108" textAnchor="middle" className="lab lab-soft">quiescent</text>

          <rect x="170" y="190" width="100" height="44" rx="22" className="panel" />
          <text x="220" y="216" textAnchor="middle" className="title">CLOSED</text>

          <rect x="320" y="190" width="100" height="44" rx="22" className="panel" stroke="var(--violation)" />
          <text x="370" y="216" textAnchor="middle" className="title">EXPIRED</text>

          <path className="ch-line" d="M 120 72 L 165 72" />
          <polygon points="165,67 175,72 165,77" fill="var(--channel)" />
          <path className="ch-line" d="M 270 72 L 315 72" />
          <polygon points="315,67 325,72 315,77" fill="var(--channel)" />
          <path className="ch-line" d="M 250 94 Q 240 150 230 185" />
          <polygon points="226,180 230,190 234,180" fill="var(--channel)" />
          <path className="vi-line" d="M 70 94 Q 100 160 175 210" strokeDasharray="4 4" />
          <polygon points="172,205 182,210 175,215" fill="var(--violation)" />
          <path className="vi-line" d="M 370 94 L 370 185" />
          <polygon points="366,185 370,195 374,185" fill="var(--violation)" />

          <text x="142" y="64" className="lab lab-ac" textAnchor="middle">acks ✓</text>
          <text x="292" y="64" className="lab lab-soft" textAnchor="middle">on_accepted</text>
          <text x="285" y="146" className="lab lab-soft" textAnchor="middle">close()</text>
          <text x="115" y="145" className="lab lab-vi" textAnchor="middle">acks ∅</text>
          <text x="395" y="145" className="lab lab-vi" textAnchor="middle">TTL</text>

          <rect x="20" y="260" width="500" height="46" rx="4" fill="var(--card-2)" stroke="var(--line)" />
          <text x="270" y="278" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11.5 }}>
            state = fold(envelope, prior state)
          </text>
          <text x="270" y="294" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10.5 }}>
            deterministic · O(1) per envelope · rebuilt from the WAL on restart
          </text>
        </svg>
      </div>

      <h3 style={{ marginTop: 48, fontSize: 22 }}>Four built&#8209;in choreographies on the same primitive.</h3>
      <div className="grid-4">
        <div className="card channel">
          <div className="badge">consulting</div>
          <h3>1 ↔ 1, one round</h3>
          <p>Strict Q+R. Initiator asks, respondent answers, channel auto&#8209;closes.</p>
        </div>
        <div className="card channel">
          <div className="badge">conversation</div>
          <h3>1 ↔ 1, multi&#8209;turn</h3>
          <p>Bidirectional, long&#8209;running. Either side may speak.</p>
        </div>
        <div className="card channel">
          <div className="badge">discussion</div>
          <h3>N&#8209;party turn&#8209;taking</h3>
          <p>Round&#8209;robin, dynamic, or static ordering. N&#8209;of&#8209;M quorum on handshake.</p>
        </div>
        <div className="card channel">
          <div className="badge">workflow</div>
          <h3>Orchestrated by a graph</h3>
          <p>Speaker advances per a declarative <code>TransitionGraph</code>. Replaces classic GroupChat + Handoffs + AfterWork.</p>
        </div>
      </div>
    </section>
  );
}
