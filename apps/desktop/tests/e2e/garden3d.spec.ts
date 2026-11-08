import { expect, test } from '@playwright/test';

test('3D garden: collect a bouquet, replay, and pause pointer movement', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.clock.install();
	await page.goto('/play');
	await page.getByRole('button', { name: 'থ্রিডি ফুলের বাগান', exact: true }).click();
	await expect(page.locator('canvas')).toBeVisible();
	await page.clock.runFor(100);
	await page.screenshot({ path: 'test-results/garden3d.png' });
	await page.getByRole('button', { name: 'শব্দ চালু', exact: true }).click();
	// Use the real animation loop, with a controlled clock, to walk the whole garden.
	async function walk(key: string, distance: number) {
		await page.keyboard.down(key);
		await page.clock.runFor(Math.round(distance / 3.5 * 1000));
		await page.keyboard.up(key);
	}
	await walk('ArrowUp', 2.5);
	await expect(page.locator('.status')).toContainText('১ / ৫');
	await walk('ArrowUp', 2);
	await walk('ArrowLeft', 3);
	await walk('ArrowRight', 6);
	await walk('ArrowUp', 1);
	await walk('ArrowLeft', 5);
	await walk('ArrowUp', 3);
	await walk('ArrowRight', 4);
	await walk('ArrowUp', 1);
	await expect(page.getByRole('heading', { name: 'আমাদের ফুলের তোড়া!' })).toBeVisible();
	await page.getByRole('button', { name: '▶ আবার খেলি' }).click();
	await expect(page.locator('.status')).toContainText('০ / ৫');
	await page.getByRole('button', { name: 'বিরতি', exact: true }).click();
	await walk('ArrowUp', 3);
	await expect(page.locator('.status')).toContainText('০ / ৫');
	await page.getByRole('button', { name: '▶ আবার চলি' }).click();
	const forward = page.getByRole('button', { name: 'সামনে', exact: true });
	await forward.hover();
	await page.mouse.down();
	await page.clock.runFor(720);
	await page.mouse.up();
	await expect(page.locator('.status')).toContainText('১ / ৫');
	await page.clock.runFor(2000);
	await expect(page.locator('.status')).toContainText('১ / ৫');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.getByRole('heading', { name: '3D Flower Garden' })).toBeVisible();
	await expect(page.locator('.status')).toContainText('1 / 5');
	expect(errors).toEqual([]);
});
