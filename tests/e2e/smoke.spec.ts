import { expect, test } from "@playwright/test";

test("renders the upload, review, and draft workspaces", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto("/jobs/new");
  await expect(page.getByRole("heading", { name: "인터뷰 음성 등록" })).toBeVisible();
  await expect(page.getByRole("button", { name: "전사 및 분석 시작" })).toBeDisabled();

  await page.goto("/jobs/demo/processing");
  await expect(page.getByRole("heading", { name: "전사와 분석이 완료되었습니다" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "전사 검토로 이동" })).toBeVisible();

  await page.goto("/jobs/demo/transcript");
  await expect(page.getByRole("heading", { name: "전사 검토" }), browserErrors.join("\n")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("textbox", { name: "SEG-003 전사 수정" })).toHaveValue(/\[불명확\]/);

  await page.goto("/jobs/demo/draft");
  await expect(page.getByRole("heading", { name: "기사 초안 & 취재원 대조" })).toBeVisible();
  await expect(page.getByText("사실형", { exact: true })).toBeVisible();
  const radios = page.getByRole("radio");
  await radios.nth(1).check();
  await expect(radios.nth(1)).toBeChecked();
  await page.getByRole("button", { name: /근거 SEG-002/ }).first().click();
  await expect(page.getByText("원문·음성 근거 대조")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
