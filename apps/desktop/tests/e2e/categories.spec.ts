import { expect, test } from '@playwright/test';

/** Game picker: every game sits in one category; category buttons filter; search still works. */
test('category buttons show one kind of game at a time', async ({ page }) => {
	await page.goto('/play');
	await page.getByTestId('game-search').waitFor({ timeout: 60000 });
	const all = await page.locator('button.card').count();
	expect(all).toBeGreaterThan(20);
	await page.screenshot({ path: 'test-results/categories-all.png' });

	await page.locator('[data-chip="drive"]').click();
	await expect(page.locator('[data-chip="drive"]')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.cards')).toHaveCount(1);
	await expect(page.locator('.cards[data-group="drive"] button.card')).toHaveCount(5);
	await page.screenshot({ path: 'test-results/categories-drive.png' });

	await page.locator('[data-chip="habits"]').click();
	await expect(page.locator('button.card')).toHaveCount(2);

	// Tapping the same category again shows everything.
	await page.locator('[data-chip="habits"]').click();
	await expect(page.locator('button.card')).toHaveCount(all);

	// Search works on its own (and an English "s" is no longer dropped).
	await page.getByTestId('game-search').fill('bus');
	await expect(page.locator('button.card')).toHaveCount(1);
	await page.getByTestId('game-search').fill('');
	await page.locator('[data-chip="all"]').click();
	await expect(page.locator('button.card')).toHaveCount(all);
});
