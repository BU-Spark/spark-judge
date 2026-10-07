import { useEffect, useRef, useState, type ReactNode } from "react";

export function ProjectListViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const top = maxScroll > 1 && viewport.scrollTop <= 1;
      const bottom = maxScroll > 1 && viewport.scrollTop >= maxScroll - 1;
      setEdges((previous) => previous.top === top && previous.bottom === bottom
        ? previous : { top, bottom });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    viewport.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div className="ct-project-list">
      <EdgeCaret direction="up" visible={edges.top} />
      <div ref={viewportRef} className="ballot-projects" role="region" aria-label="Projects to rank" tabIndex={0}>
        <div ref={contentRef}>{children}</div>
      </div>
      <EdgeCaret direction="down" visible={edges.bottom} />
    </div>
  );
}

function EdgeCaret({ direction, visible }: { direction: "up" | "down"; visible: boolean }) {
  const label = direction === "up" ? "Top of projects" : "Bottom of projects";
  return (
    <span className="ct-list-edge" data-visible={visible} aria-hidden={!visible} role="img" aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d={direction === "up" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
      </svg>
    </span>
  );
}
