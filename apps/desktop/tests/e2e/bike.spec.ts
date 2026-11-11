import { expect, test } from '@playwright/test';

/** Rumi's Bicycle: pedal, fruit basket, bell, traffic light, pause menu. Nothing can be hit. */
test('ride: pedal speeds up, fruit lands in the basket, the light stops the bike, the bell rings', async ({ page }) => {
	test.setTimeout(240_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/bike');
	await page.locator('[data-place="park"]').click({ timeout: 60000 });
	const bike = page.locator('section.bike');
	await expect(bike).toHaveAttribute('data-ready', 'true', { timeout: 30000 });

	const pedal = page.getByTestId('pedal');
	const box = (await pedal.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect.poll(async () => Number(await bike.getAttribute('data-speed')), { timeout: 15000 }).toBeGreaterThan(14);
	await page.mouse.up();
	await page.screenshot({ path: 'test-results/bike.png' });

	// Keep pedalling (keyboard) and weave between lanes: fruit gets picked, a crossing comes up.
	await page.keyboard.down('ArrowUp');
	let sawLight = false;
	await expect(async () => {
		const lane = Number(await bike.getAttribute('data-lane'));
		await page.keyboard.press(lane === 0 ? 'ArrowRight' : 'ArrowLeft');
		if ((await bike.getAttribute('data-light')) !== 'none') sawLight = true;
		expect(Number(await bike.getAttribute('data-picked'))).toBeGreaterThan(0);
		expect(sawLight).toBe(true);
	}).toPass({ timeout: 150000, intervals: [1200] });
	await page.screenshot({ path: 'test-results/bike-light.png' });
	await page.keyboard.up('ArrowUp');
	// Nothing was ever hit.
	expect(Number(await bike.getAttribute('data-min-gap'))).toBeGreaterThan(0);
	expect(Number(await bike.getAttribute('data-basket'))).toBeGreaterThan(0);

	await page.getByTestId('bell').click();
	await expect(bike).toHaveAttribute('data-rings', '1');
	expect(errors).toEqual([]);
});

test('pause menu: continue, camera, restart and change place', async ({ page }) => {
	await page.goto('/bike');
	await page.locator('[data-place="village"]').click({ timeout: 60000 });
	const bike = page.locator('section.bike');
	await expect(bike).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
	await page.keyboard.down('ArrowUp');
	await page.waitForTimeout(4000);
	await page.keyboard.up('ArrowUp');
	await page.screenshot({ path: 'test-results/bike-village.png' });
	await page.getByTestId('pause').click();
	await expect(bike).toHaveAttribute('data-menu', 'true');
	await page.getByTestId('camera').click();
	await expect(bike).toHaveAttribute('data-camera', 'side');
	await page.getByTestId('continue').click();
	await page.waitForTimeout(800);
	await page.screenshot({ path: 'test-results/bike-side.png' });
	await page.keyboard.press('Escape');
	await page.getByTestId('restart').click();
	await expect(bike).toHaveAttribute('data-menu', 'false');
	await expect(bike).toHaveAttribute('data-basket', '0');
	await page.getByTestId('pause').click();
	await page.getByTestId('place').click();
	await page.locator('[data-place="river"]').click();
	await expect(bike).toHaveAttribute('data-place', 'river');
	await expect(bike).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
	await page.keyboard.down('ArrowUp');
	await page.waitForTimeout(4000);
	await page.keyboard.up('ArrowUp');
	await page.screenshot({ path: 'test-results/bike-river.png' });
});
