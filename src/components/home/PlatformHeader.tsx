import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { SignInDialog } from "../auth/SignInDialog";
import "./homepage-workspace.css";

export function PlatformHeader({ homepage = false }: { homepage?: boolean }) {
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const { signOut } = useAuthActions();
  const [signInOpen, setSignInOpen] = useState(false);
  useEffect(() => {
    const open = () => setSignInOpen(true);
    window.addEventListener("hackjudge:open-signin", open);
    return () => window.removeEventListener("hackjudge:open-signin", open);
  }, []);
  useEffect(() => {
    if (user) setSignInOpen(false);
  }, [user]);
  return (
    <>
      <header className="hp-header">
        <Link className="hp-brand" to="/">
          HackJudge
          <span className="hp-brand-dot" aria-hidden="true" />
        </Link>
        <div className="hp-header-actions">
          <a href={homepage ? "#past-events" : "/"}>
            {homepage ? "Past events" : "All events"}
          </a>
          {user ? (
            <details className="hp-account-menu">
              <summary>
                My account <DirectionIcon direction="down" />
              </summary>
              <div className="hp-account-panel">
                <span>{user.name || user.email}</span>
                <Link to="/profile">Profile</Link>
                {isAdmin && <Link to="/admin">Admin</Link>}
                <button onClick={() => void signOut()}>Sign out</button>
              </div>
            </details>
          ) : (
            <button
              className="hp-sign-in"
              disabled={user === undefined}
              onClick={() => setSignInOpen(true)}
            >
              Sign in <DirectionIcon />
            </button>
          )}
        </div>
      </header>
      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
