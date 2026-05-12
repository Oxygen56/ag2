"use client";

import { useEffect, useState } from "react";

export type NavItem = { id: string; label: string };

export function Nav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY + window.innerHeight * 0.3;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.offsetTop <= y) current = item.id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [items]);

  return (
    <header className="top">
      <div className="top-inner">
        <a className="brand" href="#top">
          AG2&nbsp;Beta<span className="dot">.</span>
        </a>
        <nav className="mini">
          {items.map((item, i) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? "active" : ""}
            >
              <span style={{ color: "var(--ink-mute)" }}>{String(i + 1).padStart(2, "0")}</span>{" "}
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
