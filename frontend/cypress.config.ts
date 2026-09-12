import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: true,
    screenshotOnRunFailure: true,
    videosFolder: "cypress/videos",
    screenshotsFolder: "cypress/screenshots",
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 20000,
    env: {
      apiUrl: "http://localhost:3001",
    },
  },
});
