"use client";
import { useEffect, useState } from "react";
const defaultSections = ["Overview", "Background", "Features", "Reflection"].map((label) => ({
  id: label.toLowerCase(),
  label,
}));
export function ReferenceToc({
  sections = defaultSections,
}: {
  sections?: readonly { id: string; label: string }[];
}) {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-8% 0px -65% 0px", threshold: 0 },
    );
    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav>
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "location" : undefined}
          onClick={() => setActive(id)}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
