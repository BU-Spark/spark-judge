import { CODE_AND_TELL_SUBTITLE, CODE_AND_TELL_TITLE } from "./codeAndTellPresentation";
import { getEventDisplayLabel } from "./eventModes";

type UpcomingSource = { _id: string; name: string; mode?: string | null; startDate: number };

export type UpcomingItem<E extends UpcomingSource> = {
  key: string;
  event: E;
  title: string;
  label: string;
  awards?: string[];
};

const DEMO_DAY = /demo day/i;
const SEASON = /\b(fall|spring|summer|winter)\s+(\d{4})\b/i;
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

function awardName(name: string) {
  if (/xc\s?475/i.test(name)) return "XC475 Innovation Award";
  const prefix = name.split(/\s+-\s+/)[0];
  return prefix && !DEMO_DAY.test(prefix) ? prefix : "Audience Choice";
}

function season(name: string) {
  const match = name.match(SEASON);
  return match ? `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}` : undefined;
}

/**
 * Display items for upcoming events. Demo Day runs its award votes as separate events,
 * so events on the same day (or in the same season when undated) share one item.
 */
export function upcomingItems<E extends UpcomingSource>(events: E[]): UpcomingItem<E>[] {
  const items: UpcomingItem<E>[] = [];
  const demoDays = new Map<string, { item: UpcomingItem<E>; events: E[] }>();
  for (const event of events) {
    if (!DEMO_DAY.test(event.name)) {
      const codeAndTell = event.mode === "code_and_tell";
      items.push({
        key: event._id,
        event,
        title: codeAndTell ? CODE_AND_TELL_TITLE : event.name,
        label: codeAndTell ? CODE_AND_TELL_SUBTITLE : getEventDisplayLabel(event.mode),
      });
      continue;
    }
    const when = event.startDate > 0 ? dayKey.format(event.startDate) : "tba";
    const key = `${when}|${season(event.name) ?? ""}`;
    const group = demoDays.get(key);
    if (group) {
      group.events.push(event);
      if (event.mode === "demo_day" && group.item.event.mode !== "demo_day") group.item.event = event;
    } else {
      const item: UpcomingItem<E> = { key: event._id, event, title: "Demo Day", label: season(event.name) ?? "Demo Day" };
      demoDays.set(key, { item, events: [event] });
      items.push(item);
    }
  }
  for (const { item, events: grouped } of demoDays.values()) {
    const awards = [...new Set(grouped.map((e) => awardName(e.name)))];
    item.awards = awards.sort((a, b) => Number(b === "Audience Choice") - Number(a === "Audience Choice"));
  }
  return items;
}
