import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { EventManagementTab, ScoresView } from "../types";

const VALID_TABS: readonly EventManagementTab[] = [
  "overview",
  "setup",
  "details",
  "teams",
  "prizes",
  "scores",
  "winners",
];
const VALID_SCORES_VIEWS: readonly ScoresView[] = ["overview", "winners"];

function normalizeTab(raw: string | null): EventManagementTab {
  if (raw === "results") return "winners";
  if (raw && VALID_TABS.includes(raw as EventManagementTab)) {
    return raw as EventManagementTab;
  }
  // Hackathons land on Overview; other formats redirect it to Settings.
  return "overview";
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
    () =>
      searchParams.get("tab") === "scores" &&
      searchParams.get("scoresView") === "winners"
        ? "winners"
        : normalizeTab(searchParams.get("tab")),
    [searchParams],
  );

  const scoresView = useMemo(
    () =>
      searchParams.get("resultView") === "choose"
        ? "winners"
        : normalizeScoresView(searchParams.get("scoresView")),
    [searchParams],
  );

  const setTab = useCallback(
    (nextTab: EventManagementTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", nextTab === "winners" ? "results" : nextTab);
        next.delete("resultView");
        next.delete("scoresView");
        return next;
      });
    },
    [setSearchParams],
  );

  const setScoresView = useCallback(
    (nextView: ScoresView) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "results");
        next.delete("scoresView");
        if (nextView === "overview") {
          next.delete("resultView");
        } else {
          next.set("resultView", "choose");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return {
    tab,
    scoresView,
    setTab,
    setScoresView,
  };
}
