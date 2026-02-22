import type { EventManagementTab } from "../types";

export function EventTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: EventManagementTab;
  onTabChange: (tab: EventManagementTab) => void;
}) {
  const tabs: EventManagementTab[] = ["details", "teams", "scores"];

  return (
    <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-card/70 p-1">
      {tabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        );
      })}
    </div>
  );
}
