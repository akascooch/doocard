# Database Reset Workflow Documentation

## Overview

This document describes the professional database reset workflow for the Doocard project, which supports two PostgreSQL databases:

- **MOVA** - Production database with real data
- **MOVA_TEST** - Testing database for development and testing

## 🚀 Quick Start

### Available Commands

```bash
# Reset only test database (safe, no confirmation needed)
npm run db:reset:test

# Reset both databases (requires confirmation for production)
npm run db:reset:both -- --confirm

# Preview what would be reset (dry run)
npm run db:reset:both:dry
```

## 📋 Command Reference

### Root Level Commands
```bash
npm run db:reset:test              # Reset MOVA_TEST only
npm run db:reset:both -- --confirm # Reset both MOVA and MOVA_TEST
npm run db:reset:both:dry          # Preview both database resets
```

### Backend Level Commands
```bash
npm run prisma:reset:test          # Reset MOVA_TEST only
npm run prisma:reset:both -- --confirm # Reset both databases
npm run prisma:reset:both:dry      # Preview both database resets
```

### Direct Script Execution
```bash
# Test database only
ts-node prisma/resetDatabases.ts --test

# Both databases (requires confirmation)
ts-node prisma/resetDatabases.ts --both --confirm

# Dry run for both databases
ts-node prisma/resetDatabases.ts --both --dry-run

# Show help
ts-node prisma/resetDatabases.ts --help
```

## 🔧 Environment Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# Production Database
DATABASE_URL="postgresql://postgres:password@localhost:5433/MOVA?schema=public"

# Test Database
DATABASE_URL_TEST="postgresql://postgres:password@localhost:5433/MOVA_TEST?schema=public"
```

### Database Setup

1. **Create Test Database**:
   ```sql
   CREATE DATABASE "MOVA_TEST";
   ```

2. **Run Migrations on Both Databases**:
   ```bash
   # Set production database
   DATABASE_URL="postgresql://postgres:password@localhost:5433/MOVA?schema=public"
   npm run db:migrate

   # Set test database
   DATABASE_URL="postgresql://postgres:password@localhost:5433/MOVA_TEST?schema=public"
   npm run db:migrate
   ```

## 🛡️ Safety Features

### Production Safety
- **Confirmation Required**: Production reset ALWAYS requires `--confirm` flag
- **Database Validation**: Validates database URLs and names before proceeding
- **Connection Testing**: Tests database connections before attempting reset
- **Warning Messages**: Clear warnings before production operations
- **Dry Run Mode**: Preview changes without making modifications

### Test Database Safety
- **No Confirmation Needed**: Test database can be reset safely
- **Isolated Environment**: Test database is separate from production
- **Schema Preservation**: Uses Prisma migrate reset to maintain schema integrity

## 🔄 Reset Process

### What Happens During Reset

1. **Validation Phase**:
   - Validates environment variables
   - Tests database connections
   - Checks database names and URLs

2. **Statistics Phase**:
   - Shows current database statistics
   - Displays record counts for all tables

3. **Reset Phase**:
   - Runs `prisma migrate reset --force` on each database
   - Drops all data and recreates from migrations
   - Preserves schema structure

4. **Verification Phase**:
   - Verifies schema integrity
   - Tests basic database operations
   - Shows final statistics

### Reset Order
1. **MOVA_TEST** (if requested)
2. **MOVA** (if requested, with confirmation)

## 📊 Typical Development Workflow

### 1. Development Phase
```bash
# Work on test database
npm run db:reset:test

# Run tests
npm run test

# If tests pass, proceed to production
```

### 2. Production Migration
```bash
# Preview what will be reset
npm run db:reset:both:dry

# Reset both databases (after confirming)
npm run db:reset:both -- --confirm

# Verify both databases are clean
npm run db:seed
```

### 3. Emergency Reset
```bash
# Reset only test database (safe)
npm run db:reset:test

# Reset production (requires confirmation)
npm run db:reset:both -- --confirm
```

## 🚨 Safety Guidelines

### ⚠️ Production Database (MOVA)
- **NEVER** reset without explicit confirmation
- **ALWAYS** backup data before resetting
- **VERIFY** you're on the correct environment
- **TEST** on MOVA_TEST first

### ✅ Test Database (MOVA_TEST)
- Safe to reset frequently
- No confirmation required
- Perfect for development and testing
- Can be reset without backup

## 🔍 Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
❌ Connection to MOVA_TEST failed: Error: connect ECONNREFUSED
```
**Solution**: Ensure PostgreSQL is running and database exists

#### 2. Environment Variable Missing
```bash
❌ DATABASE_URL_TEST environment variable is not set
```
**Solution**: Add `DATABASE_URL_TEST` to your `.env` file

#### 3. Production Reset Without Confirmation
```bash
❌ Production reset requires --confirm flag for safety
```
**Solution**: Add `--confirm` flag to the command

#### 4. Invalid Database URL
```bash
❌ Invalid DATABASE_URL format for MOVA. Must start with 'postgresql://'
```
**Solution**: Check your database URL format

### Debug Mode

Enable detailed logging by setting:
```env
LOG_LEVEL=debug
```

## 📈 Monitoring and Logging

### Log Output
The reset workflow provides detailed logging:

```
🚀 Starting Database Reset Workflow
=====================================
🔍 Validating database configuration...
✅ Database configuration validated
🔌 Testing connection to MOVA_TEST...
✅ Connection to MOVA_TEST successful
📊 MOVA_TEST Statistics:
   Users: 15
   Customers: 8
   Employees: 3
   Services: 5
   Appointments: 12
   Transactions: 25

🔄 Starting reset for MOVA_TEST...
   Database: localhost:5433
   Type: TEST
   📋 Running Prisma migrate reset...
   ✅ Prisma migrate reset completed for MOVA_TEST
   🔍 Verifying schema integrity for MOVA_TEST...
   ✅ Schema verification successful - 0 users found

📊 Final Database Statistics:
   Users: 0
   Customers: 0
   Employees: 0
   Services: 0
   Appointments: 0
   Transactions: 0

🎉 Database reset workflow completed successfully in 2.34s
```

## 🔧 Advanced Usage

### Programmatic Usage

```typescript
import { DatabaseResetWorkflow, ResetOptions } from './prisma/resetDatabases';

// Reset test database
const testOptions: ResetOptions = {
  resetTest: true,
  resetProduction: false,
  confirmProduction: false,
  dryRun: false
};

const workflow = new DatabaseResetWorkflow(testOptions);
await workflow.run();
```

### Custom Database URLs

You can override database URLs by setting environment variables:

```bash
DATABASE_URL="postgresql://user:pass@host:port/MOVA?schema=public"
DATABASE_URL_TEST="postgresql://user:pass@host:port/MOVA_TEST?schema=public"
```

## 📚 Best Practices

### 1. Development Workflow
- Always work on MOVA_TEST first
- Reset test database frequently during development
- Use dry-run mode to preview changes
- Test thoroughly before touching production

### 2. Production Workflow
- Backup production data before any reset
- Use dry-run mode to verify what will be reset
- Reset test database first to verify process
- Monitor logs during production reset

### 3. Team Collaboration
- Document any custom reset procedures
- Share environment configuration
- Use consistent database naming
- Maintain separate test and production environments

## 🆘 Emergency Procedures

### If Production Reset Fails
1. Check database connectivity
2. Verify migration files are up to date
3. Check database permissions
4. Review error logs
5. Contact database administrator if needed

### If Test Database Reset Fails
1. Check if database exists
2. Verify connection string
3. Ensure Prisma is properly configured
4. Try manual reset: `npx prisma migrate reset --force`

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review error logs
3. Test with dry-run mode
4. Contact the development team

---

**Last Updated**: 2024-12-21  
**Version**: 1.0.0  
**Compatibility**: NestJS + Prisma + PostgreSQL
