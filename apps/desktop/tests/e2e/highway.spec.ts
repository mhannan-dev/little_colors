import { expect, test } from '@playwright/test';

/** Rumi's Highway: pedals, lanes, horn, pause menu, places. A crash must be impossible. */
test('drive: gas speeds up, gears climb, lanes change, traffic is passed and never hit', async ({ page }) => {
	test.setTimeout(150_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/highway');
	await page.locator('[data-place="green"]').click({ timeout: 60000 });
	const hw = page.locator('section.highway');
	await expect(hw).toHaveAttribute('data-ready', 'true', { timeout: 30000 });

	// Hold the gas pedal (pointer), the speedometer and gear go up.
	const gas = page.getByTestId('gas');
	const box = (await gas.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect.poll(async () => Number(await hw.getAttribute('data-speed')), { timeout: 15000 }).toBeGreaterThan(55);
	await page.mouse.up();
	expect(Number(await hw.getAttribute('data-gear'))).toBeGreaterThanOrEqual(4);
	await page.screenshot({ path: 'test-results/highway.png' });

	// Lanes: keep changing lanes and holding the gas with the keyboard; traffic gets passed.
	await page.keyboard.down('ArrowUp');
	await expect(async () => {
		const lane = Number(await hw.getAttribute('data-lane'));
		await page.keyboard.press(lane === 0 ? 'ArrowRight' : 'ArrowLeft');
		expect(Number(await hw.getAttribute('data-passes'))).toBeGreaterThan(1);
	}).toPass({ timeout: 90000, intervals: [1500] });
	await page.keyboard.up('ArrowUp');
	// Never closer than the safety gap: the car slowed down by itself instead of crashing.
	expect(Number(await hw.getAttribute('data-min-gap'))).toBeGreaterThan(0);

	// Brake brings the car down.
	await page.keyboard.down('ArrowDown');
	await expect.poll(async () => Number(await hw.getAttribute('data-speed')), { timeout: 10000 }).toBeLessThan(5);
	await page.keyboard.up('ArrowDown');
	await page.getByTestId('horn').click();
	expect(errors).toEqual([]);
});

test('pause menu: continue, camera, restart and change place', async ({ page }) => {
	await page.goto('/highway');
	await page.locator('[data-place="sunset"]').click({ timeout: 60000 });
	const hw = page.locator('section.highway');
	await expect(hw).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
	await page.getByTestId('pause').click();
	await expect(hw).toHaveAttribute('data-menu', 'true');
	await page.screenshot({ path: 'test-results/highway-menu.png' });
	await page.getByTestId('camera').click();
	await expect(hw).toHaveAttribute('data-camera', 'high');
	await page.getByTestId('continue').click();
	await expect(hw).toHaveAttribute('data-menu', 'false');
	await page.keyboard.press('Escape');
	await expect(hw).toHaveAttribute('data-menu', 'true');
	await page.getByTestId('restart').click();
	await expect(hw).toHaveAttribute('data-menu', 'false');
	await expect(hw).toHaveAttribute('data-lane', '1');
	await page.getByTestId('pause').click();
	await page.getByTestId('place').click();
	await expect(page.locator('[data-place="city"]')).toBeVisible();
	await page.locator('[data-place="city"]').click();
	await expect(hw).toHaveAttribute('data-location', 'city');
	await expect(hw).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
	await page.screenshot({ path: 'test-results/highway-city.png' });
});
