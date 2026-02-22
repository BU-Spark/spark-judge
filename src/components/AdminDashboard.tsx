// Legacy compatibility barrel for admin internals.
// Route-level admin pages now live under src/features/admin/routes.

export {
  EventManagementModal,
  AddTeamModal,
  SelectWinnersModal,
  PrizeWinnersWizardModal,
  ScoringDashboard,
  type EventManagementTab,
  type ScoresSubview,
} from "../features/admin/legacy/AdminLegacy";
