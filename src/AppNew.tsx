import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInFormNew";
import { SignOutButton } from "./SignOutButtonNew";
import { Toaster } from "sonner";
import { LandingPage } from "./components/LandingPageNew";
import { EventView } from "./components/EventView";
import { AdminDashboard } from "./components/AdminDashboard";
import { ProfilePage } from "./components/ProfilePage";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";
import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
  const [currentView, setCurrentView] = useState<"landing" | "event" | "admin" | "profile">("landing");
  const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleSelectEvent = (eventId: Id<"events">) => {
    setSelectedEventId(eventId);
    setCurrentView("event");
  };

  const handleBackToLanding = () => {
    setCurrentView("landing");
    setSelectedEventId(null);
  };

  const handleGoToAdmin = () => {
    setCurrentView("admin");
  };

  const handleGoToProfile = () => {
    setCurrentView("profile");
  };

  const renderNavActions = (variant: "desktop" | "mobile") => {
    const baseGhostClass =
      variant === "desktop"
        ? "btn-ghost"
        : "btn-ghost w-full justify-start";
    const signOutClass =
      variant === "desktop"
        ? "btn-ghost hover:text-red-500"
        : "btn-ghost w-full justify-start hover:text-red-500";
    const signInClass =
      variant === "desktop"
        ? "btn-secondary"
        : "btn-secondary w-full justify-center";

    return (
      <>
        {variant === "mobile" && (
          <div className="flex justify-end mb-2">
            <ThemeToggle />
          </div>
        )}
        <Authenticated>
          <button
            onClick={() => {
              handleGoToProfile();
              closeMobileMenu();
            }}
            className={baseGhostClass}
          >
            Profile
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                handleGoToAdmin();
                closeMobileMenu();
              }}
              className={baseGhostClass}
            >
              Admin
            </button>
          )}
          <SignOutButton
            className={signOutClass}
            onClick={variant === "mobile" ? closeMobileMenu : undefined}
          />
        </Authenticated>
        <Unauthenticated>
          <button
            onClick={() => {
              setShowSignIn(true);
              closeMobileMenu();
            }}
            className={signInClass}
          >
            Sign In
          </button>
        </Unauthenticated>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                handleBackToLanding();
                closeMobileMenu();
              }}
              className="text-xl font-heading font-bold hover:text-primary transition-colors text-foreground"
            >
              HackJudge
            </button>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex gap-4 items-center">
                <ThemeToggle />
                {renderNavActions("desktop")}
              </div>
              <button
                type="button"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="fixed inset-0 z-30 bg-transparent" onClick={closeMobileMenu} />
            <div className="relative z-40 px-4 py-6 space-y-2">
              {renderNavActions("mobile")}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Content 
          currentView={currentView}
          selectedEventId={selectedEventId}
          onSelectEvent={handleSelectEvent}
          onBackToLanding={handleBackToLanding}
        />
      </main>

      {/* Toast Notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            border: '1px solid var(--border)',
          },
        }}
      />

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSignIn(false)}
          />
          <div className="relative bg-background rounded-xl p-8 max-w-md w-full shadow-2xl border border-border slide-up">
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">Sign In</h2>
            <SignInForm />
          </div>
        </div>
      )}
    </div>
  );
}

function Content({ 
  currentView, 
  selectedEventId, 
  onSelectEvent,
  onBackToLanding 
}: { 
  currentView: "landing" | "event" | "admin" | "profile";
  selectedEventId: Id<"events"> | null;
  onSelectEvent: (eventId: Id<"events">) => void;
  onBackToLanding: () => void;
}) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (currentView === "profile") {
    return <ProfilePage onSelectEvent={onSelectEvent} onBackToLanding={onBackToLanding} />;
  }

  if (currentView === "admin") {
    if (!loggedInUser) {
      return (
        <div className="max-w-md mx-auto mt-16 px-4">
          <div className="card-static p-8 text-center bg-white dark:bg-zinc-900">
            <h2 className="text-xl font-heading font-bold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to access the admin dashboard.
            </p>
          </div>
        </div>
      );
    }
    return <AdminDashboard onBackToLanding={onBackToLanding} />;
  }

  if (currentView === "event" && selectedEventId) {
    return <EventView eventId={selectedEventId} onBack={onBackToLanding} />;
  }

  return <LandingPage onSelectEvent={onSelectEvent} />;
}
