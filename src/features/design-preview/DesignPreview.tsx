import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./designPreview.css";
import festivalHero from "../../assets/design-preview/maker-festival/hero-bridge.webp";
import echoGridCover from "../../assets/design-preview/maker-festival/echo-grid.webp";

type Direction = "festival" | "control" | "gallery";
type Screen = "home" | "create" | "score";

const directions: Array<{
  id: Direction;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: "festival",
    label: "Maker Festival",
    eyebrow: "Live celebration",
    description: "Poster energy, communal discovery, and memorable event-day moments.",
  },
  {
    id: "control",
    label: "Mission Control",
    eyebrow: "Consequential work",
    description: "Operational clarity, readiness signals, and confident judging decisions.",
  },
  {
    id: "gallery",
    label: "Project Gallery",
    eyebrow: "Public discovery",
    description: "Editorial storytelling that keeps projects and makers at the center.",
  },
];

const screens: Array<{ id: Screen; label: string }> = [
  { id: "home", label: "Home" },
  { id: "create", label: "Create event" },
  { id: "score", label: "Scoring wizard" },
];

const projects = [
  { name: "GreenRoute", tag: "Climate", mark: "route" },
  { name: "CivicSignal", tag: "Community", mark: "signal" },
  { name: "OpenPark", tag: "Public space", mark: "park" },
];

const rubric = [
  { name: "Impact", detail: "Addresses a meaningful civic need", score: 4, state: "Reviewed" },
  { name: "Innovation", detail: "Brings a creative, original approach", score: 4, state: "Reviewed" },
  { name: "Execution", detail: "Well-built and ready to grow", score: 0, state: "Not reviewed" },
];

function Glyph({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    spark: <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" />,
    home: <path d="m3 11 9-7 9 7v9h-6v-6H9v6H3v-9Z" />,
    calendar: <><path d="M5 4h14v16H5zM8 2v4m8-4v4M5 9h14" /><path d="M9 13h2m2 0h2m-6 4h2" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-6 6-6s6 2 6 6m1-10c3 0 5 2 5 5v3" /></>,
    chart: <path d="M4 20V9m6 11V4m6 16v-7m4 7H2" />,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></>,
    shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />,
    grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
    list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    leaf: <><path d="M19 4C11 4 5 8 5 14c0 3 2 5 5 5 6 0 9-7 9-15Z" /><path d="M5 20c2-5 6-8 11-11" /></>,
    trophy: <><path d="M8 4h8v5c0 3-1.5 5-4 5s-4-2-4-5V4Zm4 10v5m-4 1h8" /><path d="M8 6H4v2c0 2 1.5 3 4 3m8-5h4v2c0 2-1.5 3-4 3" /></>,
    heart: <path d="M12 20S4 15.5 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15.5 12 20 12 20Z" />,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11c0 4 3 6 7 6s7-2 7-6m-7 6v4m-4 0h8" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="dp-glyph">
      {paths[name] ?? paths.spark}
    </svg>
  );
}

function ProductMark() {
  return (
    <div className="dp-product-mark">
      <span className="dp-logo-bug"><Glyph name="spark" /></span>
      <span>HackJudge</span>
    </div>
  );
}

function AppHeader({ direction, active }: { direction: Direction; active: Screen }) {
  return (
    <header className="dp-app-header">
      <ProductMark />
      <nav aria-label="Preview product navigation">
        <span className={active !== "score" ? "is-active" : ""}>Events</span>
        <span>Projects</span>
        <span className={active === "score" ? "is-active" : ""}>Judging</span>
      </nav>
      <div className="dp-avatar" aria-label="Signed in as Jordan Davis">JD</div>
      {direction === "festival" && <span className="dp-sticker dp-sticker--header">LIVE!</span>}
    </header>
  );
}

function SideNav({ active }: { active: Screen }) {
  const items = [
    ["home", "Home", "home"],
    ["create", "Events", "calendar"],
    ["score", "Assignments", "users"],
    ["reports", "Reports", "chart"],
  ];
  return (
    <aside className="dp-side-nav" aria-label="Preview section navigation">
      {items.map(([id, label, icon]) => (
        <div key={id} className={active === id ? "is-active" : ""}>
          <Glyph name={icon} />
          <span>{label}</span>
        </div>
      ))}
      <small>Concept preview<br />Dummy data only</small>
    </aside>
  );
}

function ProjectArt({ mark, large = false }: { mark: string; large?: boolean }) {
  return (
    <div className={`dp-project-art dp-project-art--${mark}${large ? " is-large" : ""}`}>
      <i /><i /><i />
      {mark === "route" && <span className="dp-route-line" />}
    </div>
  );
}

function Progress({ value = 4, total = 12 }: { value?: number; total?: number }) {
  return (
    <div className="dp-progress" aria-label={`${value} of ${total} teams scored`}>
      <div><span style={{ width: `${(value / total) * 100}%` }} /></div>
      <strong>{value} of {total}</strong>
    </div>
  );
}

function HomeScreen({ direction }: { direction: Direction }) {
  if (direction === "control") {
    return (
      <ScreenShell active="home" direction={direction}>
        <div className="dp-page-head">
          <div><span className="dp-kicker">ACTIVE ASSIGNMENT / CFH-25</span><h1>Your mission</h1><p>Review with focus. Make fair decisions.</p></div>
          <span className="dp-status"><i /> Systems ready</span>
        </div>
        <section className="dp-mission-card">
          <div className="dp-mission-event"><span>Active event</span><h2>Civic Futures Hackathon</h2><p>May 24–26 · Metro Innovation Hub</p></div>
          <div className="dp-mission-stat"><small>Mission status</small><strong>33%</strong><span>Judging progress</span></div>
          <div className="dp-mission-stat"><small>Time remaining</small><strong>16h 24m</strong><span>Ends today, 6 PM</span></div>
          <div className="dp-mission-stat"><small>Teams assigned</small><strong>12</strong><span>4 reviewed</span></div>
          <button className="dp-primary">Resume judging <Glyph name="arrow" /></button>
        </section>
        <section className="dp-readiness">
          <div><span className="dp-kicker">Mission readiness</span><h3>Coverage is on track</h3><p>Your scores are private until final submission.</p></div>
          <div className="dp-radar"><i /><i /><i /></div>
          <dl><div><dt>Rubric coverage</dt><dd>Good</dd></div><div><dt>Notes added</dt><dd>75%</dd></div><div><dt>Remaining</dt><dd>8 teams</dd></div></dl>
        </section>
      </ScreenShell>
    );
  }

  if (direction === "gallery") {
    return (
      <ScreenShell active="home" direction={direction}>
        <section className="dp-gallery-hero">
          <div><span className="dp-kicker">Featured event · May 24–26</span><h1>Civic Futures<br />Hackathon</h1><p>Ideas for stronger communities, built by civic thinkers and doers.</p><button className="dp-primary">Explore the showcase <Glyph name="arrow" /></button></div>
          <article className="dp-feature-project"><ProjectArt mark="route" large /><span>Featured project</span><h2>GreenRoute</h2><p>Smarter school commutes. Cleaner air.</p></article>
        </section>
        <section className="dp-project-section">
          <div className="dp-section-title"><div><span className="dp-kicker">Curated projects</span><h2>Made for the city</h2></div><div className="dp-view-toggle"><button aria-label="Gallery view" className="is-active"><Glyph name="grid" /></button><button aria-label="List view"><Glyph name="list" /></button></div></div>
          <div className="dp-project-grid">{projects.map((project) => <article key={project.name}><ProjectArt mark={project.mark} /><small>{project.tag}</small><h3>{project.name}</h3><p>Thoughtful tools for everyday civic life.</p></article>)}</div>
        </section>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell active="home" direction={direction} fullWidth>
      <div className="dp-festival-phase"><span>Phase 0 fidelity spike</span><span>Local concept data</span></div>
      <section className="dp-f2-hero">
        <img src={festivalHero} alt="" />
        <div className="dp-f2-hero-content">
          <span className="dp-f2-live"><i /> Live now</span>
          <h1>HackFest<br />Boston 2026</h1>
          <p>Apr 10 – Apr 12, 2026<br />Boston, MA</p>
          <button className="dp-f2-primary">Explore 42 projects <Glyph name="arrow" /></button>
        </div>
        <div className="dp-f2-seal" aria-hidden="true"><span>Make</span><i>+</i><span>Build</span><i>+</i><span>Ship</span></div>
      </section>

      <section className="dp-f2-projects" aria-labelledby="festival-featured-projects">
        <div className="dp-f2-section-head">
          <h2 id="festival-featured-projects">Featured projects</h2>
          <button>View all <Glyph name="arrow" /></button>
        </div>
        <div className="dp-f2-project-grid">
          <article className="dp-f2-project-card">
            <div className="dp-f2-cover"><img src={echoGridCover} alt="" /><span>AI/ML</span></div>
            <div><h3>Echo Grid</h3><p>Team Aurora</p><Glyph name="arrow" /></div>
          </article>
          <article className="dp-f2-project-card">
            <div className="dp-f2-cover dp-f2-cover--canvas" aria-hidden="true"><i /><i /><i /><span>Web</span></div>
            <div><h3>Civic Canvas</h3><p>Team Northpoint</p><Glyph name="arrow" /></div>
          </article>
          <article className="dp-f2-project-card">
            <div className="dp-f2-cover dp-f2-cover--nexus" aria-hidden="true"><i /><i /><span>Hardware</span></div>
            <div><h3>Nexus Labs</h3><p>Team Circuit</p><Glyph name="arrow" /></div>
          </article>
        </div>
      </section>

      <section className="dp-f2-upcoming" aria-labelledby="festival-upcoming-events">
        <div className="dp-f2-section-head"><h2 id="festival-upcoming-events">Upcoming events</h2></div>
        <div className="dp-f2-event-grid">
          <article><time><strong>May</strong><span>22–24</span></time><div><h3>MakeFest Austin 2026</h3><p>Austin, TX</p></div><Glyph name="arrow" /></article>
          <article><time><strong>Jun</strong><span>12–14</span></time><div><h3>BuildDay Seattle 2026</h3><p>Seattle, WA</p></div><Glyph name="arrow" /></article>
          <article><time><strong>Jul</strong><span>17–19</span></time><div><h3>HackTheBay 2026</h3><p>San Francisco, CA</p></div><Glyph name="arrow" /></article>
        </div>
      </section>
    </ScreenShell>
  );
}

function Steps({ direction }: { direction: Direction }) {
  const labels = direction === "control" ? ["Details", "Rubric", "Teams", "Readiness", "Publish"] : ["Details", "Rubric", "Teams", "Publish"];
  return <ol className="dp-steps">{labels.map((label, index) => <li key={label} className={index === 0 ? "is-active" : ""}><span>{index + 1}</span>{label}</li>)}</ol>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? "is-wide" : ""}><span>{label}</span><div className="dp-input">{children}</div></label>;
}

function FestivalField({ label, value, wide = false, multiline = false }: { label: string; value: string; wide?: boolean; multiline?: boolean }) {
  return (
    <label className={`dp-f3-field${wide ? " is-wide" : ""}`}>
      <span>{label}</span>
      {multiline
        ? <textarea readOnly value={value} />
        : <input readOnly value={value} />}
    </label>
  );
}

function CreateScreen({ direction }: { direction: Direction }) {
  if (direction === "festival") {
    return (
      <ScreenShell active="create" direction={direction} festivalScreen="create">
        <div className="dp-festival-phase"><span>Maker Festival system</span><span>Local concept data</span></div>
        <header className="dp-f3-create-head">
          <div><span className="dp-kicker">New event</span><h1>Create your event</h1><p>Set the stage for a weekend worth remembering.</p></div>
          <span className="dp-f3-draft"><i /> Draft</span>
        </header>

        <ol className="dp-f3-steps" aria-label="Event creation progress">
          <li className="is-active"><span>01</span><strong>Event details</strong><i /></li>
          <li><span>02</span><strong>Judging setup</strong><i /></li>
          <li><span>03</span><strong>Review & publish</strong></li>
        </ol>

        <section className="dp-f3-mode-section" aria-labelledby="festival-mode-heading">
          <div className="dp-f3-section-title"><div><span className="dp-kicker">Choose a format</span><h2 id="festival-mode-heading">What are you hosting?</h2></div><p>This shapes participation, judging, and results.</p></div>
          <div className="dp-f3-mode-grid">
            <button type="button" className="is-selected" aria-pressed="true"><span><Glyph name="trophy" /></span><div><strong>Hackathon</strong><small>Rubric judging for teams</small></div><i><Glyph name="check" /></i></button>
            <button type="button" aria-pressed="false"><span><Glyph name="heart" /></span><div><strong>Demo Day</strong><small>Public project appreciations</small></div></button>
            <button type="button" aria-pressed="false"><span><Glyph name="mic" /></span><div><strong>Code & Tell</strong><small>Ranked community ballots</small></div></button>
          </div>
        </section>

        <form className="dp-f3-event-form">
          <div className="dp-f3-section-title"><div><span className="dp-kicker">Event details</span><h2>The essentials</h2></div><p>All fields can be changed before publishing.</p></div>
          <div className="dp-f3-fields">
            <FestivalField label="Event name" value="Civic Futures Hackathon" wide />
            <FestivalField label="Start date" value="May 24, 2026" />
            <FestivalField label="End date" value="May 26, 2026" />
            <FestivalField label="Location" value="Metro Innovation Hub, Austin" wide />
            <FestivalField label="Description" value="A weekend of building, collaboration, and civic impact. Teams turn local challenges into working prototypes." wide multiline />
          </div>
          <div className="dp-f3-create-actions"><button type="button" className="dp-f3-save">Save draft</button><button type="button" className="dp-f2-primary">Continue to judging setup <Glyph name="arrow" /></button></div>
        </form>
      </ScreenShell>
    );
  }

  const heading = direction === "control" ? "Launch event" : direction === "festival" ? "Make some noise" : "Create event";
  const subheading = direction === "control" ? "Set the foundation for a fair, successful evaluation." : direction === "festival" ? "Set the stage for a weekend worth remembering." : "Set the stage for something meaningful.";
  return (
    <ScreenShell active="create" direction={direction}>
      <div className="dp-create-head">
        <span className="dp-kicker">New event</span>
        <h1>{heading}</h1>
        <p>{subheading}</p>
        {direction === "festival" && <span className="dp-sticker">LET&apos;S GO!</span>}
      </div>
      <Steps direction={direction} />
      <div className="dp-create-layout">
        <form className="dp-event-form">
          <Field label="Event name" wide>Civic Futures Hackathon</Field>
          <Field label="Start date">May 24, 2025</Field>
          <Field label="End date">May 26, 2025</Field>
          <Field label="Location" wide>Metro Innovation Hub, Austin</Field>
          <Field label="Event mode"><span className="dp-pill">Hackathon judging</span></Field>
          <Field label="Accent color"><span className="dp-color-dot" /> Electric blue</Field>
          <Field label="Description" wide>A weekend of building, collaboration, and civic impact. Teams turn local challenges into working prototypes.</Field>
          <div className="dp-form-actions"><button type="button" className="dp-secondary">Save draft</button><button type="button" className="dp-primary">Continue <Glyph name="arrow" /></button></div>
        </form>
        {direction === "control" && <aside className="dp-checklist"><span className="dp-kicker">Readiness checklist</span><h3>3 of 5 ready</h3>{["Event details", "Rubric defined", "Teams imported", "Judges invited", "Test scoring"].map((item, index) => <div key={item} className={index < 3 ? "is-done" : ""}><span><Glyph name={index < 3 ? "check" : "clock"} /></span>{item}<small>{index < 3 ? "Complete" : "Pending"}</small></div>)}</aside>}
        {direction === "festival" && <aside className="dp-poster-preview"><span className="dp-tape">EVENT POSTER</span><div className="dp-burst">69</div><h3>CIVIC<br />FUTURES</h3><p>Build something that matters.</p><span className="dp-sticker">MAY 24</span></aside>}
        {direction === "gallery" && <aside className="dp-cover-preview"><ProjectArt mark="route" large /><small>Event cover preview</small><h3>Civic Futures</h3><p>A showcase of projects for stronger communities.</p></aside>}
      </div>
    </ScreenShell>
  );
}

function ScoreControls({ direction }: { direction: Direction }) {
  return (
    <div className="dp-rubric-list">
      {rubric.map((criterion, criterionIndex) => (
        <article key={criterion.name} className={criterion.score ? "is-reviewed" : ""}>
          <div className="dp-rubric-copy"><span className="dp-rubric-icon"><Glyph name={criterionIndex === 0 ? "leaf" : criterionIndex === 1 ? "spark" : "check"} /></span><div><h3>{criterion.name}</h3><p>{criterion.detail}</p></div>{direction === "control" && <small className="dp-review-state">{criterion.state}</small>}</div>
          <div className="dp-score-row">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={criterion.score === value ? "is-selected" : ""} aria-label={`${criterion.name}: ${value} of 5`}>{value}</button>)}</div>
        </article>
      ))}
    </div>
  );
}

function ScoreScreen({ direction }: { direction: Direction }) {
  if (direction === "festival") {
    return (
      <ScreenShell active="score" direction={direction} festivalScreen="score">
        <div className="dp-festival-phase"><span>Maker Festival system</span><span>Local concept data</span></div>
        <header className="dp-f3-score-head">
          <div><span className="dp-kicker">Civic Futures Hackathon</span><h1>Score project</h1><p>Your draft stays private until final submission.</p></div>
          <div className="dp-f3-progress" aria-label="4 of 12 projects scored"><span><i style={{ width: "33%" }} /></span><strong>4 / 12 scored</strong></div>
        </header>

        <section className="dp-f3-dossier" aria-labelledby="festival-score-project">
          <div className="dp-f3-dossier-cover"><img src={echoGridCover} alt="" /><span>AI/ML</span></div>
          <div className="dp-f3-dossier-copy"><span>Project 05 of 12</span><h2 id="festival-score-project">Echo Grid</h2><p>Adaptive energy routing that helps community buildings cut peak demand without sacrificing comfort.</p></div>
          <dl><div><dt>Team</dt><dd>Aurora</dd></div><div><dt>Track</dt><dd>Climate tech</dd></div><div><dt>Stack</dt><dd>React · Python · OpenAI</dd></div></dl>
        </section>

        <section className="dp-f3-scoring" aria-labelledby="festival-rubric-heading">
          <div className="dp-f3-section-title"><div><span className="dp-kicker">Weighted rubric</span><h2 id="festival-rubric-heading">Rate each category</h2></div><p>Select one score per criterion.</p></div>
          <div className="dp-f3-rubrics">
            {rubric.map((criterion, criterionIndex) => (
              <article key={criterion.name} className={criterion.score ? "is-reviewed" : ""}>
                <div className="dp-f3-rubric-copy">
                  <span className="dp-f3-rubric-icon"><Glyph name={criterionIndex === 0 ? "leaf" : criterionIndex === 1 ? "spark" : "check"} /></span>
                  <div><h3>{criterion.name}</h3><p>{criterion.detail}</p></div>
                  <small>{criterion.score ? "Reviewed" : "Not reviewed"}</small>
                </div>
                <div className="dp-f3-score-row">
                  {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={criterion.score === value ? "is-selected" : ""} aria-label={`${criterion.name}: ${value} of 5`}>{value}</button>)}
                </div>
              </article>
            ))}
          </div>
          <label className="dp-f3-notes"><span>Private notes</span><textarea readOnly value="Strong technical execution. Ask how the demand forecast handles incomplete building data." /></label>
          <footer className="dp-f3-score-actions"><button type="button" className="dp-f3-save">Previous project</button><span><Glyph name="shield" /> Draft saved privately</span><button type="button" className="dp-f2-primary">Save & next project <Glyph name="arrow" /></button></footer>
        </section>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell active="score" direction={direction}>
      <div className="dp-score-head">
        <div><span className="dp-kicker">{direction === "control" ? "Team dossier / GR-17" : direction === "festival" ? "Judging passport · Stop 5" : "Private scoring"}</span><h1>{direction === "control" ? "Team dossier" : direction === "festival" ? "Score GreenRoute" : "Score GreenRoute"}</h1><p>{direction === "control" ? "Review the evidence. Record a fair decision." : "Your scores stay private until you submit."}</p></div>
        <Progress />
      </div>
      <div className="dp-score-layout">
        <aside className="dp-project-dossier">
          <ProjectArt mark="route" large />
          <span className="dp-kicker">Project 05</span>
          <h2>GreenRoute</h2>
          <p>Smarter school commutes through real-time routing, community partnerships, and cleaner mobility.</p>
          <dl><div><dt>Team</dt><dd>Metropolis University</dd></div><div><dt>Track</dt><dd>Climate & mobility</dd></div><div><dt>Stack</dt><dd>React · Mapbox · Python</dd></div></dl>
          {direction === "festival" && <span className="dp-sticker">CLEVER!</span>}
        </aside>
        <section className="dp-scoring-panel">
          <div className="dp-panel-title"><div><span className="dp-kicker">Weighted rubric</span><h2>{direction === "control" ? "Evaluation matrix" : "Rate each category"}</h2></div>{direction === "control" && <strong>73 / 100</strong>}</div>
          <ScoreControls direction={direction} />
          <label className="dp-notes"><span>Private notes</span><textarea readOnly value="Strong civic value and a clear path to adoption." /></label>
          <div className="dp-score-actions"><button className="dp-secondary">Save draft</button><span><Glyph name="shield" /> Saved privately</span><button className="dp-primary">Next team <Glyph name="arrow" /></button></div>
        </section>
      </div>
    </ScreenShell>
  );
}

function ScreenShell({ active, direction, children, fullWidth = false, festivalScreen }: { active: Screen; direction: Direction; children: ReactNode; fullWidth?: boolean; festivalScreen?: Screen }) {
  const isFullWidth = fullWidth || Boolean(festivalScreen);
  const festivalClass = festivalScreen ? ` is-festival-screen is-festival-${festivalScreen}` : "";
  return (
    <div className={`dp-app-frame${fullWidth ? " is-festival-home" : ""}${festivalClass}`}>
      <AppHeader direction={direction} active={active} />
      <div className={`dp-app-body${isFullWidth ? " dp-app-body--full" : ""}`}>{!isFullWidth && <SideNav active={active} />}<main>{children}</main></div>
    </div>
  );
}

export function DesignPreview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDirection = directions.some((item) => item.id === searchParams.get("direction"))
    ? searchParams.get("direction") as Direction
    : "gallery";
  const initialScreen = screens.some((item) => item.id === searchParams.get("screen"))
    ? searchParams.get("screen") as Screen
    : "home";
  const [direction, setDirectionState] = useState<Direction>(initialDirection);
  const [screen, setScreenState] = useState<Screen>(initialScreen);
  const current = directions.find((item) => item.id === direction) ?? directions[0];
  const setPreviewState = (nextDirection: Direction, nextScreen: Screen) => {
    setDirectionState(nextDirection);
    setScreenState(nextScreen);
    setSearchParams({ direction: nextDirection, screen: nextScreen }, { replace: true });
  };

  return (
    <div className={`design-preview design-preview--${direction}`}>
      <header className="dp-lab-header">
        <div><ProductMark /><span>Design lab</span></div>
        <p>Interactive concept · Dummy data · No actions are saved</p>
        <Link to="/">Back to product</Link>
      </header>
      <section className="dp-lab-controls" aria-label="Design preview controls">
        <div className="dp-direction-tabs" role="tablist" aria-label="Design directions">
          {directions.map((item) => <button key={item.id} role="tab" aria-selected={direction === item.id} className={direction === item.id ? "is-active" : ""} onClick={() => setPreviewState(item.id, screen)}><small>{item.eyebrow}</small><strong>{item.label}</strong></button>)}
        </div>
        <div className="dp-control-bottom">
          <div aria-live="polite"><span>Direction {directions.findIndex((item) => item.id === direction) + 1} of 3</span><h1>{current.label}</h1><p>{current.description}</p></div>
          <div className="dp-screen-tabs" role="tablist" aria-label="Preview screens">
            {screens.map((item) => <button key={item.id} role="tab" aria-selected={screen === item.id} className={screen === item.id ? "is-active" : ""} onClick={() => setPreviewState(direction, item.id)}>{item.label}</button>)}
          </div>
        </div>
      </section>
      <section className="dp-stage">
        {screen === "home" && <HomeScreen direction={direction} />}
        {screen === "create" && <CreateScreen direction={direction} />}
        {screen === "score" && <ScoreScreen direction={direction} />}
      </section>
      <footer className="dp-lab-footer"><span>Use the controls above to compare the same workflow across all three directions.</span><span>Preview route: /design-preview</span></footer>
    </div>
  );
}
