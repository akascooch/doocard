import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Database Reset Workflow Script
 * 
 * This script provides a professional reset workflow for two PostgreSQL databases:
 * - MOVA (production / real data)
 * - MOVA_TEST (testing)
 * 
 * Features:
 * - Dual database support with separate configurations
 * - Production safety with explicit confirmation flags
 * - Schema preservation using Prisma migrate reset
 * - Comprehensive error handling and logging
 * - Detailed status reporting
 */

interface DatabaseConfig {
  name: string;
  url: string;
  isProduction: boolean;
}

interface ResetOptions {
  resetTest: boolean;
  resetProduction: boolean;
  confirmProduction: boolean;
  dryRun: boolean;
}

class DatabaseResetWorkflow {
  private testConfig: DatabaseConfig;
  private productionConfig: DatabaseConfig;
  private options: ResetOptions;

  constructor(options: ResetOptions) {
    this.options = options;
    this.testConfig = {
      name: 'MOVA_TEST',
      url: process.env.DATABASE_URL_TEST || '',
      isProduction: false
    };
    this.productionConfig = {
      name: 'MOVA',
      url: process.env.DATABASE_URL || '',
      isProduction: true
    };

    this.validateConfiguration();
  }

  /**
   * Validate database configuration and environment variables
   */
  private validateConfiguration(): void {
    console.log('🔍 Validating database configuration...');

    if (this.options.resetTest && !this.testConfig.url) {
      throw new Error('❌ DATABASE_URL_TEST environment variable is not set');
    }

    if (this.options.resetProduction && !this.productionConfig.url) {
      throw new Error('❌ DATABASE_URL environment variable is not set');
    }

    if (this.options.resetProduction && !this.options.confirmProduction) {
      throw new Error('❌ Production reset requires --confirm flag for safety');
    }

    // Validate database URLs
    if (this.options.resetTest) {
      this.validateDatabaseUrl(this.testConfig.url, 'MOVA_TEST');
    }

    if (this.options.resetProduction) {
      this.validateDatabaseUrl(this.productionConfig.url, 'MOVA');
    }

    console.log('✅ Database configuration validated');
  }

  /**
   * Validate database URL format
   */
  private validateDatabaseUrl(url: string, dbName: string): void {
    if (!url.startsWith('postgresql://')) {
      throw new Error(`❌ Invalid DATABASE_URL format for ${dbName}. Must start with 'postgresql://'`);
    }

    // Extract database name from URL
    const urlParts = url.split('/');
    const databaseName = urlParts[urlParts.length - 1].split('?')[0];
    
    if (dbName === 'MOVA' && !databaseName.includes('MOVA')) {
      console.warn(`⚠️  Warning: Database name '${databaseName}' doesn't contain 'MOVA'`);
    }
    
    if (dbName === 'MOVA_TEST' && !databaseName.includes('TEST')) {
      console.warn(`⚠️  Warning: Database name '${databaseName}' doesn't contain 'TEST'`);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      console.log(`🔌 Testing connection to ${config.name}...`);
      
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: config.url
          }
        }
      });

      await prisma.$connect();
      await prisma.$disconnect();
      
      console.log(`✅ Connection to ${config.name} successful`);
      return true;
    } catch (error) {
      console.error(`❌ Connection to ${config.name} failed:`, error);
      return false;
    }
  }

  /**
   * Reset a single database using Prisma migrate reset
   */
  private async resetDatabase(config: DatabaseConfig): Promise<void> {
    const { name, url, isProduction } = config;
    
    console.log(`\n🔄 Starting reset for ${name}...`);
    console.log(`   Database: ${url.split('@')[1]?.split('/')[0] || 'unknown'}`);
    console.log(`   Type: ${isProduction ? 'PRODUCTION' : 'TEST'}`);
    
    if (this.options.dryRun) {
      console.log(`🔍 DRY RUN: Would reset ${name} database`);
      return;
    }

    try {
      // Set the DATABASE_URL for this reset operation
      process.env.DATABASE_URL = url;
      
      console.log(`   📋 Running Prisma migrate reset...`);
      
      // Use execFileSync + argv array (shell: false) to avoid DEP0190 / injection risk
      const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const result = execFileSync(
        npxBin,
        ['prisma', 'migrate', 'reset', '--force'],
        {
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe',
          encoding: 'utf8',
          shell: false,
          env: process.env,
        },
      );

      console.log(`   ✅ Prisma migrate reset completed for ${name}`);
      console.log(`   📊 Output: ${result.trim()}`);

      // Verify schema integrity
      await this.verifySchemaIntegrity(config);
      
    } catch (error) {
      console.error(`❌ Failed to reset ${name}:`, error);
      throw new Error(`Database reset failed for ${name}: ${error}`);
    }
  }

  /**
   * Verify schema integrity after reset
   */
  private async verifySchemaIntegrity(config: DatabaseConfig): Promise<void> {
    try {
      console.log(`   🔍 Verifying schema integrity for ${config.name}...`);
      
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: config.url
          }
        }
      });

      // Test basic operations
      await prisma.$connect();
      
      // Check if we can query the database
      const userCount = await prisma.user.count();
      console.log(`   ✅ Schema verification successful - ${userCount} users found`);
      
      await prisma.$disconnect();
      
    } catch (error) {
      console.error(`❌ Schema verification failed for ${config.name}:`, error);
      throw new Error(`Schema verification failed for ${config.name}: ${error}`);
    }
  }

  /**
   * Get database statistics
   */
  private async getDatabaseStats(config: DatabaseConfig): Promise<void> {
    try {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: config.url
          }
        }
      });

      await prisma.$connect();
      
      const stats = {
        users: await prisma.user.count(),
        customers: await prisma.customer.count(),
        employees: await prisma.employee.count(),
        services: await prisma.service.count(),
        appointments: await prisma.appointment.count(),
        transactions: await prisma.transaction.count()
      };

      console.log(`   📊 ${config.name} Statistics:`);
      console.log(`      Users: ${stats.users}`);
      console.log(`      Customers: ${stats.customers}`);
      console.log(`      Employees: ${stats.employees}`);
      console.log(`      Services: ${stats.services}`);
      console.log(`      Appointments: ${stats.appointments}`);
      console.log(`      Transactions: ${stats.transactions}`);

      await prisma.$disconnect();
      
    } catch (error) {
      console.error(`❌ Failed to get statistics for ${config.name}:`, error);
    }
  }

  /**
   * Main reset workflow
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Database Reset Workflow');
    console.log('=====================================');
    
    const startTime = Date.now();
    
    try {
      // Test connections first
      if (this.options.resetTest) {
        const testConnected = await this.testConnection(this.testConfig);
        if (!testConnected) {
          throw new Error('Failed to connect to test database');
        }
      }

      if (this.options.resetProduction) {
        const prodConnected = await this.testConnection(this.productionConfig);
        if (!prodConnected) {
          throw new Error('Failed to connect to production database');
        }
      }

      // Show current statistics
      if (this.options.resetTest) {
        await this.getDatabaseStats(this.testConfig);
      }
      
      if (this.options.resetProduction) {
        await this.getDatabaseStats(this.productionConfig);
      }

      // Reset test database first
      if (this.options.resetTest) {
        await this.resetDatabase(this.testConfig);
      }

      // Reset production database
      if (this.options.resetProduction) {
        console.log('\n⚠️  PRODUCTION RESET WARNING ⚠️');
        console.log('   This will reset the PRODUCTION database!');
        console.log('   All data will be lost and recreated from migrations.');
        console.log('   Proceeding in 3 seconds...');
        
        if (!this.options.dryRun) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        await this.resetDatabase(this.productionConfig);
      }

      // Show final statistics
      console.log('\n📊 Final Database Statistics:');
      if (this.options.resetTest) {
        await this.getDatabaseStats(this.testConfig);
      }
      
      if (this.options.resetProduction) {
        await this.getDatabaseStats(this.productionConfig);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n🎉 Database reset workflow completed successfully in ${duration}s`);
      
      if (this.options.dryRun) {
        console.log('🔍 This was a dry run - no data was actually modified');
      }

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ Database reset workflow failed after ${duration}s`);
      console.error('Error:', error);
      throw error;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): ResetOptions {
  const args = process.argv.slice(2);
  
  const options: ResetOptions = {
    resetTest: false,
    resetProduction: false,
    confirmProduction: false,
    dryRun: false
  };

  for (const arg of args) {
    switch (arg) {
      case '--test':
        options.resetTest = true;
        break;
      case '--production':
        options.resetProduction = true;
        break;
      case '--both':
        options.resetTest = true;
        options.resetProduction = true;
        break;
      case '--confirm':
        options.confirmProduction = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Database Reset Workflow

Usage:
  npm run db:reset:test                    # Reset only MOVA_TEST
  npm run db:reset:both -- --confirm       # Reset both MOVA and MOVA_TEST
  ts-node resetDatabases.ts --test         # Reset test database
  ts-node resetDatabases.ts --both --confirm # Reset both databases
  ts-node resetDatabases.ts --test --dry-run # Dry run test database

Options:
  --test        Reset only MOVA_TEST database
  --production  Reset only MOVA database (requires --confirm)
  --both        Reset both databases (requires --confirm for production)
  --confirm     Confirm production database reset
  --dry-run     Preview what would be done without making changes
  --help        Show this help message

Safety Notes:
  - Production reset ALWAYS requires --confirm flag
  - Test database can be reset without confirmation
  - Use --dry-run to preview changes before executing
  - Always backup production data before resetting
        `);
        process.exit(0);
        break;
    }
  }

  // Default to test database if no specific option is provided
  if (!options.resetTest && !options.resetProduction) {
    options.resetTest = true;
  }

  return options;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const options = parseArguments();
    const workflow = new DatabaseResetWorkflow(options);
    await workflow.run();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { DatabaseResetWorkflow, ResetOptions };

// Run if executed directly
if (require.main === module) {
  main();
}
