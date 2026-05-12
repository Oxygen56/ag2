"use client";

import { useEffect, useState } from "react";

export function ProgressDots({ ids }: { ids: string[] }) {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY + window.innerHeight * 0.3;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [ids]);

  return (
    <div className="progress" aria-hidden="true">
      {ids.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          className={active === id ? "active" : ""}
        />
      ))}
    </div>
  );
}
