# AG2 Network — Public Deck

A Next.js app for presenting the AG2 Network framework at conferences, partnership meetings, and technical investor pitches.

## Run locally

```bash
cd deck
npm install
npm run dev
```

Open `http://localhost:3030`.

## Deploy to Vercel

```bash
cd deck
vercel
```

Or push to a GitHub repo and import in the Vercel dashboard — the framework detects Next.js automatically. Root directory must be `deck/`.

## Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Plain CSS with design tokens (no Tailwind, no UI library)
- Google Fonts: Fraunces (display), Inter (body), JetBrains Mono (code)

## Structure

```
deck/
├── app/
│   ├── layout.tsx          root layout, font loading
│   ├── page.tsx            section composition
│   └── globals.css         design tokens + component styles
├── components/
│   ├── Nav.tsx             sticky top navigation
│   ├── ProgressDots.tsx    right-side scroll indicator
│   ├── EventReplay.tsx     interactive event-replay player (used by demos)
│   └── sections/
│       ├── Hero.tsx
│       ├── Mismatch.tsx              (01) why agents break resource-shaped networking
│       ├── Architecture.tsx          (02) action-driven networking, drawn intentionally
│       ├── Identity.tsx              (03) passport + resume + skill
│       ├── Channels.tsx              (04) the channel is the action
│       ├── Durability.tsx            (05) WAL + pure fold = exact recovery
│       ├── Choreography.tsx          (06) dial in your control level
│       ├── Federation.tsx            (07) multi-hub native
│       ├── Streaming.tsx             (08) omni-modal bidirectional chunks
│       ├── DemoIncident.tsx          (09) production incident replay
│       ├── DemoInvestigation.tsx     (10) cross-org investigation replay
│       └── Landscape.tsx             (11) position + differentiators + close
└── lib/
    ├── incidentEvents.ts             event sequence for demo 1
    └── investigationEvents.ts        event sequence for demo 2
```

## Design tokens

Light "schematic" palette — distinctive, not Anthropic-style, not generic AI:

- Background: cool off-white (`#F2F4F0`)
- Ink: deep navy (`#16202E`)
- Channels (primary accent): deep teal (`#1F5F6E`)
- Identity (secondary): russet (`#A05A35`)
- Action: sage (`#5A7B36`)
- Violation: brick (`#A04438`)

Tokens are defined in `app/globals.css` and consumed via `var(--token)` throughout.

## Editing the demos

Each event-replay demo is driven by a single TypeScript data file in `lib/`. To edit a scenario, modify the `participants`, `channels`, `envelopes`, and `events` arrays — the `EventReplay` component renders deterministically from the playhead time.

- `joinTime` / `leaveTime` on a participant control dynamic membership
- Envelopes animate from `from` to `to` over ~0.7 seconds
- Events drive the side log

## License

Internal — part of the AG2 project.
