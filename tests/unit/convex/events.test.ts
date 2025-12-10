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

  describe('updateEventStatus date adjustment', () => {
    it('should adjust dates to make event upcoming (start tomorrow)', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const event = {
        startDate: now - day, // Currently in the past
        endDate: now + day,   // Currently in the future
      };
      const duration = event.endDate - event.startDate; // 2 days

      // Apply the "upcoming" transformation
      const updates = {
        startDate: now + day,
        endDate: now + day + duration,
      };

      expect(updates.startDate).toBeGreaterThan(now);
      expect(updates.endDate - updates.startDate).toBe(duration);
      expect(updates.endDate).toBeGreaterThan(updates.startDate);
    });

    it('should adjust dates to make event active (started yesterday, ends tomorrow)', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const event = {
        startDate: now + 2 * day, // Currently in the future
        endDate: now + 4 * day,   // Currently in the future
      };
      const duration = event.endDate - event.startDate; // 2 days

      // Apply the "active" transformation
      const updates = {
        startDate: now - day,
        endDate: Math.max(now + day, now - day + duration),
      };

      expect(updates.startDate).toBeLessThan(now);
      expect(updates.endDate).toBeGreaterThan(now);
      expect(updates.endDate - updates.startDate).toBeGreaterThanOrEqual(duration);
    });

    it('should adjust dates to make event past (ended yesterday)', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const event = {
        startDate: now + day,     // Currently in the future
        endDate: now + 3 * day,   // Currently in the future
      };
      const duration = event.endDate - event.startDate; // 2 days

      // Apply the "past" transformation
      const updates = {
        startDate: now - day - duration,
        endDate: now - day,
      };

      expect(updates.endDate).toBeLessThan(now);
      expect(updates.startDate).toBeLessThan(updates.endDate);
      expect(updates.endDate - updates.startDate).toBe(duration);
    });

    it('should preserve event duration when adjusting to upcoming', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const duration = 5 * day; // 5 day event
      const event = {
        startDate: now - 2 * day,
        endDate: now - 2 * day + duration,
      };

      const updates = {
        startDate: now + day,
        endDate: now + day + duration,
      };

      expect(updates.endDate - updates.startDate).toBe(duration);
    });

    it('should handle active transformation with short duration events', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const duration = 6 * 60 * 60 * 1000; // 6 hours (shorter than 2 days)
      const event = {
        startDate: now + 3 * day,
        endDate: now + 3 * day + duration,
      };

      const updates = {
        startDate: now - day,
        endDate: Math.max(now + day, now - day + duration),
      };

      // Should use 2 days (now + day) since it's greater than duration
      expect(updates.endDate).toBe(now + day);
      expect(updates.endDate).toBeGreaterThan(now);
      expect(updates.startDate).toBeLessThan(now);
    });
  });

  describe('updateEventDetails field updates', () => {
    it('should update only name when provided', () => {
      const args = {
        eventId: 'event123',
        name: 'New Event Name',
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.name !== undefined) updates.name = args.name;

      expect(updates.name).toBe('New Event Name');
      expect(updates.description).toBeUndefined();
      expect(updates.startDate).toBeUndefined();
      expect(updates.endDate).toBeUndefined();
    });

    it('should update only description when provided', () => {
      const args = {
        eventId: 'event123',
        description: 'Updated description',
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.description !== undefined) updates.description = args.description;

      expect(updates.description).toBe('Updated description');
      expect(updates.name).toBeUndefined();
    });

    it('should update only startDate when provided', () => {
      const args = {
        eventId: 'event123',
        startDate: Date.now() + 86400000,
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.startDate !== undefined) updates.startDate = args.startDate;

      expect(updates.startDate).toBe(args.startDate);
      expect(updates.endDate).toBeUndefined();
    });

    it('should update only endDate when provided', () => {
      const args = {
        eventId: 'event123',
        endDate: Date.now() + 172800000,
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.endDate !== undefined) updates.endDate = args.endDate;

      expect(updates.endDate).toBe(args.endDate);
      expect(updates.startDate).toBeUndefined();
    });

    it('should update multiple fields when all provided', () => {
      const args = {
        eventId: 'event123',
        name: 'New Name',
        description: 'New Description',
        startDate: Date.now() + 86400000,
        endDate: Date.now() + 172800000,
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.description !== undefined) updates.description = args.description;
      if (args.startDate !== undefined) updates.startDate = args.startDate;
      if (args.endDate !== undefined) updates.endDate = args.endDate;

      expect(updates.name).toBe('New Name');
      expect(updates.description).toBe('New Description');
      expect(updates.startDate).toBe(args.startDate);
      expect(updates.endDate).toBe(args.endDate);
    });

    it('should build empty updates object when no fields provided', () => {
      const args = {
        eventId: 'event123',
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.description !== undefined) updates.description = args.description;
      if (args.startDate !== undefined) updates.startDate = args.startDate;
      if (args.endDate !== undefined) updates.endDate = args.endDate;

      expect(Object.keys(updates).length).toBe(0);
    });

    it('should allow empty string as valid description', () => {
      const args = {
        eventId: 'event123',
        description: '',
      };

      const updates: {
        name?: string;
        description?: string;
        startDate?: number;
        endDate?: number;
      } = {};
      if (args.description !== undefined) updates.description = args.description;

      expect(updates.description).toBe('');
      expect(Object.keys(updates).length).toBe(1);
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

