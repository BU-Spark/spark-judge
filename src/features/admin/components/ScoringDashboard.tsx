import { useState } from "react";

export function ScoringDashboard({
  scores,
  viewMode,
  setViewMode,
}: {
  scores: {
    teamRankings: any[];
    categoryRankings: Record<string, any[]>;
    judgeBreakdown: any[];
    categories: string[];
  };
  viewMode: "table" | "chart";
  setViewMode: (mode: "table" | "chart") => void;
}) {
  const [sortColumn, setSortColumn] = useState<string>("averageScore");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedRankings = [...scores.teamRankings].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case "name":
        comparison = a.team.name.localeCompare(b.team.name);
        break;
      case "averageScore":
        comparison = a.averageScore - b.averageScore;
        break;
      case "judges":
        comparison = a.judgeCount - b.judgeCount;
        break;
      default:
        if (scores.categories.includes(sortColumn)) {
          const aScore = a.categoryAverages[sortColumn] || 0;
          const bScore = b.categoryAverages[sortColumn] || 0;
          comparison = aScore - bScore;
        }
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return (
        <svg
          className="w-4 h-4 inline-block ml-1 text-muted-foreground opacity-30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="w-4 h-4 inline-block ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 inline-block ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card-static p-6 bg-card">
        <h4 className="text-xl font-heading font-bold text-foreground mb-4">Overall Rankings</h4>
        <div className="max-h-[52vh] overflow-auto">
          <table className="min-w-full text-left">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">Rank</th>
                <th
                  className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  onClick={() => handleSort("name")}
                >
                  Team Name
                  <SortIcon column="name" />
                </th>
                <th
                  className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  onClick={() => handleSort("averageScore")}
                >
                  Avg Score
                  <SortIcon column="averageScore" />
                </th>
                <th
                  className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  onClick={() => handleSort("judges")}
                >
                  Judges
                  <SortIcon column="judges" />
                </th>
                {scores.categories.map((cat) => (
                  <th
                    key={cat}
                    className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide cursor-pointer hover:bg-muted/30 transition-colors select-none"
                    onClick={() => handleSort(cat)}
                  >
                    {cat}
                    <SortIcon column={cat} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRankings.map((ranking, index) => (
                <tr key={ranking.team._id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-foreground">#{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-foreground">{ranking.team.name}</td>
                  <td className="px-6 py-4 text-sm font-mono text-foreground">
                    {ranking.averageScore.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{ranking.judgeCount}</td>
                  {scores.categories.map((cat) => (
                    <td key={cat} className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {ranking.categoryAverages[cat]?.toFixed(2) || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
