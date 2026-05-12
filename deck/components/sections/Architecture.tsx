export function Architecture() {
  return (
    <section id="architecture" className="wide">
      <div className="marker">04 / Network architecture</div>
      <h2>
        Action&#8209;driven networking, drawn <em>intentionally.</em>
      </h2>
      <p className="lead" style={{ maxWidth: "52ch" }}>
        A network where the channel between agents holds the state — durable, identity&#8209;scoped,
        choreographed — with the hub as a router that never holds tenant logic.
      </p>

      <div className="arch-diagram">
        <svg viewBox="0 0 1200 560" aria-hidden="true">
          {/* tenant process A boundary */}
          <rect
            x="40"
            y="40"
            width="340"
            height="320"
            rx="6"
            fill="var(--card)"
            stroke="var(--line)"
            strokeDasharray="6 4"
          />
          <text x="60" y="66" className="lab lab-soft" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
            TENANT PROCESS · A
          </text>
          {/* agents */}
          <circle className="node-ag" cx="120" cy="150" r="22" />
          <text x="120" y="154" textAnchor="middle" className="lab lab-em">alice</text>
          <text x="120" y="186" textAnchor="middle" className="lab lab-soft">agent</text>
          <circle className="node-ag" cx="220" cy="150" r="22" />
          <text x="220" y="154" textAnchor="middle" className="lab lab-em">bob</text>
          <text x="220" y="186" textAnchor="middle" className="lab lab-soft">agent</text>
          <circle className="node-hu" cx="320" cy="150" r="22" />
          <text x="320" y="154" textAnchor="middle" className="lab lab-em">jana</text>
          <text x="320" y="186" textAnchor="middle" className="lab lab-soft">human</text>
          {/* clients */}
          <rect x="80" y="230" width="260" height="50" rx="4" className="panel" />
          <text x="210" y="252" textAnchor="middle" className="title" style={{ fontSize: 13 }}>
            AgentClient · AgentClient · HumanClient
          </text>
          <text x="210" y="270" textAnchor="middle" className="lab lab-soft">
            trust boundary · runs tenant code
          </text>
          {/* hub client */}
          <rect x="120" y="295" width="180" height="40" rx="4" className="panel" />
          <text x="210" y="318" textAnchor="middle" className="title" style={{ fontSize: 13 }}>
            HubClient
          </text>

          {/* trust boundary marker */}
          <line x1="380" y1="180" x2="450" y2="180" stroke="var(--violation)" strokeDasharray="4 4" />
          <text x="415" y="172" textAnchor="middle" className="lab" style={{ fill: "var(--violation)", fontSize: 10 }}>
            trust
          </text>
          <text x="415" y="196" textAnchor="middle" className="lab" style={{ fill: "var(--violation)", fontSize: 10 }}>
            boundary
          </text>

          {/* HUB — center */}
          <rect x="450" y="80" width="300" height="280" rx="6" fill="var(--channel-pale)" stroke="var(--channel)" />
          <text x="600" y="106" textAnchor="middle" className="title" style={{ fontSize: 15, fill: "var(--channel)" }}>
            HUB · router
          </text>
          <text x="600" y="124" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 11 }}>
            never imports tenant code
          </text>
          {/* hub internals (chips) */}
          <rect x="470" y="142" width="120" height="32" rx="3" fill="var(--card)" stroke="var(--channel-soft)" />
          <text x="530" y="161" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            registry
          </text>
          <rect x="610" y="142" width="120" height="32" rx="3" fill="var(--card)" stroke="var(--channel-soft)" />
          <text x="670" y="161" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            dispatch
          </text>
          <rect x="470" y="184" width="120" height="32" rx="3" fill="var(--card)" stroke="var(--channel-soft)" />
          <text x="530" y="203" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            adapter state
          </text>
          <rect x="610" y="184" width="120" height="32" rx="3" fill="var(--card)" stroke="var(--channel-soft)" />
          <text x="670" y="203" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            arbiter
          </text>
          <rect x="470" y="226" width="120" height="32" rx="3" fill="var(--card)" stroke="var(--channel-soft)" />
          <text x="530" y="245" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            sweepers
          </text>
          <rect x="610" y="226" width="120" height="32" rx="3" fill="var(--card)" stroke="var(--channel-soft)" />
          <text x="670" y="245" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            audit
          </text>

          {/* channels label */}
          <line x1="470" y1="280" x2="730" y2="280" stroke="var(--channel-soft)" strokeDasharray="3 3" />
          <text x="600" y="300" textAnchor="middle" className="lab lab-ch" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
            CHANNELS · the unit of action
          </text>
          {/* channel pills */}
          <rect x="468" y="312" width="86" height="22" rx="11" fill="var(--card)" stroke="var(--identity)" strokeWidth="1" />
          <text x="511" y="327" textAnchor="middle" className="lab lab-id" style={{ fontSize: 10 }}>
            consulting
          </text>
          <rect x="558" y="312" width="80" height="22" rx="11" fill="var(--card)" stroke="var(--action)" strokeWidth="1" />
          <text x="598" y="327" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 10 }}>
            discussion
          </text>
          <rect x="642" y="312" width="76" height="22" rx="11" fill="var(--card)" stroke="var(--channel)" strokeWidth="1" />
          <text x="680" y="327" textAnchor="middle" className="lab lab-ch" style={{ fontSize: 10 }}>
            workflow
          </text>

          {/* tenant process B */}
          <rect
            x="820"
            y="40"
            width="340"
            height="180"
            rx="6"
            fill="var(--card)"
            stroke="var(--line)"
            strokeDasharray="6 4"
          />
          <text x="840" y="66" className="lab lab-soft" style={{ fontSize: 11, letterSpacing: "0.1em" }}>
            TENANT PROCESS · B
          </text>
          <circle className="node-ag" cx="900" cy="140" r="22" />
          <text x="900" y="144" textAnchor="middle" className="lab lab-em">carol</text>
          <circle className="node-ag" cx="990" cy="140" r="22" />
          <text x="990" y="144" textAnchor="middle" className="lab lab-em">dave</text>
          <rect x="860" y="180" width="180" height="28" rx="3" fill="var(--card-2)" stroke="var(--line)" />
          <text x="950" y="198" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 11 }}>
            HubClient
          </text>

          {/* federation hub */}
          <rect x="820" y="240" width="340" height="120" rx="6" fill="var(--identity-pale)" stroke="var(--identity)" strokeDasharray="6 4" />
          <text x="840" y="266" className="lab lab-id" style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 600 }}>
            FEDERATED HUB · partner org
          </text>
          <rect x="840" y="280" width="300" height="60" rx="4" fill="var(--card)" stroke="var(--identity-soft)" />
          <text x="990" y="306" textAnchor="middle" className="title" style={{ fontSize: 13, fill: "var(--identity)" }}>
            Hub · signed identity bridge
          </text>
          <text x="990" y="324" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 11 }}>
            cross&#8209;org channel via signed passport
          </text>

          {/* durable store — bottom */}
          <rect x="40" y="400" width="1120" height="120" rx="6" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="60" y="426" className="lab lab-ac" style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 600 }}>
            DURABLE STORE
          </text>
          <rect x="80" y="442" width="180" height="60" rx="4" fill="var(--card)" stroke="var(--action-soft)" />
          <text x="170" y="465" textAnchor="middle" className="title" style={{ fontSize: 13 }}>channel WAL</text>
          <text x="170" y="485" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>append&#8209;only · per channel</text>

          <rect x="280" y="442" width="180" height="60" rx="4" fill="var(--card)" stroke="var(--action-soft)" />
          <text x="370" y="465" textAnchor="middle" className="title" style={{ fontSize: 13 }}>manifests + graphs</text>
          <text x="370" y="485" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>JSON · adapter dispatch</text>

          <rect x="480" y="442" width="180" height="60" rx="4" fill="var(--card)" stroke="var(--action-soft)" />
          <text x="570" y="465" textAnchor="middle" className="title" style={{ fontSize: 13 }}>passports + resumes</text>
          <text x="570" y="485" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>identity · observed stats</text>

          <rect x="680" y="442" width="180" height="60" rx="4" fill="var(--card)" stroke="var(--action-soft)" />
          <text x="770" y="465" textAnchor="middle" className="title" style={{ fontSize: 13 }}>task events</text>
          <text x="770" y="485" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>per&#8209;task stream + checkpoint</text>

          <rect x="880" y="442" width="180" height="60" rx="4" fill="var(--card)" stroke="var(--action-soft)" />
          <text x="970" y="465" textAnchor="middle" className="title" style={{ fontSize: 13 }}>audit log</text>
          <text x="970" y="485" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>hub&#8209;cross&#8209;cutting events</text>

          {/* connection lines from tenants to hub */}
          <path d="M 210 335 Q 280 360 380 280 L 450 230" stroke="var(--channel)" strokeWidth="1.2" fill="none" className="flow" />
          <path d="M 950 208 Q 900 230 800 230 L 750 220" stroke="var(--channel)" strokeWidth="1.2" fill="none" className="flow slow" />
          <path d="M 750 310 Q 800 320 840 310" stroke="var(--identity)" strokeWidth="1.5" fill="none" className="flow" />

          {/* lines from hub to durable store */}
          <line x1="600" y1="360" x2="600" y2="400" stroke="var(--action)" strokeWidth="1" strokeDasharray="3 3" />
          <polygon points="595,400 605,400 600,408" fill="var(--action)" />
        </svg>
      </div>

      <h3 style={{ marginTop: 48, fontSize: 24 }}>How the architecture answers the mismatch.</h3>
      <div className="arch-callouts">
        <div className="callout">
          <div className="callout-bind">
            <span className="pill ch">channel as unit</span>
            <span className="callout-arrow">↔</span>
            <span className="callout-fix">addresses: agents are stateless</span>
          </div>
          <p>
            The durable, identity&#8209;scoped channel holds the state that neither agent on either side
            can. Open it, work inside it, close it — the channel is the artifact.
          </p>
        </div>
        <div className="callout">
          <div className="callout-bind">
            <span className="pill ac">stateless adapter + WAL</span>
            <span className="callout-arrow">↔</span>
            <span className="callout-fix">addresses: orchestrator state doesn&apos;t scale</span>
          </div>
          <p>
            Every decision is a pure fold of the append&#8209;only log. Hub holds no choreography of its
            own — it can crash, restart, or move machines without losing where the channel was.
          </p>
        </div>
        <div className="callout">
          <div className="callout-bind">
            <span className="pill id">signed identity</span>
            <span className="callout-arrow">↔</span>
            <span className="callout-fix">addresses: per&#8209;call tokens carry no track record</span>
          </div>
          <p>
            Passport &middot; Resume &middot; SKILL.md. Cryptographically signed, observed by the hub,
            ranked by outcomes. Discovery improves with use.
          </p>
        </div>
        <div className="callout">
          <div className="callout-bind">
            <span className="pill vi">trust boundary in client</span>
            <span className="callout-arrow">↔</span>
            <span className="callout-fix">addresses: tenant code can&apos;t run inside the wire</span>
          </div>
          <p>
            Hub never imports tenant Python, never calls <code>Agent.ask</code>. Same surface in&#8209;process
            and over a wire — by construction. Federation is a deployment shape, not a redesign.
          </p>
        </div>
        <div className="callout">
          <div className="callout-bind">
            <span className="pill ch">hub = router</span>
            <span className="callout-arrow">↔</span>
            <span className="callout-fix">addresses: orchestrators are bottlenecks</span>
          </div>
          <p>
            No single point of decision&#8209;making. Choreography lives in adapters; adapters live in
            registries; registries live on both ends. The hub just routes and audits.
          </p>
        </div>
        <div className="callout">
          <div className="callout-bind">
            <span className="pill id">multi&#8209;hub native</span>
            <span className="callout-arrow">↔</span>
            <span className="callout-fix">addresses: single&#8209;process frameworks can&apos;t span orgs</span>
          </div>
          <p>
            A channel can span two hubs the same way a TCP connection can span two networks. Signed
            passports cross the gap; routing tables propagate.
          </p>
        </div>
      </div>

      <p className="note" style={{ marginTop: 36 }}>
        <em>The one&#8209;line positioning.</em> MCP is HTTP for tools. A2A is HTTP for agents.
        AG2&nbsp;Network is TCP for actions — the layer where stateful, identity&#8209;bound,
        choreographed interaction lives, sitting next to the resource&#8209;driven internet rather
        than replacing it.
      </p>
    </section>
  );
}
