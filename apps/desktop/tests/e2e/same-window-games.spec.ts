import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('Formula Circuit opens and closes inside the current page', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Formula Circuit', exact: true }).click();
	await expect(page).toHaveURL(/\/formula-circuit$/);
	const frame = page.locator('iframe[title="Formula Circuit"]');
	await expect(frame).toBeVisible();
	await expect(frame.contentFrame().locator('#formula-canvas')).toBeVisible();
	expect(page.context().pages()).toHaveLength(1);
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await expect(page).toHaveURL(/\/play$/);
	await expect(frame).toHaveCount(0);
});
