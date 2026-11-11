import { expect, test } from '@playwright/test';

test('game search finds games by Bengali or English name, and says when nothing matches', async ({ page }) => {
	await page.goto('/play');
	const search = page.getByTestId('game-search');
	await expect(search).toBeVisible({ timeout: 60000 });
	const total = await page.locator('.card').count();
	await search.fill('গাড়ি');
	await expect(page.getByRole('button', { name: 'রুমির খেলনা গাড়ি', exact: true })).toBeVisible();
	expect(await page.locator('.card').count()).toBeLessThan(total);
	await search.fill('flower');
	await expect(page.getByRole('button', { name: 'ফুল চিনি ও গুনি', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'ফুটবল', exact: true })).toHaveCount(0);
	await page.screenshot({ path: 'test-results/search.png' });
	await search.fill('zzzz');
	await expect(page.getByTestId('no-results')).toBeVisible();
	await search.press('Escape');
	await expect(search).toHaveValue('');
	expect(await page.locator('.card').count()).toBe(total);
	// A found game opens as usual.
	await search.fill('bike');
	await page.getByRole('button', { name: 'রুমির সাইকেল', exact: true }).click();
	await expect(page).toHaveURL(/\/bike$/);
});
