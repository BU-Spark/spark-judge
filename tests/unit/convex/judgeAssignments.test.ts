import { describe, it, expect } from 'vitest';
import { assertCanRemoveTeamAssignment } from '../../../convex/judgeAssignments';

describe('judgeAssignments business logic', () => {
  it('does not allow removing an assignment after a score exists', () => {
    expect(() => assertCanRemoveTeamAssignment(true)).toThrow(
      'Cannot remove a team after submitting scores',
    );
    expect(() => assertCanRemoveTeamAssignment(false)).not.toThrow();
  });
  describe('assignment deduplication', () => {
    it('should detect existing assignment', () => {
      const existingAssignments = [
        { judgeId: 'judge1', teamId: 'team1' },
        { judgeId: 'judge1', teamId: 'team2' },
      ];
      const newAssignment = { judgeId: 'judge1', teamId: 'team1' };

      const existing = existingAssignments.find(
        (a) => a.judgeId === newAssignment.judgeId && a.teamId === newAssignment.teamId
      );

      expect(existing).toBeDefined();
    });

    it('should not find existing assignment for different judge', () => {
      const existingAssignments = [
        { judgeId: 'judge1', teamId: 'team1' },
      ];
      const newAssignment = { judgeId: 'judge2', teamId: 'team1' };

      const existing = existingAssignments.find(
        (a) => a.judgeId === newAssignment.judgeId && a.teamId === newAssignment.teamId
      );

      expect(existing).toBeUndefined();
    });

    it('should not find existing assignment for different team', () => {
      const existingAssignments = [
        { judgeId: 'judge1', teamId: 'team1' },
      ];
      const newAssignment = { judgeId: 'judge1', teamId: 'team2' };

      const existing = existingAssignments.find(
        (a) => a.judgeId === newAssignment.judgeId && a.teamId === newAssignment.teamId
      );

      expect(existing).toBeUndefined();
    });
  });

  describe('assignment retrieval', () => {
    it('should map assignments to team IDs', () => {
      const assignments = [
        { _id: '1', teamId: 'team1' },
        { _id: '2', teamId: 'team2' },
        { _id: '3', teamId: 'team3' },
      ];

      const teamIds = assignments.map((a) => a.teamId);
      expect(teamIds).toEqual(['team1', 'team2', 'team3']);
    });

    it('should return empty array when no assignments', () => {
      const assignments: Array<{ _id: string; teamId: string }> = [];
      const teamIds = assignments.map((a) => a.teamId);
      expect(teamIds).toEqual([]);
    });
  });
});
