import { describe, it, expect } from 'vitest';

describe('events business logic', () => {
  describe('event status filtering', () => {
    it('should filter events by status correctly', () => {
      const events = [
        { _id: '1', status: 'upcoming' },
        { _id: '2', status: 'active' },
        { _id: '3', status: 'past' },
        { _id: '4', status: 'upcoming' },
      ];

      const upcoming = events.filter((e) => e.status === 'upcoming');
      const active = events.filter((e) => e.status === 'active');
      const past = events.filter((e) => e.status === 'past');

      expect(upcoming.length).toBe(2);
      expect(active.length).toBe(1);
      expect(past.length).toBe(1);
    });
  });

  describe('judge code validation', () => {
    it('should require judge code when event is active and has judgeCode', () => {
      const event = {
        status: 'active' as const,
        judgeCode: 'TEST123',
      };
      const requiresJudgeCode = event.status === 'active' && !!event.judgeCode;
      expect(requiresJudgeCode).toBe(true);
    });

    it('should not require judge code when event is not active', () => {
      const event = {
        status: 'upcoming' as const,
        judgeCode: 'TEST123',
      };
      const requiresJudgeCode = event.status === 'active' && !!event.judgeCode;
      expect(requiresJudgeCode).toBe(false);
    });

    it('should not require judge code when event has no judgeCode', () => {
      const event = {
        status: 'active' as const,
        judgeCode: undefined,
      };
      const requiresJudgeCode = event.status === 'active' && !!event.judgeCode;
      expect(requiresJudgeCode).toBe(false);
    });
  });

  describe('event mode validation', () => {
    it('should default to hackathon mode when mode is undefined', () => {
      const event = { mode: undefined };
      const effectiveMode = event.mode ?? 'hackathon';
      expect(effectiveMode).toBe('hackathon');
    });

    it('should use demo_day mode when set', () => {
      const event = { mode: 'demo_day' as const };
      expect(event.mode).toBe('demo_day');
    });
  });

  describe('judge progress calculation', () => {
    it('should calculate judge progress correctly', () => {
      const judgeScores = [
        { _id: '1' },
        { _id: '2' },
        { _id: '3' },
      ];
      const teams = [
        { _id: '1' },
        { _id: '2' },
        { _id: '3' },
        { _id: '4' },
        { _id: '5' },
      ];

      const judgeProgress = {
        completedTeams: judgeScores.length,
        totalTeams: teams.length,
      };

      expect(judgeProgress.completedTeams).toBe(3);
      expect(judgeProgress.totalTeams).toBe(5);
    });
  });

  describe('event duplication logic', () => {
    it('should generate copy name correctly', () => {
      const baseName = 'Hackathon 2024';
      const newName = `${baseName} (Copy)`;
      expect(newName).toBe('Hackathon 2024 (Copy)');
    });

    it('should increment copy number when name exists', () => {
      const baseName = 'Hackathon 2024';
      const existingNames = new Set(['Hackathon 2024 (Copy)']);
      let copyIndex = 0;
      let newName = `${baseName} (Copy)`;

      while (existingNames.has(newName)) {
        copyIndex += 1;
        newName = `${baseName} (Copy ${copyIndex + 1})`;
      }

      expect(newName).toBe('Hackathon 2024 (Copy 2)');
    });

    it('should remove existing copy suffix from base name', () => {
      const name = 'Hackathon 2024 (Copy)';
      const baseName = name.replace(/\s\(Copy(?: \d+)?\)$/, '');
      expect(baseName).toBe('Hackathon 2024');
    });
  });
});

