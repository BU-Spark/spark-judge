import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { SignInDialog } from "../auth/SignInDialog";
import "./homepage-workspace.css";
import { OPEN_SIGN_IN_EVENT } from "../../lib/signIn";

export function PlatformHeader({ homepage = false }: { homepage?: boolean }) {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const { signOut } = useAuthActions();
  const [signInOpen, setSignInOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const open = () => setSignInOpen(true);
    window.addEventListener(OPEN_SIGN_IN_EVENT, open);
    return () => window.removeEventListener(OPEN_SIGN_IN_EVENT, open);
  }, []);
  useEffect(() => {
    if (user) setSignInOpen(false);
  }, [user]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const close = () => {
      if (media.matches) setNavOpen(false);
    };
    close();
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  const closeNav = () => setNavOpen(false);

  return (
    <>
      <header className={`hp-header${navOpen ? " hp-header--nav-open" : ""}`}>
        <Link className="hp-brand" to="/" onClick={closeNav}>
          <img className="hp-brand-mark" src="/brand/hackjudge-mark.png" alt="" width={36} height={36} />
          HackJudge
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className="hp-nav-toggle"
          aria-expanded={navOpen}
          aria-controls={navId}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span className="sr-only">{navOpen ? "Close menu" : "Open menu"}</span>
          <span className="hp-nav-toggle-bars" aria-hidden="true" />
        </button>
        <nav id={navId} className="hp-header-actions" aria-label="Primary">
          <a href={homepage ? "#past-events" : "/"} onClick={closeNav}>
            {homepage ? "Past events" : "All events"}
          </a>
          {user ? (
            <details className="hp-account-menu">
              <summary>
                My account <DirectionIcon direction="down" />
              </summary>
              <div className="hp-account-panel">
                <span>{user.name || user.email}</span>
                <Link to="/profile" onClick={closeNav}>Profile</Link>
                {isAdmin && <Link to="/admin" onClick={closeNav}>Admin</Link>}
                <button
                  onClick={() => {
                    closeNav();
                    void signOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <button
              className="hp-sign-in"
              disabled={user === undefined}
              onClick={() => {
                closeNav();
                setSignInOpen(true);
              }}
            >
              Sign in <DirectionIcon />
            </button>
          )}
        </nav>
      </header>
      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
