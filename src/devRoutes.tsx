/**
 * Development-only design review screens. Production builds alias this module
 * to devRoutes.prod.ts (see vite.config.ts), so none of it reaches the bundle.
 */
import { lazy } from "react";

// Typed as nullable to match the production stub, so callers keep their guards.
function devOnly<T>(component: T): T | null {
  return component;
}

export const HomepagePreview = devOnly(lazy(() => import("./components/home/HomepagePreview").then((m) => ({ default: m.HomepagePreview }))));
export const CodeAndTellPreview = devOnly(lazy(() => import("./components/code-and-tell/CodeAndTellPreview").then((m) => ({ default: m.CodeAndTellPreview }))));
export const CodeAndTellVoteTest = devOnly(lazy(() => import("./components/code-and-tell/CodeAndTellVoteTest").then((m) => ({ default: m.CodeAndTellVoteTest }))));
export const ParticipationPreview = devOnly(lazy(() => import("./components/participation/ParticipationPreview").then((m) => ({ default: m.ParticipationPreview }))));
export const DesignPreview = devOnly(lazy(() => import("./features/design-preview/DesignPreview").then((m) => ({ default: m.DesignPreview }))));
export const EventCardPreview = devOnly(lazy(() => import("./components/home/EventCardPreview").then((m) => ({ default: m.EventCardPreview }))));
export const ProjectPreview = devOnly(lazy(() => import("./components/ProjectPreview").then((m) => ({ default: m.ProjectPreview }))));
export const ResultsPreview = devOnly(lazy(() => import("./features/admin/ResultsPreview")));
