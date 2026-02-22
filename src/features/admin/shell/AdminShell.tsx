import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";

export function AdminShell() {
  const navigate = useNavigate();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.events.isUserAdmin);

  if (loggedInUser === undefined || isAdmin === undefined) {
    return <LoadingState label="Verifying admin access..." />;
  }

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

  if (!isAdmin) {
    return (
      <ErrorState
        title="Access denied"
        description="You need admin privileges to access this dashboard."
        actionLabel="Back to events"
        onAction={() => void navigate("/")}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] px-3 sm:px-4 lg:px-5 py-5">
      <div className="min-h-[calc(100dvh-8rem)]">
        <section className="min-h-0 h-full flex flex-col">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
