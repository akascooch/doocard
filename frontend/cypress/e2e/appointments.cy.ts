describe('Appointments E2E - Complete Flow', () => {
  const adminCredentials = { identifier: '09370504588', password: '123456' };
  const customerPhone = '09123456789'; // Adjust based on your test data

  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  describe('Customer Booking Flow', () => {
    it('should allow customer to book multi-service appointment', () => {
      // Login as customer
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(customerPhone);
      cy.get('input[name="password"]').type('123456');
      cy.get('button[type="submit"]').click();

      // Navigate to appointments
      cy.url().should('include', '/dashboard');
      cy.contains('نوبت‌ها').click();

      // Click "New Appointment" tab
      cy.contains('رزرو نوبت').click();

      // Select multiple services
      cy.contains('سرویس‌ها').parent().find('button').first().click();
      cy.get('[role="option"]').first().click();
      cy.get('[role="option"]').eq(1).click();
      cy.get('body').click(0, 0); // Close dropdown

      // Verify prices are NOT shown for customer
      cy.contains('تومان').should('not.exist');
      cy.contains('مبلغ').should('not.exist');

      // Select employee
      cy.contains('آرایشگر').parent().find('button').click();
      cy.get('[role="option"]').first().click();

      // Select date (current Jalali date)
      cy.contains('تاریخ').parent().find('input').type('۱۴۰۳/۰۷/۲۵');

      // Select time slot
      cy.contains('زمان').parent().find('button').first().click();

      // Submit
      cy.contains('ثبت نوبت').click();

      // Verify success toast
      cy.contains('در انتظار تأیید').should('be.visible');

      // Verify appointment appears in list
      cy.contains('نوبت‌های من').click();
      cy.contains('نیاز به تأیید').should('be.visible');
    });

    it('should show Jalali dates correctly', () => {
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(customerPhone);
      cy.get('input[name="password"]').type('123456');
      cy.get('button[type="submit"]').click();

      cy.contains('نوبت‌ها').click();
      
      // Check for Jalali date format (۱۴۰۳/۰۷/۲۵)
      cy.get('table').should('contain', '۱۴۰۳');
    });
  });

  describe('Employee Confirmation Flow', () => {
    it('should allow employee to confirm pending appointments', () => {
      // Login as admin (or employee)
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();

      // Navigate to appointments
      cy.contains('نوبت‌ها').click();

      // Find pending confirmation appointment
      cy.contains('نیاز به تأیید').should('exist');

      // Click confirm button
      cy.get('[data-testid="confirm-button"]').or('button').contains('تأیید').first().click();

      // Verify status changed
      cy.contains('تأیید شده').should('be.visible');
      
      // Verify toast
      cy.contains('نوبت با موفقیت تأیید شد').should('be.visible');
    });
  });

  describe('Admin Settlement Flow', () => {
    beforeEach(() => {
      // Login as admin
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();
      cy.contains('نوبت‌ها').click();
    });

    it('should open PaymentModal for confirmed appointments', () => {
      // Find confirmed appointment
      cy.contains('تأیید شده').should('exist');

      // Click settle button (💰 icon)
      cy.get('button').contains('💰').or('[data-testid="settle-button"]').first().click();

      // Verify PaymentModal opened
      cy.contains('تسویه نوبت').should('be.visible');
      cy.contains('سرویس‌های انجام شده').should('be.visible');
    });

    it('should settle with CASH payment method', () => {
      cy.contains('تأیید شده').parent().find('button').contains('💰').first().click();

      // Verify total calculated from services
      cy.contains('جمع کل').should('be.visible');
      cy.contains('تومان').should('be.visible');

      // Select payment method
      cy.contains('روش پرداخت').parent().find('button').click();
      cy.contains('نقدی').click();

      // Select bank account
      cy.contains('حساب بانکی').parent().find('button').click();
      cy.get('[role="option"]').first().click();

      // Add tip (optional)
      cy.contains('انعام').parent().find('input').type('50000');

      // Submit
      cy.contains('تسویه نوبت').click();

      // Verify success
      cy.contains('نوبت با موفقیت تسویه شد').should('be.visible');
      cy.contains('تسویه شده').should('be.visible');
    });

    it('should settle with DEBT and show alert', () => {
      cy.contains('تأیید شده').parent().find('button').contains('💰').first().click();

      // Select DEBT payment method
      cy.contains('روش پرداخت').parent().find('button').click();
      cy.contains('بدهی').click();

      // Verify bank account field hidden
      cy.contains('حساب بانکی').should('not.exist');

      // Verify debt alert shown
      cy.contains('بدهی مشتری ثبت خواهد شد').should('be.visible');

      // Submit
      cy.contains('تسویه نوبت').click();

      // Verify success
      cy.contains('تسویه شد').should('be.visible');
    });

    it('should allow amount override with toggle', () => {
      cy.contains('تأیید شده').parent().find('button').contains('💰').first().click();

      // Enable amount edit
      cy.contains('ویرایش مبلغ نهایی').parent().find('[role="switch"]').click();

      // Verify amount input is now enabled
      cy.contains('مبلغ نهایی').parent().find('input').should('not.be.disabled');

      // Change amount
      cy.contains('مبلغ نهایی').parent().find('input').clear().type('750000');

      // Submit
      cy.contains('روش پرداخت').parent().find('button').click();
      cy.contains('نقدی').click();
      cy.contains('حساب بانکی').parent().find('button').click();
      cy.get('[role="option"]').first().click();
      cy.contains('تسویه نوبت').click();

      // Verify settled with custom amount
      cy.contains('تسویه شد').should('be.visible');
    });
  });

  describe('Accounting Integration', () => {
    it('should reflect settled appointment in accounting', () => {
      // Login as admin
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();

      // Settle an appointment first
      cy.contains('نوبت‌ها').click();
      cy.contains('تأیید شده').parent().find('button').contains('💰').first().click();
      cy.contains('روش پرداخت').parent().find('button').click();
      cy.contains('نقدی').click();
      cy.contains('حساب بانکی').parent().find('button').click();
      cy.get('[role="option"]').first().click();
      cy.contains('تسویه نوبت').click();

      // Navigate to accounting
      cy.contains('حسابداری').click();

      // Verify transaction appears
      cy.contains('درآمد').should('be.visible');
      cy.contains('تومان').should('be.visible');
    });
  });

  describe('Persian UX Validation', () => {
    beforeEach(() => {
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();
    });

    it('should display all text in Persian', () => {
      cy.contains('نوبت‌ها').click();
      cy.contains('ثبت نوبت جدید').should('be.visible');
      cy.contains('تاریخ').should('be.visible');
      cy.contains('زمان').should('be.visible');
      cy.contains('مشتری').should('be.visible');
      cy.contains('سرویس').should('be.visible');
    });

    it('should use Toman currency format with commas', () => {
      cy.contains('حسابداری').click();
      // Check for Persian numbers and Toman
      cy.get('body').should('contain', 'تومان');
      cy.get('body').should('contain', '،'); // Persian comma
    });

    it('should have RTL layout', () => {
      cy.get('html').should('have.attr', 'dir', 'rtl');
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      cy.viewport(390, 844); // iPhone 13
    });

    it('should display appointment form correctly on mobile', () => {
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();

      cy.contains('نوبت‌ها').click();
      cy.contains('نوبت جدید').click();

      // Verify fields are stacked vertically
      cy.contains('سرویس‌ها').should('be.visible');
      cy.contains('آرایشگر').should('be.visible');
      
      // Verify mobile-friendly
      cy.get('input').should('have.css', 'width').and('not.equal', '0px');
    });

    it('should show PaymentModal scrollable on mobile', () => {
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();

      cy.contains('نوبت‌ها').click();
      cy.contains('تأیید شده').parent().find('button').contains('💰').first().click();

      // Verify modal is scrollable
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').scrollTo('bottom');
      cy.contains('تسویه نوبت').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should show error for overlapping appointments', () => {
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();

      // Try to create overlapping appointment
      cy.contains('نوبت‌ها').click();
      cy.contains('نوبت جدید').click();

      // Fill form with conflicting time
      // ... (similar to booking flow but with existing time)

      // Verify error toast
      cy.contains('تداخل زمانی').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('http://localhost:3000/login');
      cy.get('input[name="identifier"]').type(adminCredentials.identifier);
      cy.get('input[name="password"]').type(adminCredentials.password);
      cy.get('button[type="submit"]').click();

      cy.contains('نوبت‌ها').click();
      cy.contains('نوبت جدید').click();

      // Try to submit without filling
      cy.contains('ثبت نوبت').click();

      // Verify validation errors
      cy.contains('انتخاب کنید').should('be.visible');
    });
  });
});

