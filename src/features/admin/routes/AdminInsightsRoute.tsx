import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";

type InsightCardProps = {
  label: string;
  value: number;
  subtitle?: string;
};

function InsightCard({ label, value, subtitle }: InsightCardProps) {
  return (
    <article className="card-static p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <p className="mt-2 text-3xl font-heading font-bold text-foreground">
        {value.toLocaleString()}
      </p>
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </article>
  );
}

export function AdminInsightsRoute() {
  const latestEvent = useQuery(api.events.getDefaultEventForInsights);
  const insights = useQuery(
    api.events.getAdminInsights,
    latestEvent
      ? {
          eventId: latestEvent.eventId,
          paginationOpts: { numItems: 256, cursor: null },
        }
      : "skip"
  );

  if (latestEvent === undefined || (latestEvent && insights === undefined)) {
    return <LoadingState label="Loading platform insights..." />;
  }

  if (!latestEvent || !insights) {
    return (
      <ErrorState
        title="Insights unavailable"
        description="Insights are unavailable right now."
      />
    );
  }

  return (
    <div className="h-full min-h-[24rem] flex flex-col p-4 sm:p-6 gap-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Platform Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Snapshot for {latestEvent.eventName}.
          </p>
        </div>
        <Link
          to="/admin"
          aria-label="Back to Workspace"
          className="btn-ghost px-2 sm:px-3"
        >
          Back to Workspace
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          label="Total Events"
          value={insights.totalEvents}
          subtitle={`${insights.upcomingEvents} upcoming · ${insights.activeEvents} active · ${insights.pastEvents} past`}
        />
        <InsightCard
          label="Judge Registrations"
          value={insights.judgeRegistrations}
          subtitle={`${insights.judgeRegistrationsWithScores} registrations have submitted scores`}
        />
        <InsightCard
          label="Score Submissions"
          value={insights.totalScoreSubmissions}
          subtitle="Total judging score entries submitted"
        />
        <InsightCard
          label="Ballots Submitted"
          value={insights.totalBallotsSubmitted}
          subtitle={`${insights.uniqueVoters} unique voters`}
        />
        <InsightCard
          label="Appreciations"
          value={insights.totalAppreciations}
          subtitle={`${insights.uniqueAppreciators} unique attendees appreciating`}
        />
      </section>
    </div>
  );
}
