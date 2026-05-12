import { EventReplay } from "../EventReplay";
import { incidentReplay } from "@/lib/incidentEvents";

export function DemoIncident() {
  return (
    <section id="demo-incident" className="full">
      <div style={{ maxWidth: "var(--max-wide)", margin: "0 auto" }}>
        <div className="marker">11 / Demo · production incident</div>
        <h2>
          A real incident, <em>choreographed live.</em>
        </h2>
        <p className="lead" style={{ maxWidth: "56ch" }}>
          02:14 Friday. Payment service p99 spikes. Watch eight participants — agents and one on&#8209;call human — coordinate on a single durable channel.
        </p>

        <EventReplay data={incidentReplay} />

        <p className="note" style={{ marginTop: 28 }}>
          <em>What this would look like on a classic stack:</em> Slack thread + PagerDuty + GitHub PR
          + a war&#8209;room shared doc, with state spread across five tools. A workflow channel
          collapses orchestration, durability, audit, and the human gate into one addressable thing — and
          adds the observed&#8209;outcome feedback loop that classic stacks have no home for.
        </p>
      </div>
    </section>
  );
}
