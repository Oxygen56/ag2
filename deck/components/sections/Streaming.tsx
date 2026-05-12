export function Streaming() {
  return (
    <section id="streaming" className="wide">
      <div className="marker">10 / Omni&#8209;modal streaming</div>
      <h2>
        Text, audio, image, video — <em>one fan&#8209;out.</em>
      </h2>
      <p className="lead">
        Every modality rides the same chunk frame. The receiver&apos;s subscription demuxes per modality.
        Bidirectional is just two subscriptions.
      </p>

      <div className="grid-2 wider" style={{ marginTop: 32 }}>
        <svg viewBox="0 0 540 320" aria-hidden="true">
          <rect className="panel" x="20" y="40" width="140" height="200" rx="4" />
          <text x="90" y="64" textAnchor="middle" className="title">sender</text>
          <text x="90" y="82" textAnchor="middle" className="lab lab-soft">multimodal agent</text>
          <rect x="40" y="100" width="100" height="22" rx="3" fill="var(--channel-pale)" stroke="var(--channel)" />
          <text x="90" y="115" className="lab lab-ch" textAnchor="middle">text</text>
          <rect x="40" y="130" width="100" height="22" rx="3" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="90" y="145" className="lab lab-ac" textAnchor="middle">audio</text>
          <rect x="40" y="160" width="100" height="22" rx="3" fill="var(--identity-pale)" stroke="var(--identity)" />
          <text x="90" y="175" className="lab lab-id" textAnchor="middle">image</text>
          <rect x="40" y="190" width="100" height="22" rx="3" fill="var(--violation-pale)" stroke="var(--violation)" />
          <text x="90" y="205" className="lab lab-vi" textAnchor="middle">video</text>

          {/* animated chunks */}
          <g>
            <circle r="4" fill="var(--channel)">
              <animate attributeName="cx" values="160;380" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="cy" values="111;111" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--channel)">
              <animate attributeName="cx" values="160;380" dur="1.6s" begin="0.4s" repeatCount="indefinite" />
              <animate attributeName="cy" values="111;111" dur="1.6s" begin="0.4s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--channel)">
              <animate attributeName="cx" values="160;380" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
              <animate attributeName="cy" values="111;111" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
            </circle>

            <circle r="4" fill="var(--action)">
              <animate attributeName="cx" values="160;380" dur="2s" repeatCount="indefinite" />
              <animate attributeName="cy" values="141;141" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--action)">
              <animate attributeName="cx" values="160;380" dur="2s" begin="0.6s" repeatCount="indefinite" />
              <animate attributeName="cy" values="141;141" dur="2s" begin="0.6s" repeatCount="indefinite" />
            </circle>

            <circle r="5" fill="var(--identity)">
              <animate attributeName="cx" values="160;380" dur="2.6s" repeatCount="indefinite" />
              <animate attributeName="cy" values="171;171" dur="2.6s" repeatCount="indefinite" />
            </circle>

            <circle r="4" fill="var(--violation)">
              <animate attributeName="cx" values="160;380" dur="1.3s" repeatCount="indefinite" />
              <animate attributeName="cy" values="201;201" dur="1.3s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--violation)">
              <animate attributeName="cx" values="160;380" dur="1.3s" begin="0.32s" repeatCount="indefinite" />
              <animate attributeName="cy" values="201;201" dur="1.3s" begin="0.32s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--violation)">
              <animate attributeName="cx" values="160;380" dur="1.3s" begin="0.64s" repeatCount="indefinite" />
              <animate attributeName="cy" values="201;201" dur="1.3s" begin="0.64s" repeatCount="indefinite" />
            </circle>
          </g>

          <rect className="panel" x="380" y="40" width="140" height="200" rx="4" />
          <text x="450" y="64" textAnchor="middle" className="title">receiver</text>
          <text x="450" y="82" textAnchor="middle" className="lab lab-soft">renders per modality</text>
          <rect x="400" y="100" width="100" height="22" rx="3" fill="var(--channel-pale)" stroke="var(--channel)" />
          <text x="450" y="115" className="lab lab-ch" textAnchor="middle">text view</text>
          <rect x="400" y="130" width="100" height="22" rx="3" fill="var(--action-pale)" stroke="var(--action)" />
          <text x="450" y="145" className="lab lab-ac" textAnchor="middle">audio view</text>
          <rect x="400" y="160" width="100" height="22" rx="3" fill="var(--identity-pale)" stroke="var(--identity)" />
          <text x="450" y="175" className="lab lab-id" textAnchor="middle">image view</text>
          <rect x="400" y="190" width="100" height="22" rx="3" fill="var(--violation-pale)" stroke="var(--violation)" />
          <text x="450" y="205" className="lab lab-vi" textAnchor="middle">video view</text>

          <text x="270" y="280" textAnchor="middle" className="lab lab-em" style={{ fontSize: 11 }}>
            ChunkFrame · sender&#8209;monotonic · parent&#8209;envelope referenced
          </text>
        </svg>

        <div>
          <h4>One frame, every modality</h4>
          <p>
            Transient <code>ChunkFrame</code>s reference a parent envelope and carry a
            sender&#8209;monotonic sequence number. They flow through the same fan&#8209;out path the
            hub uses for any delivery.
          </p>
          <h4 style={{ marginTop: 22 }}>Demux on the receiver</h4>
          <p>
            <code>ChunkSubscription</code> demuxes by <code>(channel_id, parent_id)</code>. Text tokens,
            audio frames, image patches, video frames — the chunk is opaque payload at the transport
            layer; the view policy decides how to surface it.
          </p>
          <h4 style={{ marginTop: 22 }}>WAL records envelopes, not chunks</h4>
          <p>
            Chunks live and die in flight. The durable record is the finalised envelope. The same
            channel that streams an analyst&apos;s spoken commentary to a researcher&apos;s headset
            also streams the researcher&apos;s voice annotations back — the channel has no privileged
            direction.
          </p>
        </div>
      </div>
    </section>
  );
}
