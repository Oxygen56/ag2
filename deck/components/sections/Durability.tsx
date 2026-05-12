export function Durability() {
  return (
    <section id="durability" className="wide">
      <div className="marker">07 / Durability</div>
      <h2>
        What survives, <em>survives exactly.</em>
      </h2>
      <p className="lead">
        Append&#8209;only WAL. Adapter state is a pure fold. Crash the hub, re&#8209;fold from disk, and
        the channel is exactly where it was — to the envelope.
      </p>

      <div className="grid-2 wider" style={{ marginTop: 32 }}>
        <div>
          <h4>The substrate, not a feature</h4>
          <p>
            Other frameworks treat durability as an opt&#8209;in extension. AG2 Network inverts the
            default — durability <em className="term">is</em> the substrate.
          </p>
          <h4 style={{ marginTop: 22 }}>Exactly means exactly</h4>
          <p>
            Adapter state is <code>fold(env<sub>n</sub>, … fold(env<sub>1</sub>, initial))</code>. Same
            WAL on disk, same state in memory, every time. A hub restart is a non&#8209;event for the
            channels it hosts.
          </p>
          <h4 style={{ marginTop: 22 }}>Even orchestration is data</h4>
          <p>
            Workflow graphs are JSON snapshotted into the manifest. Tasks have their own durable event
            stream plus opt&#8209;in <code>checkpoint(state)</code>. No Python travels the wire.
          </p>
        </div>

        <svg viewBox="0 0 540 380" aria-hidden="true">
          <line x1="20" y1="180" x2="520" y2="180" stroke="var(--identity)" strokeDasharray="6 6" />
          <text x="510" y="172" textAnchor="end" className="lab lab-id" style={{ fontSize: 11 }}>
            volatile · process memory
          </text>
          <text x="510" y="198" textAnchor="end" className="lab lab-id" style={{ fontSize: 11 }}>
            durable · written to store
          </text>

          <rect className="panel" x="40" y="50" width="200" height="50" rx="4" />
          <text x="140" y="74" textAnchor="middle" className="title">AdapterState</text>
          <text x="140" y="90" textAnchor="middle" className="lab lab-soft">folded projection · O(1)</text>

          <rect className="panel" x="260" y="50" width="220" height="50" rx="4" />
          <text x="370" y="74" textAnchor="middle" className="title">connections + caches</text>
          <text x="370" y="90" textAnchor="middle" className="lab lab-soft">rebuilt on hydrate</text>

          <rect className="panel" x="40" y="218" width="220" height="50" rx="4" stroke="var(--action)" />
          <text x="150" y="242" textAnchor="middle" className="title">channel WAL</text>
          <text x="150" y="258" textAnchor="middle" className="lab lab-soft">append&#8209;only · per&#8209;channel</text>

          <rect className="panel" x="280" y="218" width="200" height="50" rx="4" stroke="var(--action)" />
          <text x="380" y="242" textAnchor="middle" className="title">manifest + graph</text>
          <text x="380" y="258" textAnchor="middle" className="lab lab-soft">JSON · adapter dispatch</text>

          <rect className="panel" x="40" y="288" width="220" height="50" rx="4" stroke="var(--action)" />
          <text x="150" y="312" textAnchor="middle" className="title">passports + resumes</text>
          <text x="150" y="328" textAnchor="middle" className="lab lab-soft">identity · observed stats</text>

          <rect className="panel" x="280" y="288" width="200" height="50" rx="4" stroke="var(--action)" />
          <text x="380" y="312" textAnchor="middle" className="title">task events + checkpoint</text>
          <text x="380" y="328" textAnchor="middle" className="lab lab-soft">opt&#8209;in restart recovery</text>

          <path d="M 150 218 Q 50 180 70 100" stroke="var(--channel)" strokeDasharray="3 4" fill="none" />
          <polygon points="66,104 72,96 76,104" fill="var(--channel)" />
          <text x="20" y="150" className="lab lab-ch" style={{ fontSize: 11 }}>re&#8209;fold</text>
          <text x="20" y="166" className="lab lab-soft" style={{ fontSize: 10 }}>on hydrate</text>
        </svg>
      </div>

      <div style={{ marginTop: 48 }}>
        <h3 style={{ fontSize: 22, marginBottom: 14 }}>A hub restart, end to end.</h3>
        <svg viewBox="0 0 1180 240" aria-hidden="true" style={{ width: "100%", height: "auto" }}>
          <line x1="40" y1="50" x2="1140" y2="50" className="ax" />
          <text x="40" y="34" className="lab lab-soft">t</text>
          <text x="350" y="34" textAnchor="middle" className="lab lab-vi">— crash —</text>
          <text x="610" y="34" textAnchor="middle" className="lab lab-ac">— restart —</text>
          <text x="900" y="34" textAnchor="middle" className="lab lab-ch">— resume —</text>

          <line x1="350" y1="42" x2="350" y2="220" stroke="var(--violation)" strokeDasharray="3 3" />
          <line x1="610" y1="42" x2="610" y2="220" stroke="var(--action)" strokeDasharray="3 3" />

          <text x="34" y="90" textAnchor="end" className="lab lab-em" style={{ fontSize: 11 }}>hub process</text>
          <text x="34" y="140" textAnchor="end" className="lab lab-em" style={{ fontSize: 11 }}>channel WAL</text>
          <text x="34" y="190" textAnchor="end" className="lab lab-em" style={{ fontSize: 11 }}>adapter state</text>

          <rect x="60" y="70" width="290" height="40" rx="4" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="205" y="94" className="lab lab-ac" textAnchor="middle">running · accepting envelopes</text>
          <rect x="610" y="70" width="530" height="40" rx="4" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="875" y="94" className="lab lab-ac" textAnchor="middle">running · channel continues</text>
          <text x="480" y="94" className="lab lab-vi" textAnchor="middle">— dead —</text>

          <rect x="60" y="120" width="1080" height="40" rx="4" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="600" y="144" className="lab lab-ac" textAnchor="middle">on disk · untouched · authoritative</text>
          <g fill="var(--action)">
            <rect x="80" y="128" width="3" height="24" />
            <rect x="130" y="128" width="3" height="24" />
            <rect x="180" y="128" width="3" height="24" />
            <rect x="230" y="128" width="3" height="24" />
            <rect x="280" y="128" width="3" height="24" />
            <rect x="320" y="128" width="3" height="24" />
            <rect x="650" y="128" width="3" height="24" />
            <rect x="700" y="128" width="3" height="24" />
            <rect x="760" y="128" width="3" height="24" />
            <rect x="820" y="128" width="3" height="24" />
            <rect x="880" y="128" width="3" height="24" />
            <rect x="950" y="128" width="3" height="24" />
            <rect x="1010" y="128" width="3" height="24" />
            <rect x="1080" y="128" width="3" height="24" />
          </g>

          <rect x="60" y="170" width="290" height="40" rx="4" fill="var(--channel-pale)" stroke="var(--channel)" />
          <text x="205" y="194" className="lab lab-ch" textAnchor="middle">folded forward · O(1)</text>
          <text x="480" y="194" className="lab lab-vi" textAnchor="middle">— gone —</text>
          <rect x="610" y="170" width="110" height="40" rx="4" fill="var(--identity-pale)" stroke="var(--identity)" />
          <text x="665" y="194" className="lab lab-id" textAnchor="middle">re&#8209;fold</text>
          <rect x="730" y="170" width="410" height="40" rx="4" fill="var(--channel-pale)" stroke="var(--channel)" />
          <text x="935" y="194" className="lab lab-ch" textAnchor="middle">identical state, byte&#8209;for&#8209;byte</text>
        </svg>
      </div>

      <div className="meta-strip">
        <div>
          <div className="key">Channel WAL</div>
          <div className="val">Append&#8209;only · per&#8209;channel · the source of truth</div>
        </div>
        <div>
          <div className="key">Adapter state</div>
          <div className="val">Pure fold of WAL · always rebuildable</div>
        </div>
        <div>
          <div className="key">Reconnect</div>
          <div className="val">Inbox cursor replays unacked · causation index dedups</div>
        </div>
      </div>
    </section>
  );
}
