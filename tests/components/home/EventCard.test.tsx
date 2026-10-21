import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EventCard, EventCardEmpty, EventCardSkeleton, UpcomingEventCard } from "../../../src/components/home/EventCard";
import { getEventBrand } from "../../../src/lib/eventBrands";
import {
  EVENT_ART,
  EVENT_ART_VARIANTS,
  eventArtSequence,
  eventArtVariant,
} from "../../../src/components/home/EventCardArt";

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 19, 16);

const fullEvent = {
  _id: "event1",
  name: "DS+X 2026",
  description: "An interdisciplinary hackathon.",
  startDate: now + 4 * 24 * HOUR + 19 * HOUR,
  endDate: now + 5 * 24 * HOUR + 30 * HOUR,
  mode: "hackathon",
  tracks: ["Health", "Open", "Health", "  "],
  categories: [{ name: "Design" }, { name: "Ethics" }],
  teams: [{}, {}, {}],
};

const renderCard = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("EventCard", () => {
  it("shows countdown, tracks, criteria, and project count when data is present", () => {
    renderCard(<EventCard event={fullEvent} phase="pre" now={now} />);
    expect(screen.getByRole("heading", { level: 1, name: "DS+X 2026" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Starts in")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Health", "Open"]);
    expect(screen.getByText("Judged on").nextSibling).toHaveTextContent("Design · Ethics");
    expect(screen.getByText("Projects").nextSibling).toHaveTextContent("3");
  });

  it("degrades to a calm placeholder when optional data is missing", () => {
    renderCard(
      <EventCard
        event={{ _id: "e2", name: "Mystery Hack", startDate: 0, endDate: Number.NaN, mode: undefined }}
        phase="pre"
        now={now}
      />,
    );
    expect(screen.getByText("Details will be posted here as the event gets closer.")).toBeInTheDocument();
    expect(screen.getByText("Date to be announced")).toBeInTheDocument();
    expect(screen.getByText("To be announced")).toBeInTheDocument();
    expect(screen.queryByText("Tracks")).not.toBeInTheDocument();
    expect(screen.queryByText("Judged on")).not.toBeInTheDocument();
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Time")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("ignores an end date that is before the start and never shows a negative countdown", () => {
    renderCard(
      <EventCard
        event={{ ...fullEvent, startDate: now - HOUR, endDate: now - 2 * HOUR }}
        phase="pre"
        now={now}
      />,
    );
    expect(screen.getByText("Any moment now")).toBeInTheDocument();
    expect(screen.queryByText("Wrap-up")).not.toBeInTheDocument();
  });

  it("shows courses instead of tracks and criteria for Demo Day", () => {
    renderCard(
      <EventCard
        event={{ ...fullEvent, mode: "demo_day", courseCodes: ["XC475", "DS519"] }}
        phase="live"
        now={now}
      />,
    );
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.queryByText("Tracks")).not.toBeInTheDocument();
    expect(screen.queryByText("Judged on")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open event/ })).toHaveAttribute("href", "/event/event1");
  });

  it("caps a long judging criteria list", () => {
    renderCard(
      <EventCard
        event={{ ...fullEvent, categories: Array.from({ length: 9 }, (_, i) => ({ name: `C${i}` })) }}
        phase="post"
        now={now}
      />,
    );
    expect(screen.getByText(/\+3 more/)).toBeInTheDocument();
    expect(screen.getByText("Just wrapped")).toBeInTheDocument();
  });
});

describe("EventCard art", () => {
  it("walks every variant before repeating and never repeats a composition back to back", () => {
    const sequence = Array.from({ length: EVENT_ART_VARIANTS * 2 }, (_, n) => eventArtVariant("", n));
    expect(new Set(sequence.slice(0, EVENT_ART_VARIANTS)).size).toBe(EVENT_ART_VARIANTS);
    expect(sequence.slice(EVENT_ART_VARIANTS)).toEqual(sequence.slice(0, EVENT_ART_VARIANTS));
    const composition = (v: number) => v % EVENT_ART.length;
    for (let n = 1; n < sequence.length; n++) {
      expect(composition(sequence[n])).not.toBe(composition(sequence[n - 1]));
    }
    const recent = sequence.slice(0, EVENT_ART.length).map(composition);
    expect(new Set(recent).size).toBe(EVENT_ART.length);
  });

  it("orders events by start date for their art sequence", () => {
    const events = [
      { _id: "b", startDate: 300 },
      { _id: "a", startDate: 100 },
      { _id: "c", startDate: 200 },
    ];
    expect(eventArtSequence(events, "a")).toBe(0);
    expect(eventArtSequence(events, "c")).toBe(1);
    expect(eventArtSequence(events, "b")).toBe(2);
    expect(eventArtSequence(events, "missing")).toBeUndefined();
  });

  it("keeps a stable fallback variant and hides the art from assistive tech", () => {
    expect(eventArtVariant("event1")).toBe(eventArtVariant("event1"));
    expect(eventArtVariant("event1")).toBeLessThan(EVENT_ART_VARIANTS);

    const { container } = renderCard(<EventCard event={fullEvent} phase="live" now={now} />);
    expect(container.querySelector(".hp-event-card-art")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EventCard states", () => {
  it("renders an accessible loading skeleton", () => {
    render(<EventCardSkeleton />);
    expect(screen.getByRole("status", { name: "Loading events" })).toBeInTheDocument();
  });

  it("links to past events only when there are some", () => {
    const { rerender } = render(<EventCardEmpty hasPast />);
    expect(screen.getByRole("link", { name: /Browse past events/ })).toHaveAttribute("href", "#past-events");
    rerender(<EventCardEmpty hasPast={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("Upcoming event cards", () => {
  it("shows the date, time until start, and the event's series palette", () => {
    const { container } = render(
      <UpcomingEventCard event={{ ...fullEvent, name: "CivicHacks 2027", startDate: now + 16 * 24 * HOUR }} now={now} />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "CivicHacks 2027" })).toBeInTheDocument();
    expect(screen.getByText("Starts in", { exact: false })).toHaveClass("sr-only");
    expect(screen.getByText("16").parentElement).toHaveTextContent("16 days");
    expect(screen.getByText("Hackathon")).toBeInTheDocument();
    expect(container.querySelector(".hp-upcoming-card")).toHaveClass("hp-event-card--pre", "hp-brand-civichacks");
  });

  it("falls back to the platform palette and a placeholder date when details are missing", () => {
    const { container } = render(
      <UpcomingEventCard event={{ ...fullEvent, name: "Spring Hack", startDate: 0 }} now={now} />,
    );
    expect(container.querySelector(".hp-upcoming-card")?.className).not.toMatch(/hp-brand-/);
    expect(screen.getByText("Date to be announced")).toBeInTheDocument();
  });
});

describe("getEventBrand", () => {
  it("matches each year's edition of a series", () => {
    expect(getEventBrand("DS+X 2026")).toBe("dsx");
    expect(getEventBrand("DS + X 2027")).toBe("dsx");
    expect(getEventBrand("Civic Hacks 2027")).toBe("civichacks");
    expect(getEventBrand("Audience Choice - Demo Day Spring 2027")).toBe("demoday");
    expect(getEventBrand("XC475 Student Innovation - Demo Day Fall 2026")).toBe("demoday");
    expect(getEventBrand("November 2026 Code & Tell: Monthly Demo Night")).toBeUndefined();
  });
});
