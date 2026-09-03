# Manual SQL migrations (NOT applied by `prisma migrate`)

These scripts are **not** tracked in `_prisma_migrations`. They were legacy one-off changes
from before the current Prisma migration history. Run only after reviewing against the live
schema — many statements reference removed tables (`barbers`, `tip_transactions`).

Do **not** place ad-hoc SQL in `prisma/migrations/` unless it is a proper Prisma migration folder.
