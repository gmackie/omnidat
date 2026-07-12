import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display OMNIDAT exchange heading", async ({ page }) => {
    await page.goto("/");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/OMNIDAT|X\.25|camp/i);
  });

  test("should link to login and operator surfaces", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /^Login$/i }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Operator Console/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^NOC$/i }).first()).toBeVisible();
  });
});

test.describe("Login", () => {
  test("should offer OmniAuth for operators", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /Login/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in with OmniAuth/i }),
    ).toBeVisible();
  });
});

test.describe("OMNIDAT Console (auth-gated)", () => {
  test("guest sees authorized access gate", async ({ page }) => {
    await page.goto("/console");

    await expect(
      page.getByRole("heading", { name: /Authorized access required/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Sign in with OmniAuth/i }),
    ).toBeVisible();
  });

  test("guest NOC shows circuit board and gated session copy", async ({
    page,
  }) => {
    await page.goto("/noc");

    await expect(
      page.getByRole("heading", { name: /Network Operations Center/i }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Packet Sessions/i).first()).toBeVisible();
    await expect(
      page.getByText(/AUTH\/ROLE REQUIRED|NO SESSIONS/i).first(),
    ).toBeVisible();
  });

  test("terminal page exposes VT100 PAD chrome", async ({ page }) => {
    await page.goto("/console/terminal");

    await expect(page.getByRole("heading", { name: /VT100 PAD/i })).toBeVisible();
    await expect(page.getByText(/DIR|CALL|PAD/i).first()).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("home main landmark is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });
});
