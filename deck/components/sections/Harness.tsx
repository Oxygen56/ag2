export function Harness() {
  return (
    <section id="harness" className="wide">
      <div className="marker">01 / The harness</div>
      <h2>
        An agent is <em>more than a loop.</em>
      </h2>
      <p className="lead" style={{ maxWidth: "56ch" }}>
        Reliable agents need bounded context, composable middleware, observers, structured output,
        human input. Naive loops grow fragile fast. AG2 ships the primitives that wrap an LLM call
        into a real runtime.
      </p>

      <div className="harness-diagram">
        <svg viewBox="0 0 1200 540" aria-hidden="true">
          {/* outer bounding label: one turn */}
          <text x="20" y="40" className="lab lab-soft" style={{ fontSize: 11, letterSpacing: "0.14em" }}>
            ONE TURN · agent.ask(input, tools, …)
          </text>
          <rect
            x="20"
            y="50"
            width="1160"
            height="180"
            rx="6"
            fill="var(--card)"
            stroke="var(--line)"
            strokeDasharray="6 4"
          />

          {/* turn pipeline: ASSEMBLY → MIDDLEWARE → LLM CLIENT ↔ TOOLS */}
          {/* assembly */}
          <rect x="60" y="100" width="200" height="80" rx="4" fill="var(--channel-pale)" stroke="var(--channel)" />
          <text x="160" y="128" textAnchor="middle" className="title" style={{ fontSize: 14, fill: "var(--channel)" }}>
            ASSEMBLY
          </text>
          <text x="160" y="146" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            build prompt from events
          </text>
          <text x="160" y="160" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            + injected memory
          </text>

          {/* arrow */}
          <line x1="260" y1="140" x2="295" y2="140" stroke="var(--ink-mute)" strokeWidth="1.5" />
          <polygon points="293,135 303,140 293,145" fill="var(--ink-mute)" />

          {/* middleware */}
          <rect x="305" y="100" width="220" height="80" rx="4" fill="var(--card)" stroke="var(--ink-soft)" strokeWidth="1.2" />
          <text x="415" y="128" textAnchor="middle" className="title" style={{ fontSize: 14 }}>
            MIDDLEWARE
          </text>
          <text x="415" y="146" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            logging · retry · token-limit
          </text>
          <text x="415" y="160" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            history-limit · custom
          </text>

          {/* arrow */}
          <line x1="525" y1="140" x2="560" y2="140" stroke="var(--ink-mute)" strokeWidth="1.5" />
          <polygon points="558,135 568,140 558,145" fill="var(--ink-mute)" />

          {/* LLM client */}
          <rect x="570" y="100" width="200" height="80" rx="4" fill="var(--identity-pale)" stroke="var(--identity)" />
          <text x="670" y="128" textAnchor="middle" className="title" style={{ fontSize: 14, fill: "var(--identity)" }}>
            LLM CLIENT
          </text>
          <text x="670" y="146" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            anthropic · openai · gemini
          </text>
          <text x="670" y="160" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            provider-neutral
          </text>

          {/* arrow back-and-forth to tools */}
          <line x1="770" y1="130" x2="810" y2="130" stroke="var(--action)" strokeWidth="1.5" />
          <polygon points="808,125 818,130 808,135" fill="var(--action)" />
          <line x1="810" y1="150" x2="770" y2="150" stroke="var(--action)" strokeWidth="1.5" />
          <polygon points="772,145 762,150 772,155" fill="var(--action)" />

          {/* tools */}
          <rect x="820" y="100" width="200" height="80" rx="4" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="920" y="128" textAnchor="middle" className="title" style={{ fontSize: 14, fill: "var(--action)" }}>
            TOOLS
          </text>
          <text x="920" y="146" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            @tool · subagents · DI
          </text>
          <text x="920" y="160" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            Inject + Variable
          </text>

          {/* "result" pointer back to caller (going off-right) */}
          <line x1="1020" y1="140" x2="1080" y2="140" stroke="var(--ink-mute)" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="1090" y="138" className="lab lab-soft" style={{ fontSize: 10 }}>reply</text>

          {/* arrow from pipeline DOWN to stream */}
          <line x1="600" y1="190" x2="600" y2="248" stroke="var(--ink-mute)" strokeWidth="1.2" strokeDasharray="3 3" />
          <text x="610" y="220" className="lab lab-soft" style={{ fontSize: 10 }}>events</text>

          {/* STREAM bus */}
          <rect x="40" y="250" width="1120" height="50" rx="4" fill="var(--card-2)" stroke="var(--ink-soft)" strokeWidth="1.2" />
          <text x="60" y="272" className="title" style={{ fontSize: 13 }}>STREAM</text>
          <text x="60" y="288" className="lab lab-soft" style={{ fontSize: 10 }}>event bus</text>
          <text x="600" y="278" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
            ModelRequest · ModelResponse · ToolCall · ToolResult · TaskStarted · Usage · …
          </text>

          {/* arrows from stream to consumers */}
          <line x1="180" y1="300" x2="180" y2="350" stroke="var(--ink-mute)" strokeWidth="1.2" />
          <polygon points="176,348 180,358 184,348" fill="var(--ink-mute)" />
          <line x1="430" y1="300" x2="430" y2="350" stroke="var(--ink-mute)" strokeWidth="1.2" />
          <polygon points="426,348 430,358 434,348" fill="var(--ink-mute)" />
          <line x1="680" y1="300" x2="680" y2="350" stroke="var(--ink-mute)" strokeWidth="1.2" />
          <polygon points="676,348 680,358 684,348" fill="var(--ink-mute)" />
          <line x1="930" y1="300" x2="930" y2="350" stroke="var(--ink-mute)" strokeWidth="1.2" />
          <polygon points="926,348 930,358 934,348" fill="var(--ink-mute)" />

          {/* consumers */}
          <rect x="80" y="360" width="200" height="56" rx="4" fill="var(--card)" stroke="var(--line-strong)" />
          <text x="180" y="382" textAnchor="middle" className="title" style={{ fontSize: 13 }}>OBSERVERS</text>
          <text x="180" y="400" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            TokenMonitor · LoopDetector
          </text>

          <rect x="330" y="360" width="200" height="56" rx="4" fill="var(--card)" stroke="var(--line-strong)" />
          <text x="430" y="382" textAnchor="middle" className="title" style={{ fontSize: 13 }}>HITL hook</text>
          <text x="430" y="400" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            structural pauses
          </text>

          <rect x="580" y="360" width="200" height="56" rx="4" fill="var(--card)" stroke="var(--action)" />
          <text x="680" y="382" textAnchor="middle" className="title" style={{ fontSize: 13, fill: "var(--action)" }}>AGGREGATE</text>
          <text x="680" y="400" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            writes working memory
          </text>

          <rect x="830" y="360" width="200" height="56" rx="4" fill="var(--card)" stroke="var(--action)" />
          <text x="930" y="382" textAnchor="middle" className="title" style={{ fontSize: 13, fill: "var(--action)" }}>COMPACT</text>
          <text x="930" y="400" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            bounds the stream
          </text>

          {/* arrows from agg/compact → knowledge */}
          <line x1="680" y1="416" x2="680" y2="446" stroke="var(--action)" strokeWidth="1.2" />
          <polygon points="676,444 680,454 684,444" fill="var(--action)" />
          <line x1="930" y1="416" x2="930" y2="446" stroke="var(--action)" strokeWidth="1.2" />
          <polygon points="926,444 930,454 934,444" fill="var(--action)" />

          {/* KNOWLEDGE STORE */}
          <rect x="500" y="450" width="560" height="60" rx="4" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="780" y="476" textAnchor="middle" className="title" style={{ fontSize: 14, fill: "var(--action)" }}>
            KNOWLEDGE STORE
          </text>
          <text x="780" y="494" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
            durable · pluggable · Memory / Disk / SQLite / Redis
          </text>

          {/* arrow from knowledge BACK UP TO assembly */}
          <path
            d="M 500 480 Q 160 480 160 180"
            stroke="var(--action)"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="4 4"
          />
          <polygon points="156,184 160,174 164,184" fill="var(--action)" />
          <text x="105" y="350" className="lab lab-ac" style={{ fontSize: 10 }}>
            next turn:
          </text>
          <text x="105" y="364" className="lab lab-soft" style={{ fontSize: 10 }}>
            assembly reads
          </text>
        </svg>
      </div>

      <div className="grid-3" style={{ marginTop: 36 }}>
        <div className="card channel">
          <div className="badge">Assembly</div>
          <h3>Build prompts as data</h3>
          <p>
            Each turn rebuilds context from the event stream + injected memory. Policies compose:
            <code> WorkingMemoryPolicy</code>, <code>SlidingWindowPolicy</code>, <code>TokenBudgetPolicy</code>, <code>AlertPolicy</code>.
            Pure transforms — no side effects.
          </p>
        </div>
        <div className="card">
          <div className="badge" style={{ color: "var(--ink-mute)" }}>Middleware</div>
          <h3>Composable wrappers</h3>
          <p>
            <code>BaseMiddleware</code> hooks: <code>on_turn</code>, <code>on_llm_call</code>,
            <code>on_tool_execution</code>, <code>on_human_input</code>. Built&#8209;ins: logging, retry,
            token-limit, history-limit. Plug your own without forking the loop.
          </p>
        </div>
        <div className="card action">
          <div className="badge">Tools &amp; subagents</div>
          <h3>Action surface</h3>
          <p>
            Provider&#8209;neutral <code>ToolSchema</code>. The <code>@tool</code> decorator turns a
            Python function into a typed tool with <code>Inject</code>/<code>Variable</code> DI.
            <code>agent.as_tool()</code> turns an agent into a subagent — isolated stream, parent
            stamps task context.
          </p>
        </div>
        <div className="card">
          <div className="badge" style={{ color: "var(--ink-mute)" }}>Stream</div>
          <h3>Event&#8209;driven backbone</h3>
          <p>
            Everything is an event: <code>ModelRequest</code>, <code>ModelResponse</code>,
            <code>ToolCall</code>, <code>TaskStarted</code>, <code>Usage</code>. In&#8209;memory by
            default; Redis-backed for distributed runs. Same wire shape used by observers, HITL,
            aggregate, compact.
          </p>
        </div>
        <div className="card">
          <div className="badge" style={{ color: "var(--ink-mute)" }}>Observers</div>
          <h3>Watch + alert</h3>
          <p>
            Out&#8209;of&#8209;the&#8209;box: <code>TokenMonitor</code> (budget caps),
            <code> LoopDetector </code>(infinite-loop guard). Subscribe to the stream, emit
            <code> ObserverAlert</code> events with severity. Middleware reacts.
          </p>
        </div>
        <div className="card">
          <div className="badge" style={{ color: "var(--ink-mute)" }}>HITL</div>
          <h3>Structural pause points</h3>
          <p>
            Any tool or policy can post a <code>HumanInputRequest</code>. The agent pauses until the
            hook resolves it. No bespoke state machines — the same event surface that drives
            agent&#8209;to&#8209;agent flow drives human&#8209;in&#8209;the&#8209;loop.
          </p>
        </div>
      </div>

      <p className="note" style={{ marginTop: 28 }}>
        <em>The shape that matters.</em> Every piece is a Protocol with a built&#8209;in default and a
        plug&#8209;in slot. You can run a one&#8209;line agent or layer in token limits, retries,
        custom assembly, structured output, and human gates — without rewriting the loop.
      </p>
    </section>
  );
}
