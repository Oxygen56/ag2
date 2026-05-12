import { EventReplay } from "../EventReplay";
import { investigationReplay } from "@/lib/investigationEvents";

export function DemoInvestigation() {
  return (
    <section id="demo-investigation" className="full">
      <div style={{ maxWidth: "var(--max-wide)", margin: "0 auto" }}>
        <div className="marker">12 / Demo · cross-org investigation</div>
        <h2>
          A network that <em>scales as the work demands.</em>
        </h2>
        <p className="lead" style={{ maxWidth: "60ch" }}>
          A data&#8209;exfil investigation: nine participants come and go across two organisations,
          four kinds of device, three roles. Same channel. Same WAL. No restart, no rewiring.
        </p>

        <EventReplay data={investigationReplay} />

        <div className="grid-3" style={{ marginTop: 32 }}>
          <div className="card">
            <div className="badge" style={{ color: "var(--action)" }}>scalability</div>
            <h3>Participants are dynamic</h3>
            <p>
              Forensics joins when needed, log&#8209;analyzer leaves when its scan is done, CISO joins
              from mobile, legal joins from a different timezone. The channel doesn&apos;t need to
              restart — the participant set is just data on the manifest.
            </p>
          </div>
          <div className="card">
            <div className="badge" style={{ color: "var(--identity)" }}>federation</div>
            <h3>Two hubs, one channel</h3>
            <p>
              <code>threat-intel</code> sits on a partner&apos;s hub. <code>comms-pr</code> sits on a PR
              firm&apos;s hub. Signed passports cross both gaps. From inside the channel, they look like
              any other participant.
            </p>
          </div>
          <div className="card">
            <div className="badge" style={{ color: "var(--channel)" }}>devices</div>
            <h3>Cloud, server, laptop, mobile</h3>
            <p>
              Every participant runs wherever it natively lives. The network treats a CISO&apos;s phone
              the same as a forensics bot in the cloud — the projection is per&#8209;participant, not
              per&#8209;device.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
