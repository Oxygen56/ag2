export function Hero() {
  return (
    <section id="top" className="hero wide">
      <div className="hero-tagline">AG2 / Beta · The framework for autonomous agents</div>
      <h1 className="display">
        Build agents.<br />
        <em>Network them.</em>
      </h1>
      <p className="hero-sub">
        A harness that keeps a single agent coherent for hours of real work. A
        network that connects agents across machines and organisations. Designed together.
      </p>
      <div className="hero-byline">
        <span>Composable harness</span>
        <span>Bounded coherent memory</span>
        <span>Durable channels</span>
        <span>Multi&#8209;hub federation</span>
      </div>

      <svg className="hero-vis" viewBox="0 0 760 540" aria-hidden="true">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1F5F6E" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1F5F6E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="320" cy="240" r="220" fill="url(#glow)" />
        <circle cx="560" cy="380" r="160" fill="url(#glow)" opacity="0.7" />

        <path className="ch-line flow" d="M 140 130 Q 320 60 510 170" />
        <path className="ch-line flow slow" d="M 510 170 Q 600 270 580 380" />
        <path className="ch-line flow" d="M 140 130 Q 230 280 280 410" />
        <path className="ch-line flow slow" d="M 280 410 Q 430 430 580 380" />
        <path className="id-line flow fast" d="M 510 170 Q 380 240 280 410" strokeOpacity="0.6" />
        <path className="ch-line-soft" d="M 140 130 Q 380 240 580 380" strokeOpacity="0.4" />
        <path className="act-line flow slow" d="M 660 110 Q 600 230 580 380" strokeOpacity="0.7" />

        <g>
          <circle className="node-ag" cx="140" cy="130" r="22" />
          <text x="140" y="134" textAnchor="middle" className="lab lab-em">alice</text>
          <text x="140" y="170" textAnchor="middle" className="lab lab-soft">agent</text>
        </g>
        <g>
          <circle className="node-ag" cx="510" cy="170" r="22" />
          <text x="510" y="174" textAnchor="middle" className="lab lab-em">bob</text>
          <text x="510" y="210" textAnchor="middle" className="lab lab-soft">agent</text>
        </g>
        <g>
          <circle className="node-hu" cx="280" cy="410" r="22" />
          <text x="280" y="414" textAnchor="middle" className="lab lab-em">human</text>
          <text x="280" y="450" textAnchor="middle" className="lab lab-soft">on-call</text>
        </g>
        <g>
          <circle className="node-ag" cx="580" cy="380" r="22" />
          <text x="580" y="384" textAnchor="middle" className="lab lab-em">carol</text>
          <text x="580" y="420" textAnchor="middle" className="lab lab-soft">agent</text>
        </g>
        <g>
          <circle className="node-hub" cx="660" cy="110" r="18" />
          <text x="660" y="115" textAnchor="middle" className="lab lab-ch">hub</text>
          <text x="660" y="148" textAnchor="middle" className="lab lab-soft">partner&nbsp;org</text>
        </g>
      </svg>
    </section>
  );
}
