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

describe("waitlist and stock", () => {
  it("out-of-stock products expose waitlist instead of an oversell add-to-cart path", () => {
    const { identifier, password } = requireCustomerEnv();
    cy.visit("/login");
    cy.get("#identifier", { timeout: 20000 }).should("be.visible");
    cy.get("#identifier").clear({ force: true });
    cy.get("#identifier").type(identifier, { delay: 0 });
    cy.get("#password").should("be.visible").clear({ force: true });
    cy.get("#password").type(password, { log: false, delay: 0 });
    cy.get('button[type="submit"]').click();
    cy.location("pathname", { timeout: 20000 }).should("include", "/dashboard");

    cy.intercept("POST", "**/api/public/waitlist").as("subscribeWaitlist");
    cy.visit("/products");
    cy.contains("E2E Out Of Stock", { timeout: 20000 }).parents('[data-cy^="product-card-"]').within(() => {
      cy.get('[data-cy="product-out-of-stock"]').should("be.disabled").and("contain", "ناموجود");
      cy.get('[data-cy="product-waitlist"]').click();
    });
    cy.wait("@subscribeWaitlist").then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
    });
    cy.contains("ثبت شد").should("be.visible");
    cy.contains("E2E Out Of Stock").parents('[data-cy^="product-card-"]').within(() => {
      cy.get('[data-cy="product-out-of-stock"]').should("be.disabled");
    });
  });
});
