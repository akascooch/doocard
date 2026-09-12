function requireCustomerEnv() {
  const identifier = Cypress.env("E2E_CUSTOMER_IDENTIFIER");
  const password = Cypress.env("E2E_CUSTOMER_PASSWORD");
  if (!identifier || !password) {
    throw new Error(
      "Missing Cypress env E2E_CUSTOMER_IDENTIFIER / E2E_CUSTOMER_PASSWORD. Use cypress.env.json locally; never commit credentials.",
    );
  }
  return { identifier, password };
}

function dismissNotificationPrompt() {
  cy.get('[data-cy="notification-prompt-close"]', { timeout: 15000 }).click({ force: true });
  cy.get('[data-cy="notification-prompt"]').should("not.exist");
}

function loginAsCustomer() {
  const { identifier, password } = requireCustomerEnv();
  cy.visit("/login");
  cy.get("#identifier", { timeout: 20000 }).should("be.visible");
  cy.get("#identifier").clear({ force: true });
  cy.get("#identifier").type(identifier, { delay: 0 });
  cy.get("#password").should("be.visible").clear({ force: true });
  cy.get("#password").type(password, { log: false, delay: 0 });
  cy.get('button[type="submit"]').click();
  cy.location("pathname", { timeout: 20000 }).should("include", "/dashboard");
  dismissNotificationPrompt();
}

describe("appointment Jalali booking", () => {
  it("creates an appointment on the selected Jalali day and shows Tehran time", () => {
    loginAsCustomer();
    cy.intercept("POST", "**/api/appointments").as("createAppointment");
    cy.visit("/dashboard/customer/appointments");
    dismissNotificationPrompt();
    cy.get('[data-cy="tab-new-appointment"]').click();
    cy.get('[data-cy="appointment-form"]', { timeout: 20000 }).should("be.visible");
    cy.get('[data-cy="select-services"]').click();
    cy.get('[data-cy^="service-option-"]', { timeout: 15000 }).first().click();
    cy.contains("button", "تأیید").click({ force: true });
    cy.get('[data-cy="select-employee"]').click();
    cy.get('[role="option"]').first().click();
    cy.get('[data-cy="jalali-date-picker"] input.rmdp-input', { timeout: 15000 }).first().click({ force: true });
    cy.get(".rmdp-calendar", { timeout: 15000 }).should("be.visible");
    cy.get(".rmdp-arrow-container.right, .rmdp-right").first().click({ force: true });
    cy.get(".rmdp-calendar .rmdp-day:not(.rmdp-disabled):not(.rmdp-day-hidden)", { timeout: 15000 })
      .first()
      .click({ force: true });
    cy.get("button[data-slot-time]:not([disabled])", { timeout: 20000 })
      .filter("[data-slot-time*='T']")
      .first()
      .click({ force: true });
    cy.get('[data-cy="submit-appointment"]').click();
    cy.wait("@createAppointment").then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      const body = interception.request.body as { jalaliDate?: string; time?: string };
      expect(body.jalaliDate, "jalaliDate sent").to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(body.time, "time sent").to.match(/^\d{2}:\d{2}$/);
      const jalaliUi = body.jalaliDate!.replace(/-/g, "/");
      cy.wrap(jalaliUi).as("jalaliDay");
      cy.wrap(body.time).as("bookedTime");
    });
    cy.get('[data-cy="tab-my-appointments"]').click();
    cy.get('[data-cy="appointment-when"]', { timeout: 20000 }).first().invoke("text").then((text) => {
      cy.get("@jalaliDay").then((day) => {
        expect(text).to.include(String(day));
      });
      cy.get("@bookedTime").then((time) => {
        expect(text).to.include(String(time));
      });
    });
  });
});
