import { useState } from "react";
import { eventBrandClass } from "../../lib/eventBrands";
import type { FocalHomepage } from "../../lib/homepagePhase";
import { EventCard } from "./EventCard";
import type { StageEvent } from "./EventStage";
import { UpcomingEvents } from "./Homepage";
import { EVENT_ART, EVENT_ART_VARIANTS, EventCardArt, eventArtVariant } from "./EventCardArt";
import "./homepage-workspace.css";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const PHASES: { phase: FocalHomepage["phase"]; label: string }[] = [
  { phase: "pre", label: "Upcoming" },
  { phase: "live", label: "Live" },
  { phase: "post", label: "Just wrapped" },
];
const SERIES = [
  { key: "dsx", name: "DS+X 2026", label: "DS+X" },
  { key: "civichacks", name: "CivicHacks 2027", label: "CivicHacks" },
  { key: "demoday", name: "Demo Day - Fall 2026", label: "Demo Day" },
  { key: "default", name: "Spring Hack 2027", label: "Other events" },
] as const;

function sampleEvent(phase: FocalHomepage["phase"], now: number, name: string) {
  const offset = phase === "pre" ? 106 * HOUR + 22 * MINUTE : phase === "live" ? -18 * HOUR : -54 * HOUR;
  const startDate = Math.round((now + offset) / (30 * MINUTE)) * 30 * MINUTE;
  return {
    _id: "preview-dsx-2026",
    name,
    description:
      "An interdisciplinary hackathon at Boston University, bringing data science together with your field, interests, and ideas.",
    startDate,
    endDate: startDate + 30 * HOUR,
    mode: "hackathon",
    tracks: ["Health", "Sustainability", "Civic Tech", "Open"],
    categories: ["Impact", "Technical Complexity", "Design", "Presentation", "Ethics"].map((name) => ({ name })),
    teams: Array.from({ length: 10 }, () => ({})),
  };
}

/** The 2026–27 schedule. Spring Demo Day has no date yet, and each Demo Day runs two votes at once. */
function upcomingSamples(): StageEvent[] {
  const at = (iso: string, hours: number) => {
    const startDate = Date.parse(iso);
    return { startDate, endDate: startDate + hours * HOUR, status: "upcoming" as const };
  };
  const codeAndTell = (month: string, iso: string) => ({
    _id: `preview-code-and-tell-${month.toLowerCase().replace(/\s/g, "-")}`,
    name: `${month} Code & Tell: Monthly Demo Night`,
    description: "An open-mic night for BU student makers to demo personal tech projects, get feedback, and vote.",
    mode: "code_and_tell",
    ...at(iso, 1.5),
  });
  const demoDay = (season: string, iso: string | null) => {
    const when = iso ? at(iso, 4) : { startDate: 0, endDate: 0, status: "upcoming" as const };
    const id = season.toLowerCase().replace(/\s/g, "-");
    return [
      {
        _id: `preview-demo-day-${id}`,
        name: `Audience Choice - Demo Day ${season}`,
        description: "Students from the practicum and innovation courses show their work. Vote for your favorite projects.",
        mode: "demo_day",
        courseCodes: ["DS488/688", "DS519", "DS539", "DS549", "DS594", "XC473", "XC475"],
        ...when,
      },
      {
        _id: `preview-xc475-${id}`,
        name: `XC475 Student Innovation - Demo Day ${season}`,
        description: "Judges score the XC475 presentations for the Innovation Award.",
        mode: "hackathon",
        ...when,
      },
    ];
  };
  return [
    codeAndTell("November 2026", "2026-11-04T23:00:00Z"),
    ...demoDay("Fall 2026", "2026-12-11T20:00:00Z"),
    codeAndTell("February 2027", "2027-02-03T23:00:00Z"),
    {
      _id: "preview-civichacks-2027",
      name: "CivicHacks 2027",
      description: "Boston University's student-led civic tech hackathon.",
      mode: "hackathon",
      ...at("2027-02-27T05:00:00Z", 48),
    },
    codeAndTell("March 2027", "2027-03-03T23:00:00Z"),
    ...demoDay("Spring 2027", null),
  ];
}

/** Local review route for the focal event card, series palettes, and every art variant. */
export function EventCardPreview() {
  const params = new URLSearchParams(window.location.search);
  const [now] = useState(Date.now);
  const [phase, setPhase] = useState<FocalHomepage["phase"]>(
    (PHASES.find((p) => p.phase === params.get("phase"))?.phase ?? "pre"),
  );
  const [series, setSeries] = useState<(typeof SERIES)[number]>(
    SERIES.find((s) => s.key === params.get("series")) ?? SERIES[0],
  );
  const [upcoming] = useState(upcomingSamples);
  const initialArt = Number(params.get("art"));
  const [variant, setVariant] = useState(
    Number.isInteger(initialArt) && params.has("art") ? initialArt : eventArtVariant("preview-dsx-2026"),
  );

  return (
    <div className="hp-workspace">
      <div className="hp-preview-bar">
        <span>Event card preview · Sample event</span>
        <span role="group" aria-label="Series" className="hp-art-gallery-phases">
          {SERIES.map((s) => (
            <button key={s.key} aria-pressed={series.key === s.key} onClick={() => setSeries(s)}>
              {s.label}
            </button>
          ))}
        </span>
        <span role="group" aria-label="Phase" className="hp-art-gallery-phases">
          {PHASES.map((p) => (
            <button key={p.phase} aria-pressed={phase === p.phase} onClick={() => setPhase(p.phase)}>
              {p.label}
            </button>
          ))}
        </span>
      </div>
      <main>
        <section className="hp-live-event--card">
          <EventCard event={sampleEvent(phase, now, series.name)} phase={phase} now={now} artVariant={variant} />
        </section>
        <section className="hp-directory" aria-label="Upcoming event cards">
          <div className="hp-directory-heading">
            <h2>Coming up</h2>
          </div>
          <UpcomingEvents events={upcoming} artEvents={upcoming} now={now} />
        </section>
        <section className="hp-art-gallery" aria-label="Art variants">
          <h2>
            {EVENT_ART_VARIANTS} art variants{" "}
            <span>In the order events receive them by start date. The cycle then starts over.</span>
          </h2>
          <ul>
            {Array.from({ length: EVENT_ART_VARIANTS }, (_, sequence) => {
              const v = eventArtVariant("", sequence);
              return (
                <li key={sequence}>
                  <button
                    className={`hp-event-card hp-event-card--${phase}${eventBrandClass(series.name)}`}
                    aria-pressed={variant === v}
                    onClick={() => setVariant(v)}
                  >
                    <EventCardArt seed="" variant={v} />
                    <span>
                      {sequence + 1} · {EVENT_ART[v % EVENT_ART.length].name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
