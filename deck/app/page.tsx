import { Nav } from "@/components/Nav";
import { ProgressDots } from "@/components/ProgressDots";
import { Hero } from "@/components/sections/Hero";
import { Harness } from "@/components/sections/Harness";
import { Memory } from "@/components/sections/Memory";
import { Mismatch } from "@/components/sections/Mismatch";
import { Architecture } from "@/components/sections/Architecture";
import { Identity } from "@/components/sections/Identity";
import { Channels } from "@/components/sections/Channels";
import { Durability } from "@/components/sections/Durability";
import { Choreography } from "@/components/sections/Choreography";
import { Federation } from "@/components/sections/Federation";
import { Streaming } from "@/components/sections/Streaming";
import { DemoIncident } from "@/components/sections/DemoIncident";
import { DemoInvestigation } from "@/components/sections/DemoInvestigation";
import { Landscape } from "@/components/sections/Landscape";

const sections = [
  { id: "harness", label: "Harness" },
  { id: "memory", label: "Memory" },
  { id: "mismatch", label: "Mismatch" },
  { id: "architecture", label: "Architecture" },
  { id: "identity", label: "Identity" },
  { id: "channels", label: "Channels" },
  { id: "durability", label: "Durability" },
  { id: "choreography", label: "Choreography" },
  { id: "federation", label: "Federation" },
  { id: "streaming", label: "Streaming" },
  { id: "demo-incident", label: "Incident" },
  { id: "demo-investigation", label: "Investigation" },
  { id: "landscape", label: "Position" },
];

const dotIds = ["top", ...sections.map((s) => s.id)];

export default function Page() {
  return (
    <>
      <Nav items={sections} />
      <ProgressDots ids={dotIds} />

      <main>
        <Hero />
        <div className="div-line" />

        {/* Part I — the agent */}
        <Harness />
        <Memory />

        {/* Part II — the network (transition + architecture + primitives) */}
        <Mismatch />
        <Architecture />
        <Identity />
        <Channels />
        <Durability />
        <Choreography />
        <div className="div-line" />
        <Federation />
        <Streaming />

        {/* Part III — in action */}
        <div className="div-line" />
        <DemoIncident />
        <DemoInvestigation />
        <div className="div-line" />

        {/* Close */}
        <Landscape />

        <footer>
          <div className="brand-foot">
            AG2 <em>Beta</em>
          </div>
          <div className="line">A framework for autonomous agents · harness + network</div>
          <div className="line">github.com/ag2-ai &nbsp;·&nbsp; docs &nbsp;·&nbsp; reach out</div>
        </footer>
      </main>
    </>
  );
}
