import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { EventManagementTab, ScoresView } from "../types";

const VALID_TABS: readonly EventManagementTab[] = ["details", "teams", "prizes", "scores", "winners"];
const VALID_SCORES_VIEWS: readonly ScoresView[] = ["overview", "winners"];

function normalizeTab(raw: string | null): EventManagementTab {
  if (raw && VALID_TABS.includes(raw as EventManagementTab)) {
    return raw as EventManagementTab;
  }
  return "details";
}

function normalizeScoresView(raw: string | null): ScoresView {
  if (raw && VALID_SCORES_VIEWS.includes(raw as ScoresView)) {
    return raw as ScoresView;
  }
  return "overview";
}

export function useEventWorkspaceState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = useMemo(
    () => normalizeTab(searchParams.get("tab")),
    [searchParams]
  );

  const scoresView = useMemo(
    () => normalizeScoresView(searchParams.get("scoresView")),
    [searchParams]
  );

  const setTab = useCallback(
    (nextTab: EventManagementTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", nextTab);
        if (nextTab !== "scores") {
          next.delete("scoresView");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const setScoresView = useCallback(
    (nextView: ScoresView) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "scores");
        if (nextView === "overview") {
          next.delete("scoresView");
        } else {
          next.set("scoresView", nextView);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  return {
    tab,
    scoresView,
    setTab,
    setScoresView,
  };
}
