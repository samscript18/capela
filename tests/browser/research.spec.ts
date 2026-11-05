import { test, expect } from "@playwright/test";

test("inspect rejection, exact source passage and technical trace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText("Synthetic fixture");
  await page.getByText("The marker changed in mice.", { exact: false }).first().click();
  await expect(page.getByText("Finding drops source negation.", { exact: false })).toBeVisible();
  await page.getByText("Inspect stored normalized abstract").click();
  await expect(page.locator("pre")).toContainText("did not change");
  await expect(page.getByRole("link", { name: "Open canonical publication" })).toHaveAttribute(
    "href",
    "https://pubmed.ncbi.nlm.nih.gov/12345/",
  );
  await page.getByText("Technical run view", { exact: true }).click();
  await expect(page.getByText(/fixture-correlation/)).toBeVisible();
});
test("partial and denial states retain inspectable work and label costs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Budget denied", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No provider bypass");
  await expect(page.getByRole("status")).toContainText("stopped before completion");
  await expect(page.getByText("Reported settled / estimated reserved")).toBeVisible();
  await page.getByRole("button", { name: "Provider error", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Provider unavailable");
});
test("legacy warning and fixture history/reopen retain provenance honesty", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Legacy", exact: true }).click();
  await expect(page.getByText(/passage verification and independent model review were not performed/)).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Reopen stored fixture" }).click();
  await expect(page.getByRole("heading", { name: "Evidence with its review trail" })).toBeVisible();
});
test("inspection is keyboard reachable and fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Completed", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Partial", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("hybrid review visibly distinguishes direct Vertex billing and Otari capability evidence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hybrid", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("direct Vertex AI review");
  await expect(page.getByRole("status")).toContainText("billed by Google");
  await expect(page.getByRole("status")).toContainText("This review ran outside Otari.");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.getByText("Hybrid investigation:", { exact: false })).toHaveCount(0);
});

test("evidence phase distinguishes Otari review from Vertex review", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("evidence-phase")).toHaveText("Reviewing extracted evidence");
  await page.getByRole("button", { name: "Hybrid", exact: true }).click();
  await expect(page.getByTestId("evidence-phase")).toHaveText("Reviewing evidence with Vertex AI");
});

test("Vertex technical diagnostics label Google response and safe finish metadata", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hybrid", exact: true }).click();
  await page.getByText("Technical run view", { exact: true }).click();
  await expect(page.getByText(/Vertex response synthetic-vertex-response/)).toBeVisible();
  await expect(page.getByText(/finish STOP/)).toBeVisible();
  await expect(page.getByText(/123 output tokens/)).toBeVisible();
  await expect(page.getByText(/17 thinking tokens/)).toBeVisible();
});
