import { hideForeignCustomerNotes } from './appointment-access.util';

describe('hideForeignCustomerNotes', () => {
  it('keeps notes for the preferred barber and strips them for a shared-appointment reader', () => {
    const row = {
      id: 1,
      customer: { preferredEmployeeId: 9, notes: 'private', user: { name: 'ن' } },
    };

    expect(hideForeignCustomerNotes(row, 9).customer?.notes).toBe('private');
    const shared = hideForeignCustomerNotes(row, 7);
    expect(shared.customer?.notes).toBeNull();
    expect(shared.customer?.user).toEqual({ name: 'ن' });
    expect(row.customer.notes).toBe('private');
  });
});
