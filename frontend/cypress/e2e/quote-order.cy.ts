const PNG_1X1 = Cypress.Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("shop quote versus fixed-price checkout", () => {
  it("fixed-price product stays on the normal checkout path", () => {
    cy.intercept("POST", "**/api/orders").as("createFixedOrder");
    cy.visit("/products");
    cy.contains("E2E Fixed Price", { timeout: 20000 }).parents('[data-cy^="product-card-"]').within(() => {
      cy.get('[data-cy="product-add-fixed"]').click();
    });
    cy.get('[data-cy="open-cart"]').click();
    cy.get('[data-cy="checkout-dialog"]').should("be.visible");
    cy.contains("تسویه کارت‌به‌کارت").should("be.visible");
    cy.get('[data-cy="checkout-dialog"]').should("not.contain", "نیازمند استعلام");
    cy.get("#shop-name").type("مشتری تست E2E");
    cy.get("#shop-phone").type("09101112233");
    cy.get("#shop-receipt").selectFile(
      {
        contents: PNG_1X1,
        fileName: "receipt.png",
        mimeType: "image/png",
      },
      { force: true },
    );
    cy.get('[data-cy="checkout-submit"]').click();
    cy.wait("@createFixedOrder").then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      const order = interception.response?.body as { status?: string };
      expect(order.status).to.eq("PENDING_VERIFICATION");
      expect(order.status).to.not.eq("PAID");
    });
    cy.get('[data-cy="checkout-success"]').should("contain", "سفارش شما ثبت شد");
    cy.get('[data-cy="checkout-success"]').should("not.contain", "استعلام قیمت");
  });

  it("hidden-price product enters the quote flow and does not allow direct payment", () => {
    cy.intercept("POST", "**/api/orders").as("createQuoteOrder");
    cy.visit("/products");
    cy.contains("E2E Quote Product", { timeout: 20000 }).parents('[data-cy^="product-card-"]').within(() => {
      cy.get('[data-cy="product-add-quote"]').click();
    });
    cy.get('[data-cy="open-cart"]').should("contain", "نیازمند استعلام").click();
    cy.get('[data-cy="checkout-dialog"]').should("be.visible");
    cy.contains("ثبت درخواست استعلام قیمت").should("be.visible");
    cy.contains("نیازمند استعلام").should("be.visible");
    cy.get("#shop-receipt").should("not.exist");
    cy.contains(/کارت به کارت|ارسال رسید|پرداخت آنلاین/).should("not.exist");
    cy.get("#shop-name").type("مشتری تست E2E");
    cy.get("#shop-phone").type("09101112233");
    cy.get('[data-cy="checkout-submit"]').should("contain", "ثبت درخواست و استعلام قیمت").click();
    cy.wait("@createQuoteOrder").then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      const order = interception.response?.body as { status?: string };
      expect(order.status).to.eq("AWAITING_QUOTE");
      expect(order.status).to.not.eq("PAID");
      expect(order.status).to.not.eq("PENDING_VERIFICATION");
    });
    cy.get('[data-cy="checkout-success"]').should("contain", "درخواست استعلام قیمت شما ثبت شد");
  });
});
