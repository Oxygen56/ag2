export function Memory() {
  return (
    <section id="memory" className="wide">
      <div className="marker">02 / Memory</div>
      <h2>
        Bounded context, <em>coherent agent.</em>
      </h2>
      <p className="lead" style={{ maxWidth: "54ch" }}>
        The naive answer to long conversations is "bigger context window." It doesn&apos;t scale.
        Three primitives keep what the LLM sees bounded — without losing track of what was said.
      </p>

      <div className="memory-grid">
        {/* LEFT: the cycle diagram */}
        <div className="memory-panel">
          <h4>How the memory loop runs</h4>
          <svg viewBox="0 0 480 380" aria-hidden="true">
            {/* Stream */}
            <rect x="160" y="30" width="160" height="46" rx="4" fill="var(--card-2)" stroke="var(--ink-soft)" strokeWidth="1.2" />
            <text x="240" y="52" textAnchor="middle" className="title" style={{ fontSize: 13 }}>STREAM</text>
            <text x="240" y="68" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>turn N events</text>

            {/* compact arrow → trimmed */}
            <line x1="200" y1="78" x2="120" y2="130" stroke="var(--action)" strokeWidth="1.2" />
            <polygon points="118,126 116,135 124,131" fill="var(--action)" />
            <text x="138" y="106" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 10 }}>compact</text>

            {/* aggregate arrow → knowledge */}
            <line x1="280" y1="78" x2="360" y2="130" stroke="var(--action)" strokeWidth="1.2" />
            <polygon points="362,126 364,135 356,131" fill="var(--action)" />
            <text x="342" y="106" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 10 }}>aggregate</text>

            {/* trimmed events */}
            <rect x="40" y="135" width="160" height="44" rx="4" fill="var(--card)" stroke="var(--action)" />
            <text x="120" y="155" textAnchor="middle" className="title" style={{ fontSize: 12 }}>TRIMMED</text>
            <text x="120" y="170" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9.5 }}>+ CompactionSummary</text>

            {/* knowledge store */}
            <rect x="280" y="135" width="160" height="44" rx="4" fill="var(--action-pale)" stroke="var(--action)" />
            <text x="360" y="155" textAnchor="middle" className="title" style={{ fontSize: 12, fill: "var(--action)" }}>KNOWLEDGE</text>
            <text x="360" y="170" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9.5 }}>working memory</text>

            {/* down to assembly */}
            <line x1="120" y1="179" x2="180" y2="218" stroke="var(--channel)" strokeWidth="1.2" />
            <polygon points="178,214 184,224 174,222" fill="var(--channel)" />
            <line x1="360" y1="179" x2="300" y2="218" stroke="var(--channel)" strokeWidth="1.2" />
            <polygon points="302,214 296,222 306,222" fill="var(--channel)" />

            {/* Assembly */}
            <rect x="100" y="222" width="280" height="50" rx="4" fill="var(--channel-pale)" stroke="var(--channel)" />
            <text x="240" y="244" textAnchor="middle" className="title" style={{ fontSize: 13, fill: "var(--channel)" }}>
              ASSEMBLY
            </text>
            <text x="240" y="260" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }}>
              builds turn N+1 prompt
            </text>

            {/* down to LLM */}
            <line x1="240" y1="272" x2="240" y2="302" stroke="var(--ink-mute)" strokeWidth="1.2" />
            <polygon points="236,300 240,310 244,300" fill="var(--ink-mute)" />

            {/* LLM */}
            <rect x="160" y="312" width="160" height="40" rx="4" fill="var(--identity-pale)" stroke="var(--identity)" />
            <text x="240" y="336" textAnchor="middle" className="title" style={{ fontSize: 12, fill: "var(--identity)" }}>
              LLM CALL
            </text>

            {/* loop arrow back to stream */}
            <path
              d="M 320 332 Q 460 332 460 50 L 322 50"
              fill="none"
              stroke="var(--ink-mute)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <polygon points="324,46 314,50 324,54" fill="var(--ink-mute)" />
            <text x="460" y="200" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 10 }} transform="rotate(90 460 200)">
              events of next turn
            </text>
          </svg>
        </div>

        {/* RIGHT: token-budget chart */}
        <div className="memory-panel">
          <h4>Why it matters</h4>
          <svg viewBox="0 0 480 380" aria-hidden="true">
            {/* axes */}
            <line x1="50" y1="320" x2="460" y2="320" className="ax" />
            <line x1="50" y1="40" x2="50" y2="320" className="ax" />
            <text x="50" y="32" className="lab lab-soft" style={{ fontSize: 10 }}>tokens / turn</text>
            <text x="460" y="340" textAnchor="end" className="lab lab-soft" style={{ fontSize: 10 }}>turns →</text>

            {/* context limit line */}
            <line x1="50" y1="80" x2="460" y2="80" stroke="var(--violation)" strokeDasharray="4 4" strokeWidth="1" />
            <text x="455" y="74" textAnchor="end" className="lab lab-vi" style={{ fontSize: 10, fontWeight: 600 }}>
              context window limit
            </text>

            {/* naive: linear growth crossing limit */}
            <polyline
              points="50,300 80,278 110,255 140,232 170,208 200,184 230,160 260,134 290,108 320,82 350,56 380,30 410,4"
              fill="none"
              stroke="var(--violation)"
              strokeWidth="2"
            />
            <circle cx="320" cy="82" r="4" fill="var(--violation)" />
            <text x="328" y="76" className="lab lab-vi" style={{ fontSize: 9.5 }}>overflow</text>

            {/* AG2 sawtooth: bounded */}
            <polyline
              points="50,300 80,288 110,278 140,268 170,258 200,250 230,242 260,288 290,272 320,260 350,250 380,240 410,234 440,288"
              fill="none"
              stroke="var(--action)"
              strokeWidth="2"
            />
            {/* compact markers */}
            <circle cx="260" cy="288" r="4" fill="var(--action)" />
            <circle cx="440" cy="288" r="4" fill="var(--action)" />
            <text x="262" y="306" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 9 }}>compact</text>
            <text x="438" y="306" textAnchor="middle" className="lab lab-ac" style={{ fontSize: 9 }}>compact</text>

            {/* labels */}
            <rect x="60" y="50" width="170" height="20" rx="2" fill="var(--card)" stroke="var(--violation-soft)" />
            <circle cx="74" cy="60" r="3" fill="var(--violation)" />
            <text x="84" y="63" className="lab" style={{ fontSize: 10, fill: "var(--violation)" }}>
              naive — every event kept
            </text>

            <rect x="60" y="76" width="170" height="20" rx="2" fill="var(--card)" stroke="var(--action-soft)" />
            <circle cx="74" cy="86" r="3" fill="var(--action)" />
            <text x="84" y="89" className="lab" style={{ fontSize: 10, fill: "var(--action)" }}>
              compact + aggregate
            </text>

            <text x="240" y="365" textAnchor="middle" className="lab lab-em" style={{ fontSize: 10 }}>
              effective memory grows in the store
            </text>
            <text x="240" y="378" textAnchor="middle" className="lab lab-soft" style={{ fontSize: 9 }}>
              while the prompt stays bounded each turn
            </text>
          </svg>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 32 }}>
        <div className="card action">
          <div className="badge">Compact</div>
          <h3>Trim the stream</h3>
          <p>
            <code>TailWindowCompact</code> keeps the last N. <code>SummarizeCompact</code> emits a
            <code> CompactionSummary</code> event so the assembly can still narrate what got dropped.
            Triggers on event count or token budget.
          </p>
        </div>
        <div className="card action">
          <div className="badge">Aggregate</div>
          <h3>Synthesize into the store</h3>
          <p>
            <code>AggregateStrategy</code> reads the event history, writes structured working memory
            into the knowledge store. Triggers on <code>every_n_turns</code>, <code>every_n_events</code>,
            <code>on_end</code>. Aggregation creates; compaction removes — they&apos;re complementary.
          </p>
        </div>
        <div className="card channel">
          <div className="badge">Assembly</div>
          <h3>Inject memory back</h3>
          <p>
            <code>WorkingMemoryPolicy</code> reads from the store and injects working memory as a
            system block at the next turn. <code>EpisodicMemoryPolicy</code> surfaces past episodes
            by relevance. Reductions (sliding window, token budget) run after injections.
          </p>
        </div>
      </div>

      <div className="meta-strip">
        <div>
          <div className="key">Per&#8209;turn prompt</div>
          <div className="val">Bounded · regardless of conversation length</div>
        </div>
        <div>
          <div className="key">Effective memory</div>
          <div className="val">Unbounded · lives in the knowledge store</div>
        </div>
        <div>
          <div className="key">Storage backends</div>
          <div className="val">Memory · Disk · SQLite · Redis · pluggable</div>
        </div>
      </div>

      <p className="note" style={{ marginTop: 28 }}>
        <em>The shape that matters.</em> Compact + aggregate + assembly are independent primitives
        with one shared trigger model. Swap one without touching the others — different summarisers,
        different aggregation cadences, different injection policies — same loop, different ergonomics.
      </p>
    </section>
  );
}
