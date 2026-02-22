import type { ReactNode } from "react";

export function TeamsTab({
  teamCount,
  isPageLayout,
  showAddTeam,
  onOpenCreateTeam,
  teamListContent,
  addTeamPanel,
}: {
  teamCount: number;
  isPageLayout: boolean;
  showAddTeam: boolean;
  onOpenCreateTeam: () => void;
  teamListContent: ReactNode;
  addTeamPanel: ReactNode;
}) {
  return (
    <div className="card-static p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Teams ({teamCount})
        </h3>
        <button onClick={onOpenCreateTeam} className="btn-primary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Team
        </button>
      </div>
      {isPageLayout ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(18rem,22rem)_1fr] gap-4">
          <div className="min-w-0">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Team List</p>
              </div>
              <div className="max-h-[30rem] overflow-y-auto divide-y divide-border">
                {teamListContent}
              </div>
            </div>
          </div>
          <div className="min-w-0 relative">
            {showAddTeam ? (
              addTeamPanel
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full min-h-[300px] rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Select a team to edit or create a new one.
                </p>
                <button type="button" onClick={onOpenCreateTeam} className="btn-primary">
                  Create Team
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">{teamListContent}</div>
      )}
    </div>
  );
}
