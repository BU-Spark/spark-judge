import { EventTabs } from "./EventTabs";
import type { EventManagementTab } from "../types";

export function EventWorkspaceHeader({
  title,
  subtitle,
  activeTab,
  onTabChange,
}: {
  title: string;
  subtitle: string;
  activeTab: EventManagementTab;
  onTabChange: (tab: EventManagementTab) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl fi-zone font-bold fi-ink">{title}</h1>
        <p className="text-sm fi-muted">{subtitle}</p>
      </div>
      <EventTabs activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
