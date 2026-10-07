import { useEffect, useRef, useState, type ReactNode } from "react";

export function ProjectListViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => {
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const bottom = maxScroll > 1 && viewport.scrollTop >= maxScroll - 1;
      setAtBottom(bottom);
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
      <div ref={viewportRef} className="ballot-projects" role="region" aria-label="Projects to rank" tabIndex={0}>
        <div ref={contentRef}>{children}</div>
      </div>
      <BottomCaret visible={atBottom} />
    </div>
  );
}

function BottomCaret({ visible }: { visible: boolean }) {
  const label = "Bottom of projects";
  return (
    <span className="ct-list-edge" data-visible={visible} aria-hidden={!visible} role="img" aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="m6 15 6-6 6 6" />
      </svg>
    </span>
  );
}
