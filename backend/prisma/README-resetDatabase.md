# Database Reset Script

This script safely deletes all records from every table in the database while maintaining referential integrity.

## Features

- ✅ **Safe Deletion Order**: Deletes child entities before parent entities
- ✅ **Transaction Safety**: All operations wrapped in a database transaction
- ✅ **Dry Run Mode**: Preview what would be deleted without actually deleting
- ✅ **Confirmation Required**: Prevents accidental data loss
- ✅ **Comprehensive Logging**: Detailed output of what's being deleted
- ✅ **Error Handling**: Proper error handling and cleanup

## Usage

### Reset Database (Deletes All Data)
```bash
# From project root
npm run db:reset

# From backend directory
npm run prisma:reset

# Direct execution
ts-node prisma/resetDatabase.ts --confirm
```

### Dry Run (Preview Only)
```bash
# From project root
npm run db:reset:dry

# From backend directory
npm run prisma:reset:dry

# Direct execution
ts-node prisma/resetDatabase.ts --dry-run
```

### Programmatic Usage
```typescript
import { resetDatabase } from './prisma/resetDatabase';

// Reset database
await resetDatabase(true);

// Dry run
await resetDatabase(true, true);
```

## Deletion Order

The script deletes records in the following order to maintain referential integrity:

1. **Junction Tables & Dependencies**:
   - `appointmentService` (appointment-service relationships)
   - `employeeService` (employee-service relationships)

2. **Dependent Records**:
   - `tip` (tips linked to appointments and employees)
   - `salary` (salaries linked to employees)
   - `transaction` (transactions linked to appointments)
   - `smsLog` (SMS logs linked to users)
   - `permission` (permissions linked to users)
   - `dayClosing` (day closings linked to users)

3. **Main Entity Records**:
   - `appointment` (appointments)
   - `customer` (customers)
   - `employee` (employees)
   - `service` (services)
   - `category` (categories)
   - `smsSettings` (SMS settings)
   - `smsTemplate` (SMS templates)
   - `homepageDetails` (homepage content)

4. **User Records** (Last):
   - `user` (users - referenced by many tables)

## Safety Features

- **Confirmation Required**: Script requires `--confirm` flag to actually delete data
- **Dry Run Mode**: Use `--dry-run` to preview what would be deleted
- **Transaction Safety**: All operations are wrapped in a database transaction
- **Error Handling**: Proper error handling with cleanup
- **Logging**: Detailed logging of all operations

## Example Output

```
🔄 Starting database reset...
📊 Deleting junction tables and dependent records...
   ✅ Deleted 15 appointment services
   ✅ Deleted 8 employee services
   ✅ Deleted 25 tips
   ✅ Deleted 12 salaries
   ✅ Deleted 45 transactions
   ✅ Deleted 3 SMS logs
   ✅ Deleted 20 permissions
   ✅ Deleted 5 day closings
📋 Deleting main entity records...
   ✅ Deleted 30 appointments
   ✅ Deleted 15 customers
   ✅ Deleted 5 employees
   ✅ Deleted 10 services
   ✅ Deleted 3 categories
   ✅ Deleted 1 SMS settings
   ✅ Deleted 2 SMS templates
   ✅ Deleted 1 homepage details
👥 Deleting user records...
   ✅ Deleted 20 users
🎉 Database reset completed successfully!
✅ Database reset script completed successfully
🔌 Database connection closed
```

## Warning

⚠️ **This script will permanently delete ALL data from the database!**

- Always backup your data before running
- Use dry-run mode first to preview changes
- Only run in development/testing environments
- Never run in production without proper backups

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure database user has DELETE permissions
2. **Foreign Key Constraints**: Script handles this automatically with proper deletion order
3. **Connection Issues**: Check DATABASE_URL in environment variables
4. **Transaction Timeout**: Large datasets may require longer timeout settings

### Debug Mode

Enable Prisma logging by setting log level in the script:
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```
