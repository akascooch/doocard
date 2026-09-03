/**
 * Personal tip: 100% of entered tip goes to the selected SERVICE staff.
 * Team tip: 100% equal split among selected eligible SERVICE members.
 * Non-SERVICE roles (BARBER/EMPLOYEE, ADMIN, ACCOUNTANT, …) never receive tip allocations.
 */
export const TIP_PERSONAL_RECIPIENT_PERCENT = 100;
/** @deprecated TEAM tips no longer allocate any share to barbers. Always 0. */
export const TIP_TEAM_BARBER_PERCENT = 0;
export const TIP_TEAM_SERVICE_POOL_PERCENT = 100;

/** @deprecated Use TIP_PERSONAL_RECIPIENT_PERCENT / team split helpers. Kept for transitional FE labels. */
export const TIP_STAFF_SHARE_PERCENT = 100;
export const TIP_SALON_SHARE_PERCENT = 0;

export const CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID = 10;
