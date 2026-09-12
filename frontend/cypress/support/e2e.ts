Cypress.on("uncaught:exception", (err) => {
  const message = err.message || "";
  // Next.js 14 `next dev` throws recoverable hydration mismatches as uncaught
  // errors (extra <style> in <head> from the root dark-theme script). Production
  // React does not fail the page; ignore only this family so A-G flows can run.
  if (
    message.includes("Hydration failed") ||
    message.includes("there is a tree mismatch") ||
    message.includes("There was an error while hydrating") ||
    message.includes("outside of a Suspense boundary") ||
    message.includes("Minified React error #418") ||
    message.includes("Minified React error #423") ||
    message.includes("matching <style> in <head>")
  ) {
    return false;
  }
  return true;
});
