#!/usr/bin/env ts-node
/**
 * 🧪 COMPREHENSIVE DOOCARD SYSTEM TEST SUITE
 * 
 * Tests all endpoints, functionality, and flows across the entire application
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3001/api';
const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  duration?: number;
}

class DoocardTester {
  private api: AxiosInstance;
  private results: TestResult[] = [];
  private tokens: {
    admin?: string;
    employee?: string;
    customer?: string;
  } = {};

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  private log(emoji: string, message: string) {
    console.log(`${emoji} ${message}`);
  }

  private addResult(category: string, name: string, status: 'PASS' | 'FAIL' | 'SKIP', message?: string, duration?: number) {
    this.results.push({ category, name, status, message, duration });
    
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    const msg = message ? ` - ${message}` : '';
    this.log(icon, `${category} > ${name}${msg}`);
  }

  /**
   * 🔐 Authentication Tests
   */
  async testAuthentication() {
    this.log('🔐', '=== Testing Authentication ===');

    // Test 1: Admin Login
    try {
      const start = Date.now();
      const res = await this.api.post('/auth/login', {
        identifier: '09370504588',
        password: 'Lord7knows',
      });
      
      if ((res.status === 200 || res.status === 201) && res.data.access_token) {
        this.tokens.admin = res.data.access_token;
        this.addResult('Auth', 'Admin Login', 'PASS', `Role: ${res.data.user.role}`, Date.now() - start);
      } else {
        this.addResult('Auth', 'Admin Login', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Auth', 'Admin Login', 'FAIL', err.message);
    }

    // Test 2: Invalid Login
    try {
      const res = await this.api.post('/auth/login', {
        identifier: 'nonexistent@test.com',
        password: 'wrongpassword',
      });
      
      if (res.status === 401) {
        this.addResult('Auth', 'Invalid Login Rejection', 'PASS', 'Correctly rejected');
      } else {
        this.addResult('Auth', 'Invalid Login Rejection', 'FAIL', `Unexpected status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Auth', 'Invalid Login Rejection', 'FAIL', err.message);
    }

    // Test 3: Register with Duplicate Phone (Expected 409)
    try {
      const res = await this.api.post('/auth/register', {
        name: 'Test User',
        phone: '09370504588', // Admin's phone
        email: `test${Date.now()}@test.com`,
        password: 'Test1234',
        role: 'CUSTOMER',
      });
      
      if (res.status === 409) {
        this.addResult('Auth', 'Duplicate Phone Rejection', 'PASS', 'Correctly rejected duplicate');
      } else {
        this.addResult('Auth', 'Duplicate Phone Rejection', 'FAIL', `Expected 409, got ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Auth', 'Duplicate Phone Rejection', 'FAIL', err.message);
    }

    // Test 4: Register New Customer (with unique phone)
    const uniquePhone = `0912${Date.now().toString().slice(-7)}`;
    try {
      const res = await this.api.post('/auth/register', {
        name: 'Test Customer',
        phone: uniquePhone,
        email: `customer${Date.now()}@test.com`,
        password: 'Test1234',
        role: 'CUSTOMER',
      });
      
      if (res.status === 201 || res.status === 200) {
        this.addResult('Auth', 'New Customer Registration', 'PASS', `Phone: ${uniquePhone}`);
      } else {
        this.addResult('Auth', 'New Customer Registration', 'FAIL', `Status: ${res.status} - ${res.data.message}`);
      }
    } catch (err: any) {
      this.addResult('Auth', 'New Customer Registration', 'FAIL', err.message);
    }
  }

  /**
   * 👥 User Management Tests
   */
  async testUserManagement() {
    this.log('👥', '=== Testing User Management ===');

    if (!this.tokens.admin) {
      this.addResult('Users', 'Get All Users', 'SKIP', 'No admin token');
      return;
    }

    // Test 1: Get All Users (Admin only)
    try {
      const res = await this.api.get('/users', {
        headers: { Authorization: `Bearer ${this.tokens.admin}` },
      });
      
      if (res.status === 200 && Array.isArray(res.data)) {
        this.addResult('Users', 'Get All Users', 'PASS', `Count: ${res.data.length}`);
      } else {
        this.addResult('Users', 'Get All Users', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Users', 'Get All Users', 'FAIL', err.message);
    }

    // Test 2: Get Users Without Auth (Should fail)
    try {
      const res = await this.api.get('/users');
      
      if (res.status === 401 || res.status === 403) {
        this.addResult('Users', 'Unauthorized Access Prevention', 'PASS', 'Correctly blocked');
      } else {
        this.addResult('Users', 'Unauthorized Access Prevention', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Users', 'Unauthorized Access Prevention', 'FAIL', err.message);
    }
  }

  /**
   * 💈 Employee Tests
   */
  async testEmployees() {
    this.log('💈', '=== Testing Employees ===');

    // Test 1: Get Active Employees (Public)
    try {
      const res = await this.api.get('/employees/public/active');
      
      if (res.status === 200 && Array.isArray(res.data)) {
        this.addResult('Employees', 'Get Active Employees (Public)', 'PASS', `Count: ${res.data.length}`);
      } else {
        this.addResult('Employees', 'Get Active Employees (Public)', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Employees', 'Get Active Employees (Public)', 'FAIL', err.message);
    }

    // Test 2: Get All Employees (Protected)
    if (this.tokens.admin) {
      try {
        const res = await this.api.get('/employees', {
          headers: { Authorization: `Bearer ${this.tokens.admin}` },
        });
        
        if (res.status === 200 && Array.isArray(res.data)) {
          this.addResult('Employees', 'Get All Employees', 'PASS', `Count: ${res.data.length}`);
        } else {
          this.addResult('Employees', 'Get All Employees', 'FAIL', `Status: ${res.status}`);
        }
      } catch (err: any) {
        this.addResult('Employees', 'Get All Employees', 'FAIL', err.message);
      }
    }
  }

  /**
   * 📋 Services Tests
   */
  async testServices() {
    this.log('📋', '=== Testing Services ===');

    // Test 1: Get Public Services
    try {
      const res = await this.api.get('/services/public');
      
      if (res.status === 200) {
        // Check if response is array or has data property
        const services = Array.isArray(res.data) ? res.data : (res.data.data || []);
        this.addResult('Services', 'Get Public Services', 'PASS', `Count: ${services.length}`);
      } else {
        this.addResult('Services', 'Get Public Services', 'FAIL', `Status: ${res.status} - ${JSON.stringify(res.data).substring(0, 100)}`);
      }
    } catch (err: any) {
      this.addResult('Services', 'Get Public Services', 'FAIL', err.message);
    }

    // Test 2: Get All Services (Protected)
    if (this.tokens.admin) {
      try {
        const res = await this.api.get('/services', {
          headers: { Authorization: `Bearer ${this.tokens.admin}` },
        });
        
        if (res.status === 200 && Array.isArray(res.data)) {
          this.addResult('Services', 'Get All Services', 'PASS', `Count: ${res.data.length}`);
        } else {
          this.addResult('Services', 'Get All Services', 'FAIL', `Status: ${res.status}`);
        }
      } catch (err: any) {
        this.addResult('Services', 'Get All Services', 'FAIL', err.message);
      }
    }
  }

  /**
   * 📅 Appointments Tests
   */
  async testAppointments() {
    this.log('📅', '=== Testing Appointments ===');

    // Test 1: Get Available Slots (Public - now without auth)
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];
      
      const res = await this.api.get('/appointments/slots', {
        params: { date, employeeId: 1 },
      });
      
      if (res.status === 200) {
        this.addResult('Appointments', 'Get Available Slots (Public)', 'PASS', `Date: ${date}`);
      } else {
        this.addResult('Appointments', 'Get Available Slots (Public)', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Appointments', 'Get Available Slots (Public)', 'FAIL', err.message);
    }

    // Test 2: Get All Appointments (Protected)
    if (this.tokens.admin) {
      try {
        const res = await this.api.get('/appointments', {
          headers: { Authorization: `Bearer ${this.tokens.admin}` },
        });
        
        if (res.status === 200) {
          this.addResult('Appointments', 'Get All Appointments', 'PASS');
        } else {
          this.addResult('Appointments', 'Get All Appointments', 'FAIL', `Status: ${res.status}`);
        }
      } catch (err: any) {
        this.addResult('Appointments', 'Get All Appointments', 'FAIL', err.message);
      }
    }
  }

  /**
   * 🔔 Push Notifications Tests
   */
  async testPushNotifications() {
    this.log('🔔', '=== Testing Push Notifications ===');

    // Test 1: Get VAPID Public Key
    try {
      const res = await this.api.get('/push-notifications/public-key');
      
      if (res.status === 200 && res.data.publicKey) {
        this.addResult('Push', 'Get VAPID Public Key', 'PASS', `Key length: ${res.data.publicKey.length}`);
      } else {
        this.addResult('Push', 'Get VAPID Public Key', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Push', 'Get VAPID Public Key', 'FAIL', err.message);
    }

    // Test 2: Get All Subscriptions (Admin only)
    if (this.tokens.admin) {
      try {
        const res = await this.api.get('/push-notifications/admin/all', {
          headers: { Authorization: `Bearer ${this.tokens.admin}` },
        });
        
        if (res.status === 200) {
          // Check if it's an array or object with data
          const subs = Array.isArray(res.data) ? res.data : (res.data.subscriptions || []);
          this.addResult('Push', 'Get All Subscriptions (Admin)', 'PASS', `Count: ${subs.length}`);
        } else {
          this.addResult('Push', 'Get All Subscriptions (Admin)', 'FAIL', `Status: ${res.status}`);
        }
      } catch (err: any) {
        this.addResult('Push', 'Get All Subscriptions (Admin)', 'FAIL', err.message);
      }
    } else {
      this.addResult('Push', 'Get All Subscriptions (Admin)', 'SKIP', 'No admin token');
    }
  }

  /**
   * 💰 Dashboard Stats Tests
   */
  async testDashboardStats() {
    this.log('💰', '=== Testing Dashboard Stats ===');

    if (!this.tokens.admin) {
      this.addResult('Dashboard', 'Admin Stats', 'SKIP', 'No admin token');
      return;
    }

    // Test 1: Admin Stats
    try {
      const res = await this.api.get('/dashboard/admin-stats', {
        headers: { Authorization: `Bearer ${this.tokens.admin}` },
      });
      
      if (res.status === 200) {
        this.addResult('Dashboard', 'Admin Stats', 'PASS');
      } else {
        this.addResult('Dashboard', 'Admin Stats', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Dashboard', 'Admin Stats', 'FAIL', err.message);
    }

    // Test 2: Financial Stats
    try {
      const res = await this.api.get('/dashboard/financial-stats', {
        headers: { Authorization: `Bearer ${this.tokens.admin}` },
      });
      
      if (res.status === 200) {
        this.addResult('Dashboard', 'Financial Stats', 'PASS');
      } else {
        this.addResult('Dashboard', 'Financial Stats', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Dashboard', 'Financial Stats', 'FAIL', err.message);
    }
  }

  /**
   * 🌐 Frontend Tests
   */
  async testFrontend() {
    this.log('🌐', '=== Testing Frontend ===');

    // Test 1: Homepage
    try {
      const res = await axios.get(FRONTEND_BASE, { timeout: 5000 });
      
      if (res.status === 200) {
        this.addResult('Frontend', 'Homepage Load', 'PASS');
      } else {
        this.addResult('Frontend', 'Homepage Load', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Frontend', 'Homepage Load', 'FAIL', err.message);
    }

    // Test 2: Login Page
    try {
      const res = await axios.get(`${FRONTEND_BASE}/login`, { timeout: 5000 });
      
      if (res.status === 200) {
        this.addResult('Frontend', 'Login Page Load', 'PASS');
      } else {
        this.addResult('Frontend', 'Login Page Load', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Frontend', 'Login Page Load', 'FAIL', err.message);
    }

    // Test 3: Register Page
    try {
      const res = await axios.get(`${FRONTEND_BASE}/register`, { timeout: 5000 });
      
      if (res.status === 200) {
        this.addResult('Frontend', 'Register Page Load', 'PASS');
      } else {
        this.addResult('Frontend', 'Register Page Load', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Frontend', 'Register Page Load', 'FAIL', err.message);
    }

    // Test 4: Service Worker
    try {
      const res = await axios.get(`${FRONTEND_BASE}/sw.js`, { timeout: 5000 });
      
      if (res.status === 200) {
        const content = typeof res.data === 'string' ? res.data : '';
        const isValid = content.includes('VERSION') || content.includes('self.addEventListener') || content.length > 100;
        
        if (isValid) {
          this.addResult('Frontend', 'Service Worker', 'PASS', `Size: ${content.length} bytes`);
        } else {
          this.addResult('Frontend', 'Service Worker', 'FAIL', 'Content invalid or empty');
        }
      } else {
        this.addResult('Frontend', 'Service Worker', 'FAIL', `Status: ${res.status}`);
      }
    } catch (err: any) {
      this.addResult('Frontend', 'Service Worker', 'FAIL', err.message);
    }
  }

  /**
   * Generate and save report
   */
  generateReport() {
    this.log('📊', '=== TEST REPORT ===');
    
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    const passRate = ((passed / total) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log(`📈 SUMMARY:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   ✅ Passed: ${passed} (${passRate}%)`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log('='.repeat(60));
    
    // Group by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    console.log('\n📋 BY CATEGORY:');
    categories.forEach(cat => {
      const tests = this.results.filter(r => r.category === cat);
      const catPassed = tests.filter(r => r.status === 'PASS').length;
      const catFailed = tests.filter(r => r.status === 'FAIL').length;
      const catSkipped = tests.filter(r => r.status === 'SKIP').length;
      
      console.log(`\n  ${cat}:`);
      console.log(`    ✅ ${catPassed} | ❌ ${catFailed} | ⏭️  ${catSkipped}`);
      
      // Show failed tests
      const failedTests = tests.filter(r => r.status === 'FAIL');
      if (failedTests.length > 0) {
        failedTests.forEach(t => {
          console.log(`      ❌ ${t.name}: ${t.message || 'No details'}`);
        });
      }
    });
    
    // Save JSON report
    const reportPath = path.join(__dirname, `../test-reports/comprehensive-${Date.now()}.json`);
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, skipped, passRate },
      results: this.results,
    }, null, 2));
    
    console.log(`\n📄 Full report saved: ${reportPath}`);
    
    return { total, passed, failed, skipped, passRate: parseFloat(passRate) };
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('🧪 DOOCARD COMPREHENSIVE TEST SUITE');
    console.log('=' + '='.repeat(58) + '\n');
    
    const start = Date.now();
    
    await this.testAuthentication();
    await this.testUserManagement();
    await this.testEmployees();
    await this.testServices();
    await this.testAppointments();
    await this.testPushNotifications();
    await this.testDashboardStats();
    await this.testFrontend();
    
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    const summary = this.generateReport();
    
    console.log(`\n⏱️  Total Duration: ${duration}s\n`);
    
    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new DoocardTester();
tester.runAll().catch(err => {
  console.error('💥 Test suite crashed:', err);
  process.exit(1);
});

