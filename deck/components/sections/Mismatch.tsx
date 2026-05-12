export function Mismatch() {
  return (
    <section id="mismatch" className="wide">
      <div className="marker">03 / From one agent to many</div>
      <h2>
        One coherent agent isn&apos;t <span className="ac-i">enough.</span>
      </h2>
      <p className="lead" style={{ maxWidth: "58ch" }}>
        Real work involves teams. Specialists. Humans. Across machines, devices, organisations.
        And the internet wasn&apos;t drawn for that either — it was drawn for stateful brains
        hitting stateless services.
      </p>

      <div className="mismatch-grid">
        <div className="mismatch-panel">
          <div className="mismatch-head">
            <span className="pill ch">resource&#8209;shaped</span>
            <h3>Stateless requests, stateful clients.</h3>
          </div>
          <svg viewBox="0 0 480 240" aria-hidden="true">
            <rect className="panel" x="40" y="100" width="120" height="60" rx="4" />
            <text x="100" y="130" textAnchor="middle" className="title">client</text>
            <text x="100" y="148" textAnchor="middle" className="lab lab-soft">holds state</text>

            <rect className="panel" x="320" y="100" width="120" height="60" rx="4" />
            <text x="380" y="130" textAnchor="middle" className="title">server</text>
            <text x="380" y="148" textAnchor="middle" className="lab lab-soft">resource</text>

            <path className="ch-line" d="M 160 122 L 315 122" />
            <polygon points="315,117 325,122 315,127" fill="var(--channel)" />
            <text x="237" y="112" textAnchor="middle" className="lab lab-ch">GET /thing</text>

            <path className="ch-line" d="M 320 142 L 165 142" />
            <polygon points="165,137 155,142 165,147" fill="var(--channel)" />
            <text x="237" y="160" textAnchor="middle" className="lab lab-ch">200 OK · &#123;…&#125;</text>

            <text x="100" y="200" textAnchor="middle" className="lab lab-soft">remembers · decides next call</text>
            <text x="380" y="200" textAnchor="middle" className="lab lab-soft">idempotent · replicable</text>
          </svg>
          <p>
            HTTP, REST, MCP, A2A. Works because the client has memory in its head — or its harness.
            One agent on its own talking to tools? Fine.
          </p>
        </div>

        <div className="mismatch-divider" aria-hidden="true">
          <span>vs</span>
        </div>

        <div className="mismatch-panel">
          <div className="mismatch-head">
            <span className="pill id">what agents need</span>
            <h3>Stateful channels, identity&#8209;bound action.</h3>
          </div>
          <svg viewBox="0 0 480 240" aria-hidden="true">
            <rect className="panel" x="40" y="100" width="100" height="60" rx="4" />
            <text x="90" y="130" textAnchor="middle" className="title">agent A</text>
            <text x="90" y="148" textAnchor="middle" className="lab lab-soft">stateless</text>

            <rect className="panel" x="340" y="100" width="100" height="60" rx="4" />
            <text x="390" y="130" textAnchor="middle" className="title">agent B</text>
            <text x="390" y="148" textAnchor="middle" className="lab lab-soft">stateless</text>

            <rect x="140" y="92" width="200" height="76" rx="4" fill="var(--channel-pale)" stroke="var(--channel)" strokeDasharray="4 4" />
            <text x="240" y="118" textAnchor="middle" className="title" style={{ fill: "var(--channel)" }}>channel</text>
            <text x="240" y="138" textAnchor="middle" className="lab lab-ch">durable · choreographed</text>
            <text x="240" y="156" textAnchor="middle" className="lab lab-ch">identity&#8209;bound · auditable</text>

            <text x="90" y="200" textAnchor="middle" className="lab lab-soft">acts inside the channel</text>
            <text x="390" y="200" textAnchor="middle" className="lab lab-soft">acts inside the channel</text>
          </svg>
          <p>
            Both ends stateless. State has to live somewhere. The harness above each agent doesn&apos;t
            scale across processes. The natural home is the channel itself.
          </p>
        </div>
      </div>

      <div className="meta-strip" style={{ marginTop: 36 }}>
        <div>
          <div className="key">Single agent</div>
          <div className="val">Harness holds the state · resource&#8209;shaped calls work</div>
        </div>
        <div>
          <div className="key">Many agents</div>
          <div className="val">No shared harness · state needs a new home</div>
        </div>
        <div>
          <div className="key">The answer</div>
          <div className="val">A network where the channel holds it for them</div>
        </div>
      </div>
    </section>
  );
}
