const API = () => Cypress.env("apiUrl") || "http://localhost:3001";

function requireAdminEnv() {
  const identifier = Cypress.env("E2E_ADMIN_IDENTIFIER");
  const password = Cypress.env("E2E_ADMIN_PASSWORD");
  if (!identifier || !password) {
    throw new Error("Missing Cypress env E2E_ADMIN_IDENTIFIER / E2E_ADMIN_PASSWORD.");
  }
  return { identifier, password };
}

function requireCustomerEnv() {
  const identifier = Cypress.env("E2E_CUSTOMER_IDENTIFIER");
  const password = Cypress.env("E2E_CUSTOMER_PASSWORD");
  if (!identifier || !password) {
    throw new Error("Missing Cypress env E2E_CUSTOMER_IDENTIFIER / E2E_CUSTOMER_PASSWORD.");
  }
  return { identifier, password };
}

function dismissNotificationPrompt() {
  cy.get("body").then(($body) => {
    if ($body.find('[data-cy="notification-prompt-close"]').length) {
      cy.get('[data-cy="notification-prompt-close"]').click({ force: true });
      cy.get('[data-cy="notification-prompt"]').should("not.exist");
    }
  });
}

/** One login per identifier via existing POST /api/auth/login. Does not change throttle rules. */
function apiSession(identifier: string, password: string) {
  cy.session(
    ["pr22", identifier],
    () => {
      cy.request({
        method: "POST",
        url: `${API()}/api/auth/login`,
        body: { identifier, password },
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 201]);
        expect(res.body.access_token, "access_token").to.be.a("string");
        expect(res.body.user, "user").to.be.an("object");
        cy.visit("/", {
          timeout: 30000,
          onBeforeLoad(win) {
            win.localStorage.setItem("token", res.body.access_token);
            win.localStorage.setItem("user", JSON.stringify(res.body.user));
            win.localStorage.setItem("notification-prompt-dismissed", "true");
          },
        });
      });
    },
    {
      validate() {
        cy.window().then((win) => {
          expect(win.localStorage.getItem("token"), "cached token").to.be.a("string");
        });
      },
    },
  );
}

function visitAuthed(path: string) {
  cy.visit(path, {
    timeout: 30000,
    onBeforeLoad(win) {
      win.localStorage.setItem("notification-prompt-dismissed", "true");
    },
  });
  dismissNotificationPrompt();
}

describe("PR2.2 warm local app", () => {
  it("loads the landing page once so later specs are not the first compile", () => {
    cy.visit("/", { timeout: 30000 });
    cy.contains("a", "ورود").should("be.visible");
  });
});

describe("PR2.2 frog widget", () => {
  it("creates today's frog, advances status, and excludes today from history", () => {
    const { identifier, password } = requireAdminEnv();
    const frogTitle = `qa-pr22-frog-${Date.now()}`;
    cy.viewport(1440, 900);
    cy.exec("node C:/scooch/Versions/v.2.0.4/backend/_pr21_reset_today_frog.js");
    apiSession(identifier, password);
    visitAuthed("/dashboard/admin");
    cy.get('[data-cy="admin-frog-widget"]').should("be.visible");
    cy.get('[data-cy="frog-title"]').clear().type(frogTitle);
    cy.get('[data-cy="frog-save"]').click();
    cy.get('[data-cy="frog-status"]').should("contain", "در انتظار");
    cy.reload();
    dismissNotificationPrompt();
    cy.get('[data-cy="admin-frog-widget"]').should("contain", frogTitle);
    cy.get('[data-cy="frog-status"]').should("contain", "در انتظار");
    cy.get('[data-cy="frog-toggle"]').click();
    cy.get('[data-cy="frog-status"]').should("contain", "در حال انجام");
    cy.get('[data-cy="frog-toggle"]').click();
    cy.get('[data-cy="frog-status"]').should("contain", "انجام شد");
    cy.get('[data-cy="frog-toggle"]').should("be.disabled");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
    cy.get('[data-cy="frog-history"]').should("be.visible");
    cy.get('[data-cy="frog-history"]').then(($hist) => {
      const dates = [...$hist.find("[data-date-key]")].map((el) => el.getAttribute("data-date-key"));
      expect(dates, "history excludes today").not.to.include(today);
    });
  });
});

describe("PR2.2 personal expenses", () => {
  it("rejects invalid amounts and creates a uniquely titled expense", () => {
    const { identifier, password } = requireAdminEnv();
    const title = `qa-pr22-keep-${Date.now()}`;
    cy.viewport(1440, 900);
    apiSession(identifier, password);
    visitAuthed("/dashboard/admin/personal-expenses");
    cy.contains("h1", "هزینه‌های شخصی و تنخواه").should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear().type("50000.50");
    cy.get('[data-cy="expense-title"]').clear().type("decimal reject");
    cy.get('[data-cy="expense-submit"]').click();
    cy.contains("مبلغ اعشاری مجاز نیست").should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear().type("-10000");
    cy.get('[data-cy="expense-submit"]').click();
    cy.contains("مبلغ باید عدد صحیح ریال باشد").should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear().type("0");
    cy.get('[data-cy="expense-title"]').clear().type("zero reject");
    cy.get('[data-cy="expense-submit"]').click();
    cy.contains("مبلغ خارج از محدوده مجاز است").should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear();
    cy.get('[data-cy="expense-title"]').clear().type("empty amount");
    cy.get('[data-cy="expense-submit"]').click();
    cy.contains("مبلغ را وارد کنید").should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear().type("1000000000000000");
    cy.get('[data-cy="expense-title"]').clear().type("oversize");
    cy.get('[data-cy="expense-submit"]').click();
    cy.contains(/مبلغ بیش از حد مجاز|مبلغ خارج از محدوده/).should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear().type("50000");
    cy.get('[data-cy="expense-title"]').clear().type(title);
    cy.get('[data-cy="expense-submit"]').click();
    cy.get(`[data-cy="expense-row"][data-title="${title}"]`).should("be.visible");
    cy.get('[data-cy="expense-summary-today"]').invoke("text").should("include", "ریال");
  });
});

describe("PR2.2 expense delete", () => {
  it("cancels, then soft-deletes only the targeted QA row", () => {
    const { identifier, password } = requireAdminEnv();
    const stamp = Date.now();
    const keepTitle = `qa-pr22-keep-${stamp}`;
    const deleteTitle = `qa-pr22-del-${stamp}`;
    cy.viewport(1440, 900);
    apiSession(identifier, password);
    visitAuthed("/dashboard/admin/personal-expenses");

    cy.get('[data-cy="expense-amount"]').clear().type("11000");
    cy.get('[data-cy="expense-title"]').clear().type(keepTitle);
    cy.get('[data-cy="expense-submit"]').click();
    cy.get(`[data-cy="expense-row"][data-title="${keepTitle}"]`).should("be.visible");

    cy.get('[data-cy="expense-amount"]').clear().type("12000");
    cy.get('[data-cy="expense-title"]').clear().type(deleteTitle);
    cy.get('[data-cy="expense-submit"]').click();
    cy.get(`[data-cy="expense-row"][data-title="${deleteTitle}"]`).should("be.visible");

    cy.get(`[data-cy="expense-row"][data-title="${deleteTitle}"]`).find('[data-cy="expense-delete"]').click();
    cy.get('[data-cy="expense-delete-dialog"]').should("be.visible");
    cy.get('[data-cy="expense-delete-cancel"]').click();
    cy.get('[data-cy="expense-delete-dialog"]').should("not.exist");
    cy.get(`[data-cy="expense-row"][data-title="${deleteTitle}"]`).should("be.visible");
    cy.get(`[data-cy="expense-row"][data-title="${keepTitle}"]`).should("be.visible");

    cy.get('[data-cy="expense-summary-today"]').invoke("text").as("sumBeforeDelete");
    cy.intercept("DELETE", "**/api/admin/personal/expenses/**").as("deleteExpense");
    cy.get(`[data-cy="expense-row"][data-title="${deleteTitle}"]`).find('[data-cy="expense-delete"]').click();
    cy.get('[data-cy="expense-delete-dialog"]').should("be.visible");
    cy.get('[data-cy="expense-delete-confirm"]').click();
    cy.wait("@deleteExpense").its("response.statusCode").should("eq", 200);
    cy.contains("حذف شد").should("be.visible");
    cy.get(`[data-cy="expense-row"][data-title="${deleteTitle}"]`).should("not.exist");
    cy.get(`[data-cy="expense-row"][data-title="${keepTitle}"]`).should("be.visible");
    cy.get('[data-cy="expense-summary-today"]').invoke("text").then(function (after) {
      expect(after, "today summary after targeted delete").not.to.eq(this.sumBeforeDelete);
    });

    cy.reload();
    dismissNotificationPrompt();
    cy.get(`[data-cy="expense-row"][data-title="${deleteTitle}"]`).should("not.exist");
    cy.get(`[data-cy="expense-row"][data-title="${keepTitle}"]`).should("be.visible");
  });
});

describe("PR2.2 theme persistence", () => {
  it("keeps Light and Dark across reload", () => {
    const { identifier, password } = requireAdminEnv();
    cy.viewport(1440, 900);
    apiSession(identifier, password);
    const hydrationErrors: string[] = [];
    cy.visit("/dashboard/settings", {
      onBeforeLoad(win) {
        win.localStorage.setItem("notification-prompt-dismissed", "true");
        const original = win.console.error.bind(win.console);
        win.console.error = (...args: unknown[]) => {
          hydrationErrors.push(String(args[0] ?? ""));
          original(...args);
        };
      },
    });
    dismissNotificationPrompt();
    cy.get('[data-cy="theme-select"]').should("be.visible");
    cy.get('[data-cy="theme-select"]').select("light");
    cy.get("html").should("have.class", "light");
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.reload();
    dismissNotificationPrompt();
    cy.get('[data-cy="theme-select"]').should("have.value", "light");
    cy.get("html").should("have.class", "light");
    cy.get('[data-cy="theme-select"]').select("dark");
    cy.get("html").should("have.class", "dark");
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.reload();
    dismissNotificationPrompt();
    cy.get('[data-cy="theme-select"]').should("have.value", "dark");
    cy.get("html").should("have.class", "dark");
    cy.then(() => {
      const hydration = hydrationErrors.filter((msg) => /hydrat/i.test(msg));
      expect(hydration, "hydration console errors").to.have.length(0);
    });
  });
});

describe("PR2.2 access control", () => {
  it("redirects a customer away from personal expenses", () => {
    const { identifier, password } = requireCustomerEnv();
    cy.viewport(1440, 900);
    apiSession(identifier, password);
    visitAuthed("/dashboard/admin/personal-expenses");
    cy.location("pathname").should("include", "/dashboard/customer");
    cy.get('[data-cy="nav-/dashboard/admin/personal-expenses"]').should("not.exist");
  });
});

describe("PR2.2 booking draft regression", () => {
  it("keeps the landing OTP path and restores the draft after staff-path customer login", () => {
    const { identifier, password } = requireCustomerEnv();
    cy.visit("/");
    cy.contains("a", "ورود").should("have.attr", "href", "/login");
    cy.contains("a", "ثبت‌نام").should("have.attr", "href", "/login?intent=register");
    cy.contains("a", /رزرو/).should("have.attr", "href").and("include", "/book-appointment");
    cy.visit("/login");
    cy.contains("مشتریان فقط با شماره موبایل").should("be.visible");
    cy.get("#password").should("not.exist");
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        "doocard-booking-draft",
        JSON.stringify({
          serviceId: "1",
          appointmentDate: "1405/06/22",
          appointmentTime: "11:00",
        }),
      );
    });
    cy.visit("/login?staff=1");
    cy.get("#identifier").clear().type(identifier, { delay: 0 });
    cy.get("#password").clear().type(password, { log: false, delay: 0 });
    cy.get('button[type="submit"]').click();
    cy.location("pathname").should("eq", "/book-appointment");
    cy.window().then((win) => {
      const raw = win.sessionStorage.getItem("doocard-booking-draft");
      expect(raw, "booking draft survived auth").to.include("11:00");
    });
  });
});
