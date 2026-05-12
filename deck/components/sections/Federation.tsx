export function Federation() {
  return (
    <section id="federation" className="wide">
      <div className="marker">09 / Federation</div>
      <h2>
        One channel, <em>two organisations.</em>
      </h2>
      <p className="lead">
        Multi&#8209;hub federation is the base case, not the extension. A channel can span hubs the
        same way a TCP connection can span networks — a <span className="ac-i">Passport</span> identifies
        the agent, and a <span className="ac-i">Visa</span> grants entry to the destination hub.
      </p>

      <div className="grid-2 wider" style={{ marginTop: 32 }}>
        <div>
          <h4>Passport + Visa</h4>
          <p>
            A passport is the agent&apos;s permanent identity, signed by its home hub. A visa is
            the destination hub&apos;s stamp on top of that passport — scoped, expiring, revocable.
            When an agent acts on a foreign hub, it presents both: <em className="term">who I am</em> + <em className="term"> what I&apos;m permitted to do here</em>.
          </p>
          <h4 style={{ marginTop: 22 }}>How routing works</h4>
          <p>
            The <code>HubArbiter.resolve_unknown_audience</code> seam decides routing — an envelope
            addressed to <code>partner.curator</code> resolves to "forward to peer hub." The
            destination hub validates the visa before accepting the envelope.
          </p>
          <h4 style={{ marginTop: 22 }}>Cache + push, not poll</h4>
          <p>
            <code>NetworkChangedFrame</code> propagates identity and visa changes across the
            federation the way BGP propagates routes. Hubs gossip; clients cache; revocations
            invalidate on push.
          </p>
        </div>

        <svg viewBox="0 0 540 380" aria-hidden="true">
          <rect className="panel" x="30" y="50" width="200" height="280" rx="6" stroke="var(--channel)" />
          <text x="130" y="74" textAnchor="middle" className="title">Hub A</text>
          <text x="130" y="90" textAnchor="middle" className="lab lab-soft">acme.example</text>

          <circle className="node-ag" cx="80" cy="160" r="16" />
          <text x="80" y="164" textAnchor="middle" className="lab lab-em">alice</text>
          <circle className="node-ag" cx="180" cy="160" r="16" />
          <text x="180" y="164" textAnchor="middle" className="lab lab-em">bob</text>
          <circle className="node-hu" cx="130" cy="260" r="16" />
          <text x="130" y="264" textAnchor="middle" className="lab lab-em">user</text>

          <rect className="panel" x="310" y="50" width="200" height="280" rx="6" stroke="var(--identity)" />
          <text x="410" y="74" textAnchor="middle" className="title">Hub B</text>
          <text x="410" y="90" textAnchor="middle" className="lab lab-soft">partner.example</text>

          <circle className="node-ag" cx="360" cy="160" r="16" />
          <text x="360" y="164" textAnchor="middle" className="lab lab-em">carol</text>
          <circle className="node-ag" cx="460" cy="160" r="16" />
          <text x="460" y="164" textAnchor="middle" className="lab lab-em">dave</text>
          <circle className="node-hub" cx="410" cy="260" r="14" />
          <text x="410" y="264" textAnchor="middle" className="lab lab-ch">srv</text>

          {/* federation link with passport+visa visual */}
          <path className="id-line flow" d="M 230 180 Q 270 180 310 180" strokeWidth="2" />

          {/* mini passport+visa icon at link center */}
          <g transform="translate(255 195)">
            <rect width="32" height="22" rx="2" fill="var(--card)" stroke="var(--identity)" strokeWidth="1.2" />
            <line x1="0" y1="8" x2="32" y2="8" stroke="var(--identity)" strokeWidth="0.8" />
            {/* visa stamp circle */}
            <circle cx="24" cy="15" r="6" fill="none" stroke="var(--channel)" strokeWidth="1.2" />
            <text x="24" y="17" textAnchor="middle" style={{ fontSize: 6, fill: "var(--channel)", fontFamily: "var(--mono)", fontWeight: 600 }}>V</text>
            <text x="6" y="6" style={{ fontSize: 4, fill: "var(--identity)", fontFamily: "var(--mono)" }}>P</text>
          </g>

          <text x="270" y="160" textAnchor="middle" className="lab lab-id" style={{ fontSize: 10 }}>passport</text>
          <text x="270" y="232" textAnchor="middle" className="lab lab-ch" style={{ fontSize: 10 }}>+ visa</text>

          <path className="ch-line flow" d="M 80 144 Q 200 30 360 144" strokeWidth="1.5" />
          <text x="220" y="40" textAnchor="middle" className="lab lab-ch">channel spans both hubs</text>
        </svg>
      </div>

      {/* Visa stamp visual */}
      <div className="visa-card" style={{ marginTop: 40 }}>
        <div className="visa-card-header">
          <span className="pill ch">issued by Hub B</span>
          <span className="pill id">stamped onto alice@acme</span>
        </div>
        <div className="visa-card-body">
          <div className="visa-row">
            <div className="visa-key">visa.scope</div>
            <div className="visa-val">channels: <code>workflow.incident-*</code> · actions: <code>send, observe</code></div>
          </div>
          <div className="visa-row">
            <div className="visa-key">visa.issuer</div>
            <div className="visa-val"><code>partner.example</code></div>
          </div>
          <div className="visa-row">
            <div className="visa-key">visa.subject</div>
            <div className="visa-val">passport <code>01HQ8KZ7V3…</code> @ <code>acme.example</code></div>
          </div>
          <div className="visa-row">
            <div className="visa-key">visa.expires</div>
            <div className="visa-val">2026-05-11T16:00Z &nbsp;<span style={{ color: "var(--ink-mute)" }}>· revocable on push</span></div>
          </div>
          <div className="visa-row">
            <div className="visa-key">visa.signature</div>
            <div className="visa-val"><code>ed25519:b7e84a…</code></div>
          </div>
        </div>
      </div>

      <div className="meta-strip">
        <div>
          <div className="key">Identity</div>
          <div className="val">Passport · signed by the home hub</div>
        </div>
        <div>
          <div className="key">Entry</div>
          <div className="val">Visa · stamped by the destination hub, scoped + revocable</div>
        </div>
        <div>
          <div className="key">Discovery sync</div>
          <div className="val"><code>NetworkChangedFrame</code> · push&#8209;based, cached on the client</div>
        </div>
      </div>
    </section>
  );
}
