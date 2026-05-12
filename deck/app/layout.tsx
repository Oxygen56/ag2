import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AG2 Network — An Action-Driven Network for Agents",
  description:
    "The channel between agents is the unit. A network shaped for stateful, identity-bound, durable, choreographed action — sitting next to the resource-driven internet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,0..100&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="grid-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
