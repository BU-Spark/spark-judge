import { useEffect, useId, useRef, useState } from "react";
import { ProjectMarkdown } from "./ProjectMarkdown";

const COLLAPSED_HEIGHT = 320;

export function ExpandableProjectMarkdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    setExpanded(false);
    const element = content.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > COLLAPSED_HEIGHT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  const collapsed = overflows && !expanded;
  return (
    <div className={`project-markdown-disclosure ${className}`}>
      <div
        id={id}
        className="project-markdown-disclosure-viewport"
        style={{
          maxHeight: expanded ? undefined : COLLAPSED_HEIGHT,
          overflow: collapsed ? "hidden" : undefined,
        }}
        data-collapsed={collapsed || undefined}
        // A keyboard user following a clipped link must be able to see it.
        onFocusCapture={() => {
          if (collapsed) setExpanded(true);
        }}
      >
        <div ref={content}>
          <ProjectMarkdown>{children}</ProjectMarkdown>
        </div>
      </div>
      {overflows && (
        <button
          type="button"
          className="project-markdown-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
