# ⭐️ Demo Day “Love Tap” Feature Spec – Phase 1 & Phase 2  
Updated to include:  
- **Max 3 appreciations per project per attendee**  
- Alignment with **existing codebase structure** (Convex + Next.js + Chakra UI)  
- Schema using **teams** (since projects = teams in your app)  
- Event `mode` integration  
- Browse page required in Phase 1  
- Fingerprinting in Phase 1  

---

# 📘 Overview

This spec describes a **Demo Day mode** to be added to the existing Hackathon Judging Platform.  
It introduces:

- A new **event mode**: `demo_day`
- A **Browse Page** for attendees to explore teams and appreciate them
- A **Love Tap appreciation system** with:
  - **Max 3 taps per team per attendee**  
  - **Max total taps per attendee per event (e.g. 15)**  
  - Device fingerprinting  
  - Soft rate limits  
- An **appreciations table** (Convex)
- Updated admin behavior
- **Phase 2** adds QR code generation and export

This integrates into your existing structure:

- `teams` = projects  
- `events` contain `teams`  
- UI entrypoint is inside `EventView.tsx`  
- Scoring logic remains untouched for hackathons  

---

# 🟦 Phase 1 — Core Demo Day Mode (MVP)

## 1. Schema Changes

### 1.1 `events` table  
Add a new field:

```ts
mode: v.optional(
  v.union(
    v.literal("hackathon"),
    v.literal("demo_day")
  )
)
```

If `mode` is `undefined`, treat as `"hackathon"` for backwards compatibility.

---

### 1.2 `appreciations` table (new)

Stored under Convex `applicationTables`:

```ts
appreciations: defineTable({
  eventId: v.id("events"),
  teamId: v.id("teams"),       // teams function as projects
  attendeeId: v.string(),      // UUID stored client-side
  fingerprintKey: v.string(),  // SHA-256 hash (device fingerprint)
  ipAddress: v.string(),
  userAgent: v.string(),
  timestamp: v.number(),
})
  .index("by_event", ["eventId"])
  .index("by_team", ["teamId"])
  .index("by_event_and_attendee", ["eventId", "attendeeId"])
  .index("by_event_team_attendee", ["eventId", "teamId", "attendeeId"]);
```

---

### 1.3 Optional fields on `teams`  
(Not strictly required if you prefer aggregation only)

```ts
rawScore: v.optional(v.number()),
cleanScore: v.optional(v.number()),
flagged: v.optional(v.boolean()),
```

You may compute scores from `appreciations` instead of storing them here.

---

## 2. Appreciation Rules (Updated)

### 2.1 Per-team limit  
**Max 3 appreciations per team per attendee**

```ts
MAX_TAPS_PER_PROJECT_PER_ATTENDEE = 3
```

Check count of `appreciations` for `(eventId, teamId, attendeeId)`.

---

### 2.2 Total event budget  
**Max 15 total appreciations per attendee per event** (recommended value)

```ts
MAX_TAPS_PER_ATTENDEE = 15
```

Count all participant’s `appreciations` for the event.

---

### 2.3 Soft IP rate limiting  
To prevent mass automation:

- Max ~100 appreciations from same IP in a rolling 10-minute window.

Does **not** block legitimate campus WiFi users because fingerprint + attendeeId still differentiate devices.

---

### 2.4 Fingerprinting (Phase 1 requirement)

Client computes:

```ts
{
  ua: navigator.userAgent,
  platform: navigator.platform,
  language: navigator.language,
  languages: navigator.languages,
  screen: [window.screen.width, window.screen.height],
  dpr: window.devicePixelRatio,
  cores: navigator.hardwareConcurrency,
  tz: new Date().getTimezoneOffset(),
}
```

Hash with SHA-256 → `fingerprintKey`.

Sent on every appreciation mutation.

---

## 3. `createAppreciation` Mutation (Convex)

Rules enforced:

1. Event must have `mode = "demo_day"`
2. Reject if attendee already gave **3 taps** to this team.
3. Reject if attendee used all **15 event taps**.
4. Soft IP rate limit.
5. Insert appreciation + log metadata.
6. (Optional now) update `rawScore` on team or compute dynamically.

---

## 4. Browse Page — Phase 1 MUST-HAVE

Route:

```
/demo-day/:eventId/browse
```

### UI Requirements  
- Search bar (filters by team/project name + description)
- Course filter chips (e.g., DS519, DS549)
- Grid/list of team cards:
  - team name
  - courseCode
  - short description
  - ❤️ button with:
    - “You have given X / 3 appreciations”
    - “Y appreciations left today”
- Clicking ❤️ calls `createAppreciation`.

### Integration Location  
Modify `EventView.tsx`:

```tsx
if (event.mode === "demo_day") {
  return <DemoDayBrowse event={event} onBack={onBack} />;
}
```

Existing hackathon scoring UI remains unchanged.

---

## 5. Client Behavior (Phase 1)

### 5.1 Attendee ID  
Generate UUID on first visit and store in:

- `localStorage`
- cookie fallback for Safari private mode

### 5.2 Fingerprinting  
Compute `fingerprintKey` once per session.

### 5.3 Appreciation Calls  
Send:

```ts
{
  eventId,
  teamId,
  attendeeId,
  fingerprintKey
}
```

Server performs rate limits and dedupe.

---

## 6. Admin Panel Updates (Phase 1)

Add ability to:

- Set event `mode = demo_day`
- View all teams with:
  - name
  - courseCode
  - rawScore (aggregated or stored)
  - cleanScore (same as raw at first)
- Export CSV of appreciation totals (aggregated from `appreciations`)

No QR interface yet.

---

# 🟩 Phase 2 — QR Codes & Printing Layer

Phase 2 builds **on top of Phase 1**, using the SAME URLs and Schema.

## 1. Appreciation URLs  
Each team already has:

```
/demo-day/:eventId/project/:teamId
```

QRs will encode these.

---

## 2. QR Code Generation Endpoint

```
GET /api/demo-day/:eventId/qr/:teamId
```

Steps:

1. Lookup team + event
2. Build URL
3. Generate PNG or SVG via `qrcode` npm package
4. Return as image

---

## 3. Admin “Download QR Codes” (Zip)

Generate:

```
qr/DS519_bpl-rag_F3A2.png
qr/DS549_traffic-vision_F3A9.png
...
projects.csv
```

Where `projects.csv` contains:

```csv
teamId,courseCode,teamName,slug,qrFilename,appreciationUrl
```

---

## 4. (Optional but recommended) QR Label Rendering

SVG wrapper:

```
<svg>
  (QR code)
  <text>Project: Team Name</text>
  <text>Course: DS519</text>
</svg>
```

Prevents mix-ups during printing.

---

# 🟪 Implementation Notes (New Based on Codebase)

- Projects = `teams`, so all appreciation logic uses `teamId`.
- Event UI routing uses `EventView.tsx`; insert Demo Day mode branch here.
- Chakra UI components mirror existing style.
- Schema additions must be **optional** to avoid breaking production data.
- All new queries/mutations live in `convex/appreciations.ts`.

---

# 🟧 Summary

**Phase 1 delivers a complete working Demo Day experience**, including:

- Browse page  
- Appreciation system  
- Fingerprinting  
- Admin controls  

**Phase 2 adds the printing/distribution layer**, including:

- QR generation  
- QR ZIP export  
- Labeling  

This structure integrates smoothly with your existing codebase while remaining cleanly extensible.

