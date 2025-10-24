<!-- 960968b0-89c5-4dee-a82b-7b5080046ecc 2c4ad9a7-a43c-4a56-a915-7aa87808cbc1 -->
# Wizard-Style Scoring Flow Redesign

## Overview

Transform the EventView scoring experience from a card grid with modals into a DocuSign/TurboTax-style wizard flow where judges score teams sequentially with progress tracking and a final review/submit step.

## Implementation Plan

### 1. Create New ScoringWizard Component

**File**: `src/components/ScoringWizard.tsx`

Create a new full-screen wizard component with these key features:

**State Management**:

- `currentTeamIndex`: Track position in team list
- `draftScores`: Map of teamId to scores (saved locally as judge progresses)
- `completedTeams`: Set of teamIds that have been scored
- Teams sorted alphabetically by name

**UI Layout**:

- **Progress Header** (sticky top):
  - Progress bar showing completion (e.g., "5 of 15 teams scored")
  - Team counter (e.g., "Team 6 of 15")
  - Exit/Close button

- **Team Display Area** (main content):
  - Current team name, description, members
  - Category scoring sliders/buttons (reuse existing scoring UI)
  - Notes/comments field (optional enhancement)

- **Navigation Footer** (sticky bottom):
  - "Previous" button (disabled on first team)
  - "Skip" button (marks team as skipped, moves to next)
  - "Next" button (auto-saves draft, moves to next team)
  - On last team: "Review & Submit" button instead of Next

### 2. Create Summary/Review Component

**Component**: `ScoringSummary` (within ScoringWizard.tsx)

Display before final submission:

- List all teams with their scores
- Show which teams were skipped (allow going back to score them)
- Display total progress (e.g., "14 of 15 teams scored, 1 skipped")
- Edit buttons to jump back to specific teams
- Final "Submit All Scores" button
- "Back to Scoring" button

### 3. Backend Changes

**File**: `convex/scores.ts`

Add new mutation for batch score submission:

```typescript
export const submitBatchScores = mutation({
  args: {
    eventId: v.id("events"),
    scores: v.array(v.object({
      teamId: v.id("teams"),
      categoryScores: v.array(v.object({
        category: v.string(),
        score: v.number(),
      })),
    })),
  },
  // Validate judge status, then insert/update all scores in transaction
});
```

This allows atomic submission of all scores at once.

### 4. Update EventView Integration

**File**: `src/components/EventView.tsx`

Replace the existing scoring UI when event is active:

- Remove the grid of team cards (lines 75-181)
- Add single "Start Scoring" button that launches ScoringWizard
- Show progress summary if draft scores exist: "You've scored 5 of 15 teams. Continue scoring?"
- Keep the existing "Not Registered" check
- Keep admin team management features accessible via different view/tab

### 5. Local Storage for Draft Persistence

Store draft scores in localStorage with key format:

```
scoring_draft_{eventId}_{userId}
```

Structure:

```typescript
{
  scores: Record<teamId, categoryScores>,
  completedTeams: string[],
  lastTeamIndex: number,
  timestamp: number
}
```

Load on mount, save after each Next/Skip action, clear on final submit.

### 6. Key UI/UX Details

**Progress Visualization**:

- Linear progress bar at top (filled portion = scored teams / total teams)
- Circular indicators below showing team position (like pagination dots)
- Green checkmarks on completed teams, gray dots on incomplete

**Navigation Rules**:

- Can navigate backward freely (Previous button)
- Can skip forward (Skip button)
- Can jump to any team from summary page
- Cannot submit until all teams scored OR user confirms skipped teams

**Scoring Interface**:

- Keep existing 1-5 button style for categories
- Default score: 3 for all categories
- Keyboard shortcuts: 1-5 keys to score current category
- Tab to move between categories

**Mobile Responsive**:

- Progress bar remains visible on scroll
- Footer navigation sticky at bottom
- Single column layout on mobile
- Swipe gestures for next/previous (optional)

## Files to Modify

1. **Create**: `src/components/ScoringWizard.tsx` - New wizard component (~400 lines)
2. **Modify**: `src/components/EventView.tsx` - Replace grid with wizard launcher (~50 line change)
3. **Modify**: `convex/scores.ts` - Add batch submission mutation (~40 lines)
4. **Update**: Type definitions if needed for draft score structure

## Testing Considerations

- Test with varying team counts (1 team, 10 teams, 50+ teams)
- Verify localStorage persistence across page refreshes
- Test skip functionality and return-to-skipped flow
- Ensure batch submission is atomic (all-or-nothing)
- Test edge case: all teams skipped, cannot submit

### To-dos

- [ ] Create new ScoringWizard component with progress header, team display area, and navigation footer
- [ ] Build ScoringSummary component for review before final submission
- [ ] Add localStorage logic for draft score persistence and recovery
- [ ] Create submitBatchScores mutation in convex/scores.ts for atomic submission
- [ ] Update EventView to replace grid with wizard launcher and progress indicator
- [ ] Add keyboard navigation (1-5 for scores, arrows for next/prev, Enter to continue)