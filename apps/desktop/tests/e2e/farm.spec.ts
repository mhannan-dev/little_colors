import { expect, test } from '@playwright/test';

/** Rumi's Farm: animals answer taps; four jobs (any order) end in a farm party. */
test('tap animals, do every job, the farm has a party', async ({ page }) => {
	test.setTimeout(150_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/farm');
	const farm = page.locator('section.farm');
	await expect(farm).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	await expect(page.locator('[data-target="hay"]')).toBeVisible({ timeout: 15000 });
	await page.waitForTimeout(1500);
	await page.screenshot({ path: 'test-results/farm.png' });
	const need = Object.fromEntries((await farm.getAttribute('data-need'))!.split(',').map((x) => x.split(':')).map(([k, v]) => [k, Number(v)]));

	await page.locator('[data-target="animal-goat"]').click();
	// Do the mangoes first: order never matters.
	for (let i = 0; i < need.mangoes; i++) await page.locator(`[data-target="mango-${i}"]`).click();
	await expect(farm).toHaveAttribute('data-mangoes', String(need.mangoes), { timeout: 8000 });
	await page.locator('[data-target="hay"]').click();
	await expect(farm).toHaveAttribute('data-cow', '1', { timeout: 8000 });
	// Eggs sit close together in the nest: any egg is fine.
	for (let i = 0; i < need.eggs; i++) {
		await page.locator('[data-target^="egg-"]').last().click();
		await expect(farm).toHaveAttribute('data-eggs', String(i + 1), { timeout: 5000 });
	}
	await expect(farm).toHaveAttribute('data-eggs', String(need.eggs), { timeout: 8000 });
	for (let i = 0; i < need.ducks; i++) await page.locator(`[data-target="duck-${i}"]`).click();
	await expect(farm).toHaveAttribute('data-ducks', String(need.ducks), { timeout: 10000 });
	await page.screenshot({ path: 'test-results/farm-party.png' });
	await expect(farm).toHaveAttribute('data-done', 'true', { timeout: 10000 });
	await page.locator('[data-action="replay"]').click();
	await expect(farm).toHaveAttribute('data-done', 'false');
	await expect(farm).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
	await expect(farm).toHaveAttribute('data-eggs', '0');
	expect(errors).toEqual([]);
});
