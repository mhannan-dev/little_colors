import { expect, test } from '@playwright/test';

/** Rumi's Train: go, friends board at each coloured station (counting), toot, home. */
test('a whole trip: three stations, every friend aboard, home with a party', async ({ page }) => {
	test.setTimeout(240_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/train');
	const train = page.locator('section.train');
	await expect(train).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	await page.waitForTimeout(800);
	await page.screenshot({ path: 'test-results/train-start.png' });
	await page.getByTestId('whistle').click();
	await expect(train).toHaveAttribute('data-whistles', '1');
	await page.locator('[data-action="play"]').click();
	let boarded = 0;
	for (let s = 0; s < 3; s++) {
		await expect(train).toHaveAttribute('data-stop', String(s));
		await expect(train).toHaveAttribute('data-phase', 'board', { timeout: 60000 });
		if (s === 0) await page.screenshot({ path: 'test-results/train-station.png' });
		const need = Number(await train.getAttribute('data-need'));
		for (let j = 0; j < need; j++) {
			await page.locator(`[data-rider="${s}-${j}"]`).click();
			boarded++;
			await expect(train).toHaveAttribute('data-boarded', String(boarded), { timeout: 5000 });
		}
		await expect(train).toHaveAttribute('data-phase', 'aboard', { timeout: 5000 });
		if (s === 1) await page.screenshot({ path: 'test-results/train-aboard.png' });
		await page.getByTestId('whistle').click();
		await expect(train).toHaveAttribute('data-phase', 'run');
		if (s === 0) {
			await page.waitForTimeout(6000);
			await page.screenshot({ path: 'test-results/train-ride.png' });
		}
	}
	await expect(train).toHaveAttribute('data-phase', 'home', { timeout: 60000 });
	await expect(train).toHaveAttribute('data-done', 'true', { timeout: 20000 });
	await page.screenshot({ path: 'test-results/train-home.png' });
	expect(errors).toEqual([]);
});
