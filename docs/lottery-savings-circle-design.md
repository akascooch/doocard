# Lottery / savings circle — design only

Status: not implemented. No tables, cron, or ledger posts exist for this feature.

This note records a safe shape so a later release can add it without mixing it into salon operating expenses, payroll settlement, or the personal ledger.

## Isolation

- New tables only: circle, membership, round, contribution, and an append-only draw audit.
- Do not store rows in `AdminPersonalExpense`, `Transaction` categories used by payroll, or `EmployeeCommissionSettlement`.
- If a deduction is later posted to `transactions`, use a new `sourceType` such as `SAVINGS_CIRCLE` and add that source type to `payrollWithdrawalExclusion` / the operating-expense predicate so the financial-report chart does not count it as a salon expense.
- No cron in this change. A future job must be idempotent per member per Tehran civil month (`unique (membershipId, periodKey)`).

## Open product decisions

Do not build the job until these are confirmed:

- Deduction day and timezone (recommend 09:00 `Asia/Tehran`, once per civil month).
- Fixed rial amount versus a percent, and what happens when the staff balance is short.
- Whether the pot is a salon liability or an off-book staff pool.
- Whether “last participants go first” means last drawn, last paid, or everyone not yet paid in the completed round.

## Fairness sketch

When a round is drawn, persist the candidate id list, a cryptographic seed, the ordered result, the actor, and the time before any balance moves. The next round’s starting order places the previous round’s final participants first, then the rest. Selection must not use an unstored `Math.random()`.
