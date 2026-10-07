import { describe, expect, it } from 'vitest';
import { isProjectMember } from '../../../convex/teamMembership';

describe('project membership', () => {
  it('recognizes imported teammates by normalized email without a participant record', () => {
    expect(isProjectMember({ entrantEmails: [' Student@BU.EDU '] }, 'student', 'student@bu.edu')).toBe(true);
  });
  it('recognizes the submitter even if their account email changed', () => {
    expect(isProjectMember({ submittedBy: 'student' }, 'student', 'new@bu.edu')).toBe(true);
  });
  it('does not count unrelated users or missing emails', () => {
    expect(isProjectMember({ entrantEmails: ['other@bu.edu'] }, 'student', 'student@bu.edu')).toBe(false);
    expect(isProjectMember({}, 'student')).toBe(false);
  });
});
