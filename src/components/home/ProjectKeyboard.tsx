import type { CSSProperties } from "react";

export type KeyGlyphKind = "bolt" | "leaf" | "shield" | "network" | "chat";

export type KeyProject = {
  id: string;
  name: string;
  team: string;
  /** Per-project identity hue — event data per DESIGN.md, not a palette role. */
  hue: string;
  glyph: KeyGlyphKind;
};

/** Rotation of authored hues/glyphs for teams that don't carry their own. */
export const KEY_HUES = ["#6366f1", "#22c55e", "#7c3aed", "#fbbf24", "#ec4899"] as const;
export const KEY_GLYPHS: KeyGlyphKind[] = ["bolt", "leaf", "shield", "network", "chat"];

/**
 * The project keyboard: up to 8 white key caps in a 4-column matrix. Unfilled
 * slots render as dashed open slots — the grid is honest about capacity.
 * Hover/focus reports to the display module's SELECT readout; press opens the
 * project (and gives the cap its 3px travel).
 */
export function ProjectKeyboard({
  projects,
  onOpen,
  onReport,
}: {
  projects: KeyProject[];
  onOpen: (id: string) => void;
  onReport: (p: KeyProject | null) => void;
}) {
  const shown = projects.slice(0, 8);
  const slotCount = Math.min(8, Math.max(4, Math.ceil(Math.max(shown.length, 1) / 4) * 4));
  const openSlots = slotCount - shown.length;

  return (
    <section className="fi-h-zone" id="fi-h-projects" aria-labelledby="fi-h-projects-h">
      <header className="fi-h-zone-head">
        <h2 className="fi-zone fi-h-zone-word" id="fi-h-projects-h">
          Projects to score
        </h2>
        <span className="fi-engraved">
          Matrix A · keys 01–{String(slotCount).padStart(2, "0")} · {String(shown.length).padStart(2, "0")} assigned
        </span>
      </header>
      <ul className="fi-h-keys">
        {shown.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className="fi-h-key"
              style={{ "--key-hue": p.hue } as CSSProperties}
              aria-label={`Score project "${p.name}" — ${p.team}`}
              onClick={() => onOpen(p.id)}
              onMouseEnter={() => onReport(p)}
              onMouseLeave={() => onReport(null)}
              onFocus={() => onReport(p)}
              onBlur={() => onReport(null)}
            >
              <span className="fi-h-key-top">
                <span className="fi-h-key-led" aria-hidden="true" />
                <span className="fi-h-key-num">K{String(i + 1).padStart(2, "0")}</span>
              </span>
              <span className="fi-h-key-glyph" aria-hidden="true">
                <KeyGlyph kind={p.glyph} />
              </span>
              <span>
                <span className="fi-h-key-name">{p.name}</span>
                <span className="fi-h-key-team">{p.team}</span>
              </span>
            </button>
          </li>
        ))}
        {Array.from({ length: openSlots }, (_, i) => (
          <li key={`open-${i}`}>
            <div
              className="fi-h-key fi-h-key--open"
              aria-label={`Open slot — no project assigned to key ${shown.length + i + 1}`}
            >
              <span className="fi-h-key-glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
                  <circle cx="12" cy="12" r="6.5" strokeDasharray="3 3.5" />
                </svg>
              </span>
              <span className="fi-engraved">
                K{String(shown.length + i + 1).padStart(2, "0")} · Open slot
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KeyGlyph({ kind }: { kind: KeyGlyphKind }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "square" as const,
    strokeLinejoin: "miter" as const,
  };
  switch (kind) {
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 3 6 13h5l-2 8 8-11h-5l1-7z" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path d="M12 21v-8" />
          <path d="M12 13C12 8 9 5 4 5c0 5 3 8 8 8" />
          <path d="M12 13c0-5 3-8 8-8 0 5-3 8-8 8" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6l-7 9-7-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "network":
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2.2" />
          <circle cx="5" cy="18" r="2.2" />
          <circle cx="19" cy="18" r="2.2" />
          <path d="M12 7.2 5.8 16.2M12 7.2l6.2 9M7.2 18h9.6" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h13v9H9l-5 4z" />
          <path d="M9 9.5h5M9 12h3" />
        </svg>
      );
  }
}
