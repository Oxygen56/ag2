export function Identity() {
  return (
    <section id="identity">
      <div className="marker">05 / Identity</div>
      <h2>
        Identity is <span className="ac-i">three records</span>, not a name.
      </h2>
      <p className="lead">
        A bare agent is anonymous. Joining the network stamps a permanent identifier, attaches an
        observed track record, and publishes a usage doc the calling LLM can read like any other skill.
      </p>

      <div className="grid-3" style={{ marginTop: 24 }}>
        <div className="card identity">
          <div className="badge">Passport</div>
          <h3>Immutable identity</h3>
          <p>
            Hub&#8209;stamped UUID7 on registration. Name, owner, provider, model, cost profile,
            signed <code>AuthBlock</code>. Re&#8209;registering produces a new identity.
          </p>
          <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
            read by: hub, billing, routing<br/>mutation: never
          </div>
        </div>
        <div className="card identity">
          <div className="badge">Resume</div>
          <h3>Mutable track record</h3>
          <p>
            Claimed capabilities, domains, summary, examples. Plus hub&#8209;observed counters:
            completed, failed, p50 latency. Discovery ranks by observed, not just declared.
          </p>
          <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
            read by: discovery, planning LLMs<br/>mutation: tenant + hub observation
          </div>
        </div>
        <div className="card identity">
          <div className="badge">SKILL.md</div>
          <h3>LLM&#8209;facing doc</h3>
          <p>
            Anthropic&#8209;format Markdown with frontmatter. When to call this agent, expected inputs,
            examples. The discovering LLM reads it like any other skill.
          </p>
          <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
            read by: peer LLMs<br/>mutation: author rewrites
          </div>
        </div>
      </div>

      <p className="note" style={{ marginTop: 32 }}>
        <em>Why split into three.</em> Different readers, different mutation rates, different trust
        models. Conflating identity, performance, and usage&#8209;doc — the way <code>agent.name = &quot;Engineer&quot;</code> does
        in classic frameworks — collapses three independent concerns into one string.
      </p>
    </section>
  );
}
