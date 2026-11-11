import { expect, test } from '@playwright/test';

/** Shape Sorter: the wrong hole bounces back (never fails), right holes plop, a full box opens. */
test('sort every shape; a wrong hole just bounces back; then the lid pops', async ({ page }) => {
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/shape-sorter');
	const scene = page.locator('section.sorter');
	await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	await expect(page.locator('[data-piece]').first()).toBeVisible({ timeout: 10000 });
	await page.screenshot({ path: 'test-results/sorter.png' });
	const total = Number(await scene.getAttribute('data-left'));

	// A wrong hole first: nothing is lost, the piece comes back.
	const first = page.locator('[data-piece]').first();
	const shape = (await first.getAttribute('data-shape'))!;
	const wrong = page.locator(`[data-hole]:not([data-hole-shape="${shape}"])`).first();
	await first.click();
	await expect(scene).toHaveAttribute('data-lifted', /piece/);
	await wrong.click();
	await expect(scene).toHaveAttribute('data-tries', '1');
	await expect(scene).toHaveAttribute('data-left', String(total));
	await expect(scene).toHaveAttribute('data-busy', 'false', { timeout: 5000 });

	for (let k = 0; k < total; k++) {
		const piece = page.locator('[data-piece]').first();
		const s = (await piece.getAttribute('data-shape'))!;
		await expect(scene).toHaveAttribute('data-busy', 'false', { timeout: 5000 });
		await piece.click();
		await page.locator(`[data-hole-shape="${s}"]`).click();
		await expect(scene).toHaveAttribute('data-left', String(total - k - 1), { timeout: 5000 });
		if (k === 0) await page.screenshot({ path: 'test-results/sorter-plop.png' });
	}
	await expect(scene).toHaveAttribute('data-done', 'true', { timeout: 10000 });
	await page.screenshot({ path: 'test-results/sorter-done.png' });
	await page.locator('[data-action="replay"]').click();
	await expect(scene).toHaveAttribute('data-done', 'false');
	expect(errors).toEqual([]);
});
