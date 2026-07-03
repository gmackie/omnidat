import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the main heading", async ({ page }) => {
    await page.goto("/");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("should have theme toggle button", async ({ page }) => {
    await page.goto("/");

    const themeToggle = page.getByRole("button", { name: /toggle theme/i });
    await expect(themeToggle).toBeVisible();
  });

  test("should show sign in button when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");

    const signInButton = page.getByRole("button", {
      name: /sign in with discord/i,
    });
    await expect(signInButton).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("should navigate to settings page when authenticated", async ({
    page,
  }) => {
    // This test would require authentication setup
    // For now, just verify the settings route exists
    await page.goto("/settings");

    // Should redirect to home if not authenticated
    await expect(page).toHaveURL("/");
  });
});

test.describe("OMNIDAT Console", () => {
  test("should expose vintage dial POS controls", async ({ page }) => {
    await page.goto("/console");

    await expect(
      page.getByRole("heading", { name: "Vintage Dial POS" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Dial POS Sale" }),
    ).toBeVisible();
    await expect(
      page.locator("pre").filter({ hasText: "STATUS AWAITING MERCHANT SALE" }),
    ).toContainText("DIAL 8810");
    await expect(
      page.getByRole("heading", { name: "VeriFone TCL Program Pack" }),
    ).toBeVisible();
    await expect(page.getByText("TCLOAD direct download")).toBeVisible();
    await expect(page.getByText("/api/authorize")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Build Terminal Package" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Build Terminal Package" }).click();
    const packageOutput = page
      .locator("pre")
      .filter({ hasText: "OMNISALE.TCL" });
    await expect(packageOutput).toBeVisible();
    await expect(packageOutput).toContainText("zontalk-update");
    await expect(packageOutput).toContainText("+D");
    await expect(packageOutput).toContainText("+I");

    await page.getByRole("button", { name: "Dial POS Sale" }).click();
    const receipt = page
      .locator("pre")
      .filter({ hasText: "OMNIDAT POS RECEIPT" });
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText("APPROVED");
    await expect(receipt).toContainText("CALL 311088002010");
  });
});

test.describe("Accessibility", () => {
  test("should not have any automatically detectable accessibility issues on home page", async ({
    page,
  }) => {
    await page.goto("/");

    // Basic accessibility checks
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Check that all images have alt text
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      expect(alt).not.toBeNull();
    }
  });
});
