export function Landscape() {
  return (
    <section id="landscape" className="wide">
      <div className="marker">13 / Position</div>
      <h2>
        The missing layer in the <span className="ac-i">2026 stack</span>.
      </h2>
      <p className="lead">
        MCP became HTTP for tools. A2A became HTTP for agents. Both are resource&#8209;shaped.
        The layer between them and the agent framework above stays unclaimed.
      </p>

      <table className="land" style={{ marginTop: 24 }}>
        <thead>
          <tr>
            <th>Framework</th>
            <th>Primitive</th>
            <th>Shape</th>
            <th>State lives in</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="name">AutoGen / Agent Framework</td>
            <td>Actor + message</td>
            <td>Orchestration inside a runtime</td>
            <td>Runtime + Durable Workflow ext.</td>
          </tr>
          <tr>
            <td className="name">LangGraph</td>
            <td>Node + edge</td>
            <td>Graph inside a process</td>
            <td>StateGraph + Checkpointer</td>
          </tr>
          <tr>
            <td className="name">CrewAI</td>
            <td>Role + task</td>
            <td>Team inside a crew</td>
            <td>In&#8209;memory + Flows</td>
          </tr>
          <tr>
            <td className="name">OpenAI Agents SDK</td>
            <td>Agent + handoff</td>
            <td>Serial transfer inside a session</td>
            <td>Harness extension</td>
          </tr>
          <tr>
            <td className="name">Google ADK + A2A</td>
            <td>HTTP endpoint</td>
            <td>Wire format (resource shape)</td>
            <td>Per&#8209;task, server&#8209;side</td>
          </tr>
          <tr>
            <td className="name">MCP</td>
            <td>Tool + resource</td>
            <td>REST for capabilities</td>
            <td>None — stateless</td>
          </tr>
          <tr className="us">
            <td className="name">AG2 Network</td>
            <td>Durable channel</td>
            <td>Network of identity&#8209;bound actions</td>
            <td>Per&#8209;channel WAL · multi&#8209;hub</td>
          </tr>
        </tbody>
      </table>

      <div className="div-line" style={{ margin: "56px auto" }}></div>

      <h2 style={{ marginBottom: 28 }}>
        Four things that are <em>actually different.</em>
      </h2>

      <div className="diff-grid">
        {/* 1. Channel as primitive */}
        <div className="diff-card">
          <div className="diff-num">01</div>
          <svg viewBox="0 0 360 160" aria-hidden="true">
            <rect className="panel" x="20" y="50" width="80" height="50" rx="4" />
            <text x="60" y="74" textAnchor="middle" className="title" style={{ fontSize: 13 }}>agent A</text>
            <text x="60" y="92" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>stateless</text>

            <rect className="panel" x="260" y="50" width="80" height="50" rx="4" />
            <text x="300" y="74" textAnchor="middle" className="title" style={{ fontSize: 13 }}>agent B</text>
            <text x="300" y="92" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>stateless</text>

            {/* durable channel tube */}
            <rect x="100" y="56" width="160" height="38" rx="19" fill="var(--channel-pale)" stroke="var(--channel)" strokeWidth="1.5" />
            <text x="180" y="80" textAnchor="middle" className="lab lab-ch" style={{ fontSize: 11, fontWeight: 600 }}>CHANNEL</text>

            {/* WAL strip below */}
            <rect x="100" y="112" width="160" height="22" rx="3" fill="var(--action-pale)" stroke="var(--action)" />
            <text x="180" y="127" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 10 }}>WAL · append-only</text>
            <g fill="var(--action)">
              <rect x="112" y="116" width="2" height="14" />
              <rect x="124" y="116" width="2" height="14" />
              <rect x="136" y="116" width="2" height="14" />
              <rect x="148" y="116" width="2" height="14" />
              <rect x="222" y="116" width="2" height="14" />
              <rect x="234" y="116" width="2" height="14" />
              <rect x="246" y="116" width="2" height="14" />
            </g>
          </svg>
          <h3>Channel as primitive</h3>
          <p>
            Every other framework's unit is the agent, the graph, or the team. Ours is the
            durable, identity&#8209;scoped, protocol&#8209;typed conversation. The channel holds
            the state neither agent on either side can.
          </p>
        </div>

        {/* 2. Durability as substrate */}
        <div className="diff-card">
          <div className="diff-num">02</div>
          <svg viewBox="0 0 360 160" aria-hidden="true">
            {/* before crash */}
            <rect className="panel" x="10" y="20" width="100" height="40" rx="4" stroke="var(--channel)" />
            <text x="60" y="38" textAnchor="middle" className="title" style={{ fontSize: 11 }}>state X</text>
            <text x="60" y="52" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>in memory</text>

            {/* crash X */}
            <g transform="translate(125 30)">
              <line x1="0" y1="0" x2="20" y2="20" stroke="var(--violation)" strokeWidth="2.5" />
              <line x1="20" y1="0" x2="0" y2="20" stroke="var(--violation)" strokeWidth="2.5" />
            </g>
            <text x="135" y="68" textAnchor="middle" className="lab lab-vi" style={{ fontSize: 9, fontWeight: 600 }}>crash</text>

            {/* after restart */}
            <rect className="panel" x="160" y="20" width="100" height="40" rx="4" stroke="var(--channel)" />
            <text x="210" y="38" textAnchor="middle" className="title" style={{ fontSize: 11 }}>state X</text>
            <text x="210" y="52" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>identical</text>

            {/* re-fold arrow */}
            <text x="290" y="42" textAnchor="middle" className="lab lab-id" style={{ fontSize: 10 }}>re-fold</text>
            <text x="290" y="56" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>O(WAL)</text>

            {/* WAL underneath, spanning */}
            <rect x="10" y="90" width="320" height="36" rx="3" fill="var(--action-pale)" stroke="var(--action)" />
            <text x="170" y="113" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 11 }}>channel WAL · untouched by the crash</text>
            <g fill="var(--action)">
              <rect x="22" y="94" width="2" height="28" />
              <rect x="34" y="94" width="2" height="28" />
              <rect x="46" y="94" width="2" height="28" />
              <rect x="58" y="94" width="2" height="28" />
              <rect x="80" y="94" width="2" height="28" />
              <rect x="180" y="94" width="2" height="28" />
              <rect x="200" y="94" width="2" height="28" />
              <rect x="220" y="94" width="2" height="28" />
              <rect x="280" y="94" width="2" height="28" />
              <rect x="300" y="94" width="2" height="28" />
              <rect x="315" y="94" width="2" height="28" />
            </g>
            {/* arrows from WAL to states */}
            <path d="M 60 90 L 60 62" stroke="var(--action)" strokeDasharray="2 3" strokeWidth="0.9" />
            <path d="M 210 90 L 210 62" stroke="var(--action)" strokeDasharray="2 3" strokeWidth="0.9" />

            <text x="170" y="148" textAnchor="middle" className="lab lab-em" style={{ fontSize: 10 }}>
              state = fold(WAL) · deterministic
            </text>
          </svg>
          <h3>Durability as substrate</h3>
          <p>
            Everyone else bolts durability on. Here it&apos;s the floor. WAL is the truth; adapter
            state is a pure fold; a hub restart is a non&#8209;event. Long&#8209;running channels
            survive process moves, machine reboots, mid&#8209;flight handovers.
          </p>
        </div>

        {/* 3. Federation with visas */}
        <div className="diff-card">
          <div className="diff-num">03</div>
          <svg viewBox="0 0 360 160" aria-hidden="true">
            <rect className="panel" x="14" y="30" width="100" height="100" rx="6" stroke="var(--channel)" />
            <text x="64" y="50" textAnchor="middle" className="title" style={{ fontSize: 11 }}>Hub A</text>
            <text x="64" y="64" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>home</text>
            <circle className="node-ag" cx="64" cy="92" r="12" />
            <text x="64" y="96" textAnchor="middle" className="lab lab-em" style={{ fontSize: 9 }}>alice</text>

            <rect className="panel" x="246" y="30" width="100" height="100" rx="6" stroke="var(--identity)" />
            <text x="296" y="50" textAnchor="middle" className="title" style={{ fontSize: 11 }}>Hub B</text>
            <text x="296" y="64" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>destination</text>
            <circle className="node-ag" cx="296" cy="92" r="12" />
            <text x="296" y="96" textAnchor="middle" className="lab lab-em" style={{ fontSize: 9 }}>carol</text>

            {/* passport + visa traveling between */}
            <path className="id-line" d="M 114 80 L 246 80" strokeWidth="1.5" />
            <polygon points="244,76 252,80 244,84" fill="var(--identity)" />

            {/* passport card at midpoint */}
            <g transform="translate(150 64)">
              <rect width="60" height="32" rx="3" fill="var(--card)" stroke="var(--identity)" strokeWidth="1.2" />
              <line x1="0" y1="12" x2="60" y2="12" stroke="var(--identity)" strokeWidth="0.6" />
              <text x="4" y="9" style={{ fontSize: 5, fill: "var(--identity)", fontFamily: "var(--mono)" }}>PASSPORT</text>
              {/* visa stamp */}
              <circle cx="48" cy="22" r="8" fill="none" stroke="var(--channel)" strokeWidth="1.4" />
              <text x="48" y="25" textAnchor="middle" style={{ fontSize: 7, fill: "var(--channel)", fontFamily: "var(--mono)", fontWeight: 700 }}>V</text>
              <text x="20" y="20" style={{ fontSize: 5, fill: "var(--ink-mute)", fontFamily: "var(--mono)" }}>01HQ8K…</text>
              <text x="20" y="28" style={{ fontSize: 5, fill: "var(--ink-mute)", fontFamily: "var(--mono)" }}>signed</text>
            </g>

            <text x="180" y="120" textAnchor="middle" className="lab lab-em" style={{ fontSize: 10 }}>
              passport + visa
            </text>
            <text x="180" y="138" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>
              identity signed by A · entry stamped by B
            </text>
          </svg>
          <h3>Federation, with visas</h3>
          <p>
            Single&#8209;process frameworks can&apos;t span orgs. Wire protocols span them but
            with no native identity scoping. The Passport identifies; the Visa permits. Cross&#8209;org
            channels are the base case.
          </p>
        </div>

        {/* 4. Choreography spectrum */}
        <div className="diff-card">
          <div className="diff-num">04</div>
          <svg viewBox="0 0 360 160" aria-hidden="true">
            {/* axis */}
            <line x1="20" y1="60" x2="340" y2="60" className="ax" />
            <polygon points="338,56 348,60 338,64" fill="var(--ink-mute)" />
            <text x="20" y="44" className="lab lab-soft" style={{ fontSize: 10 }}>open</text>
            <text x="340" y="44" textAnchor="end" className="lab lab-soft" style={{ fontSize: 10 }}>strict</text>

            {/* 4 markers */}
            <line x1="60" y1="54" x2="60" y2="66" stroke="var(--action)" strokeWidth="1.5" />
            <line x1="140" y1="54" x2="140" y2="66" stroke="var(--channel)" strokeWidth="1.5" />
            <line x1="220" y1="54" x2="220" y2="66" stroke="var(--identity)" strokeWidth="1.5" />
            <line x1="300" y1="54" x2="300" y2="66" stroke="var(--violation)" strokeWidth="1.5" />

            <text x="60" y="86" textAnchor="middle" className="title" style={{ fontSize: 11 }}>dynamic</text>
            <text x="140" y="86" textAnchor="middle" className="title" style={{ fontSize: 11 }}>round-robin</text>
            <text x="220" y="86" textAnchor="middle" className="title" style={{ fontSize: 11 }}>static</text>
            <text x="300" y="86" textAnchor="middle" className="title" style={{ fontSize: 11 }}>workflow</text>

            <text x="60" y="102" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>anyone</text>
            <text x="140" y="102" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>rotation</text>
            <text x="220" y="102" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>pipeline</text>
            <text x="300" y="102" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>graph</text>

            {/* expectations bound */}
            <line x1="20" y1="120" x2="340" y2="120" stroke="var(--violation)" strokeDasharray="4 4" />
            <text x="180" y="138" textAnchor="middle" className="lab lab-vi" style={{ fontSize: 10 }}>
              expectations bound every mode
            </text>
            <text x="180" y="152" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>
              audit · warn · notify · hide · remove · auto_close
            </text>
          </svg>
          <h3>Choreography you dial in</h3>
          <p>
            Other frameworks pick one — pure handoff, fixed graph, role play. We span the full
            range as one primitive. Same channel, same fold, same durability. Pick the level of
            control per task.
          </p>
        </div>
      </div>

      <div className="meta-strip" style={{ marginTop: 56 }}>
        <div>
          <div className="key">+ Identity</div>
          <div className="val">Passport + Resume + SKILL.md · ranked by observed outcomes</div>
        </div>
        <div>
          <div className="key">+ Trust boundary</div>
          <div className="val">Hub never imports tenant code · same surface in&#8209;process and on the wire</div>
        </div>
        <div>
          <div className="key">+ Omni&#8209;modal</div>
          <div className="val">Text, audio, image, video — one fan&#8209;out, demuxed per recipient</div>
        </div>
      </div>

      <div className="div-line" style={{ margin: "56px auto" }}></div>

      <h2>The window.</h2>
      <p className="lead" style={{ maxWidth: "52ch" }}>
        2026 is when multi&#8209;agent stops being a demo and starts being deployed. The question is
        what they&apos;re deployed on top of.
      </p>
      <p style={{ maxWidth: "62ch" }}>
        The frameworks above are mature enough that orchestration metaphors are settled. The protocols
        below are mature enough that wire&#8209;level interop is no longer in dispute. What&apos;s
        open is the layer in between — drawn intentionally, not accidentally.
      </p>
    </section>
  );
}
