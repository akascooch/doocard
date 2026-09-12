import {
  canSelectEmployeeInUi,
  employeeUiIsLocked,
  findEmployeeIdForUser,
} from '../../../frontend/src/lib/appointment-employee-lock';

describe('appointment employee UI lock helpers', () => {
  const employees = [
    { id: 4, userId: 10, user: { id: 10 } },
    { id: 99, userId: 20, user: { id: 20 } },
  ];

  it('locks the selector only for EMPLOYEE role', () => {
    expect(employeeUiIsLocked('EMPLOYEE')).toBe(true);
    expect(employeeUiIsLocked('ADMIN')).toBe(false);
  });

  it('resolves the authenticated employee id from the list', () => {
    expect(findEmployeeIdForUser(employees, 10)).toBe(4);
    expect(findEmployeeIdForUser(employees, 99)).toBeNull();
  });

  it('prevents an employee from selecting another barber in the UI', () => {
    expect(canSelectEmployeeInUi('EMPLOYEE', 99, 4)).toBe(false);
    expect(canSelectEmployeeInUi('EMPLOYEE', 4, 4)).toBe(true);
    expect(canSelectEmployeeInUi('ADMIN', 99, 4)).toBe(true);
  });
});
