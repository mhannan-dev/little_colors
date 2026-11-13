import { expect, test, type Page } from '@playwright/test';

/** Fly toward the target pad with the keyboard, low, until the helicopter lands by itself. */
async function flyTo(page: Page, heli: ReturnType<Page['locator']>, phaseAfter: string) {
	let dir: string | null = null;
	await expect(async () => {
		const phase = await heli.getAttribute('data-phase');
		if (phase !== 'fly') {
			if (dir) await page.keyboard.up(dir);
			dir = null;
			expect(phase).toMatch(new RegExp(phaseAfter));
			return;
		}
		const x = Number(await heli.getAttribute('data-x'));
		const tx = Number(await heli.getAttribute('data-target-x'));
		const want = tx > x ? 'ArrowRight' : 'ArrowLeft';
		if (dir !== want) {
			if (dir) await page.keyboard.up(dir);
			await page.keyboard.down(want);
			dir = want;
		}
		throw new Error(`flying x=${x} → ${tx}`);
	}).toPass({ timeout: 90000, intervals: [250] });
}

test('jobs: take off, deliver everything, fly home, party; never touches a tree or hill', async ({ page }) => {
	test.setTimeout(300_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/helicopter');
	const heli = page.locator('section.heli');
	await expect(heli).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	await page.screenshot({ path: 'test-results/heli-pick.png' });
	await page.locator('[data-heli-mode="jobs"]').click();
	await expect(heli).toHaveAttribute('data-mode', 'jobs');

	// Hold the up button: the helicopter rises.
	const up = page.getByTestId('heli-up');
	const box = (await up.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect.poll(async () => Number(await heli.getAttribute('data-y')), { timeout: 8000 }).toBeGreaterThan(4);
	await page.mouse.up();
	await page.screenshot({ path: 'test-results/heli-fly.png' });

	const jobs = Number(await heli.getAttribute('data-jobs'));
	for (let j = 0; j < jobs; j++) {
		await flyTo(page, heli, 'landing|deliver');
		await expect(heli).toHaveAttribute('data-delivered', String(j + 1), { timeout: 15000 });
		if (j === 0) await page.screenshot({ path: 'test-results/heli-deliver.png' });
		await expect(heli).toHaveAttribute('data-phase', 'fly', { timeout: 10000 });
	}
	await flyTo(page, heli, 'landing|deliver|party');
	await expect(heli).toHaveAttribute('data-done', 'true', { timeout: 15000 });
	await page.screenshot({ path: 'test-results/heli-party.png' });
	const clear = await heli.getAttribute('data-min-clear');
	expect(clear === 'none' || Number(clear) > 0).toBe(true);
	expect(errors).toEqual([]);
});

test('free flight: fly around, land anywhere', async ({ page }) => {
	await page.goto('/helicopter');
	const heli = page.locator('section.heli');
	await expect(heli).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	await page.locator('[data-heli-mode="free"]').click();
	await page.keyboard.down('ArrowUp');
	await page.keyboard.down('ArrowRight');
	await page.waitForTimeout(3500);
	await page.keyboard.up('ArrowUp');
	await page.waitForTimeout(2500);
	await page.keyboard.up('ArrowRight');
	await page.screenshot({ path: 'test-results/heli-free.png' });
	expect(Number(await heli.getAttribute('data-x'))).toBeGreaterThan(10);
});
