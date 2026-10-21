import type { ReactNode } from "react";

type Fills = { a: string; b: string; c: string; d: string; h: string };
type Corner = "tl" | "tr" | "bl" | "br";

/** Quarter disc filling an s×s cell, with its center at the given corner. */
function quarter(x: number, y: number, s: number, corner: Corner, fill: string, key?: string) {
  const d = {
    bl: `M${x} ${y + s}V${y}A${s} ${s} 0 0 1 ${x + s} ${y + s}Z`,
    br: `M${x + s} ${y + s}H${x}A${s} ${s} 0 0 1 ${x + s} ${y}Z`,
    tl: `M${x} ${y}H${x + s}A${s} ${s} 0 0 1 ${x} ${y + s}Z`,
    tr: `M${x + s} ${y}V${y + s}A${s} ${s} 0 0 1 ${x} ${y}Z`,
  }[corner];
  return <path key={key} d={d} fill={fill} />;
}

/** Half disc resting on the bottom edge. */
const arch = (cx: number, r: number, fill: string) => (
  <path key={r} d={`M${cx - r} 600A${r} ${r} 0 0 1 ${cx + r} 600Z`} fill={fill} />
);

const DOTS = ["cbb", "bca", "cbc"];
const PIXEL_ACCENTS: Record<string, "b" | "d"> = { "3-0": "d", "2-2": "b", "0-3": "b" };

/** Compositions on a 600×600 canvas whose right edge meets the card edge. */
export const EVENT_ART: { name: string; draw: (f: Fills) => ReactNode }[] = [
  {
    name: "Orbit",
    draw: ({ a, b, c, d, h }) => (
      <>
        <circle cx="400" cy="230" r="230" fill={a} />
        <path d="M170 600A230 230 0 0 1 400 370V600Z" fill={b} />
        <rect x="400" y="370" width="200" height="230" fill={c} />
        <path d="M400 440h80v-70h120v230H400Z" fill={d} />
        <circle cx="400" cy="230" r="72" fill={h} />
      </>
    ),
  },
  {
    name: "Stairs",
    draw: ({ a, b, c, d, h }) => (
      <>
        <path d="M60 600V480h135V360h135V240h135V120h135V600Z" fill={a} />
        <circle cx="210" cy="170" r="110" fill={b} />
        <circle cx="210" cy="170" r="40" fill={h} />
        <rect x="330" y="480" width="135" height="120" fill={d} />
        <rect x="465" y="0" width="135" height="120" fill={c} />
      </>
    ),
  },
  {
    name: "Leaves",
    draw: ({ a, b, c, d }) => (
      <>
        <path d="M140 600C140 320 340 110 600 110C600 390 400 600 140 600Z" fill={a} />
        <path d="M400 290C400 145 280 20 130 20C130 165 250 290 400 290Z" fill={b} />
        <circle cx="500" cy="500" r="60" fill={d} />
        <rect x="560" y="0" width="40" height="110" fill={c} />
      </>
    ),
  },
  {
    name: "Moons",
    draw: ({ a, b, c, d }) => (
      <>
        <rect x="300" y="0" width="300" height="600" fill={d} />
        <path d="M600 0A150 150 0 0 0 600 300Z" fill={a} />
        <path d="M300 300A150 150 0 0 1 300 600Z" fill={c} />
        <circle cx="375" cy="150" r="75" fill={b} />
        <circle cx="525" cy="450" r="75" fill={a} />
        {quarter(150, 450, 150, "br", b)}
      </>
    ),
  },
  {
    name: "Tiles",
    draw: ({ a, b, c, d, h }) => (
      <>
        <rect x="400" y="0" width="200" height="200" fill={c} />
        <rect x="200" y="200" width="200" height="200" fill={d} />
        <rect x="400" y="400" width="200" height="200" fill={a} />
        {quarter(200, 0, 200, "bl", a, "q1")}
        {quarter(400, 0, 200, "tl", b, "q2")}
        {quarter(200, 200, 200, "tr", c, "q3")}
        {quarter(400, 200, 200, "br", a, "q4")}
        {quarter(200, 400, 200, "tl", b, "q5")}
        {quarter(400, 400, 200, "bl", h, "q6")}
      </>
    ),
  },
  {
    name: "Target",
    draw: ({ a, b, c, d, h }) => (
      <>
        <circle cx="480" cy="300" r="300" fill={a} />
        <circle cx="480" cy="300" r="225" fill={h} />
        <circle cx="480" cy="300" r="150" fill={b} />
        <circle cx="480" cy="300" r="75" fill={c} />
        <circle cx="130" cy="520" r="32" fill={d} />
      </>
    ),
  },
  {
    name: "Wedge",
    draw: ({ a, b, d, h }) => (
      <>
        <path d="M140 600 600 40V600Z" fill={a} />
        <rect x="530" y="0" width="28" height="600" fill={d} />
        <circle cx="440" cy="400" r="95" fill={h} />
        <circle cx="440" cy="400" r="40" fill={b} />
        <circle cx="260" cy="140" r="64" fill={b} />
      </>
    ),
  },
  {
    name: "Arches",
    draw: ({ a, b, c, d, h }) => (
      <>
        {arch(430, 310, a)}
        {arch(430, 235, b)}
        {arch(430, 160, c)}
        {arch(430, 85, h)}
        <circle cx="160" cy="120" r="50" fill={d} />
      </>
    ),
  },
  {
    name: "Bars",
    draw: ({ a, b, c, d }) => (
      <>
        <rect x="150" y="380" width="96" height="320" rx="48" fill={d} />
        <rect x="262" y="250" width="96" height="450" rx="48" fill={b} />
        <rect x="374" y="130" width="96" height="570" rx="48" fill={a} />
        <rect x="486" y="20" width="96" height="680" rx="48" fill={c} />
        <circle cx="198" cy="290" r="48" fill={a} />
      </>
    ),
  },
  {
    name: "Lights",
    draw: (fills) => (
      <>
        {DOTS.flatMap((row, y) =>
          [...row].map((role, x) => (
            <circle key={`${x}-${y}`} cx={300 + x * 120} cy={120 + y * 180} r="52" fill={fills[role as keyof Fills]} />
          )),
        )}
      </>
    ),
  },
  {
    name: "Split",
    draw: ({ a, b, c, h }) => (
      <>
        <path d="M430 30A270 270 0 0 0 430 570Z" fill={a} />
        <path d="M430 30A270 270 0 0 1 430 570Z" fill={b} />
        <rect x="100" y="285" width="500" height="30" fill={h} />
        <circle cx="430" cy="300" r="60" fill={c} />
      </>
    ),
  },
  {
    name: "Pixels",
    draw: (fills) => (
      <>
        {Array.from({ length: 16 }, (_, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          if (col + row < 3) return null;
          const fill = fills[PIXEL_ACCENTS[`${col}-${row}`] ?? "a"];
          return <rect key={i} x={col * 150} y={row * 150} width="150" height="150" fill={fill} />;
        })}
      </>
    ),
  },
  {
    name: "Sunrise",
    draw: ({ a, b, d }) => (
      <>
        <circle cx="600" cy="600" r="420" fill={a} />
        <circle cx="210" cy="150" r="58" fill={b} />
        <circle cx="430" cy="190" r="22" fill={d} />
      </>
    ),
  },
  {
    name: "Corner",
    draw: ({ a, b, h }) => (
      <>
        <circle cx="600" cy="0" r="480" fill={a} />
        <circle cx="600" cy="0" r="310" fill={h} />
        <circle cx="600" cy="0" r="170" fill={b} />
      </>
    ),
  },
  {
    name: "Keyhole",
    draw: ({ a, b, d, h }) => (
      <>
        <rect x="350" y="230" width="140" height="370" fill={a} />
        <circle cx="420" cy="230" r="150" fill={a} />
        <circle cx="420" cy="230" r="54" fill={h} />
        <rect x="140" y="470" width="130" height="130" fill={d} />
        {quarter(140, 340, 130, "bl", b)}
      </>
    ),
  },
  {
    name: "Bands",
    draw: ({ a, b, c }) => (
      <>
        <path d="M120 600 420 0h150L270 600Z" fill={a} />
        <path d="M360 600 600 120v220L510 600Z" fill={b} />
        <circle cx="190" cy="150" r="54" fill={c} />
      </>
    ),
  },
];

const ORDERS = [
  [1, 2, 3, 4],
  [2, 1, 3, 4],
  [1, 4, 3, 2],
] as const;

export const EVENT_ART_VARIANTS = EVENT_ART.length * ORDERS.length;

/** Must share no factor with EVENT_ART.length so the walk visits every composition. */
const STRIDE = 5;

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Variant for the nth event in date order. Neighbouring events never share a
 * composition or color order, a composition returns only after every other one
 * has been used, and an exact repeat takes EVENT_ART_VARIANTS events.
 */
export function eventArtVariant(seed: string, sequence?: number) {
  const n = sequence ?? hash(seed);
  const composition = (n * STRIDE) % EVENT_ART.length;
  const order = n % ORDERS.length;
  return order * EVENT_ART.length + composition;
}

/** Position of an event among all events ordered by start date, used as its art sequence. */
export function eventArtSequence(events: { _id: string; startDate: number }[], id: string) {
  const index = [...events]
    .sort((x, y) => x.startDate - y.startDate || x._id.localeCompare(y._id))
    .findIndex((event) => event._id === id);
  return index === -1 ? undefined : index;
}

function ArtSvg({ index, className }: { index: number; className?: string }) {
  const art = EVENT_ART[index % EVENT_ART.length];
  const [a, b, c, d] = ORDERS[Math.floor(index / EVENT_ART.length)].map((n) => `var(--ec-${n})`);
  return (
    <svg className={className} viewBox="0 0 600 600" preserveAspectRatio="xMaxYMid slice" data-art={art.name}>
      {art.draw({ a, b, c, d, h: "var(--ec-hole)" })}
    </svg>
  );
}

/**
 * Decorative scoreboard art. Colors come from the card's phase via --ec-1…4 and --ec-hole.
 * `tiles` adds neighbouring compositions that only show where the art becomes a wide band.
 */
export function EventCardArt({ seed, variant, tiles = 1 }: { seed: string; variant?: number; tiles?: number }) {
  const index = ((variant ?? eventArtVariant(seed)) % EVENT_ART_VARIANTS + EVENT_ART_VARIANTS) % EVENT_ART_VARIANTS;
  return (
    <div className="hp-event-card-art" aria-hidden="true">
      <ArtSvg index={index} />
      {Array.from({ length: tiles - 1 }, (_, i) => (
        <ArtSvg
          key={i}
          index={(index + (i + 1) * STRIDE * 3) % EVENT_ART_VARIANTS}
          className="hp-art-tile"
        />
      ))}
    </div>
  );
}
