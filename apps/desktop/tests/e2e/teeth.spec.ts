import { expect, test, type Page } from '@playwright/test';

/** Rub side to side across one part of the mouth, like a child would. */
async function rub(page: Page, zone: string, times = 6) {
	const box = (await page.locator(`[data-zone="${zone}"]`).boundingBox())!;
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + box.width * 0.15, y);
	await page.mouse.down();
	for (let i = 0; i < times; i++) {
		await page.mouse.move(box.x + box.width * 0.85, y + 4, { steps: 6 });
		await page.mouse.move(box.x + box.width * 0.15, y - 4, { steps: 6 });
	}
	await page.mouse.up();
}

/** Toothie's Morning Adventure: eat, paste, brush any way, rinse, mirror, balloons, sticker. */
test('a full morning: every part gets clean, then balloons and a sticker (always)', async ({ page }) => {
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/teeth');
	const scene = page.locator('section.teeth');
	await page.locator('.friend-card[data-friend="panda"]').click({ timeout: 60000 });
	await expect(scene).toHaveAttribute('data-step', 'eat');
	await page.screenshot({ path: 'test-results/teeth-eat.png' });
	for (const food of await page.locator('.food').all()) await food.click();
	await expect(scene).toHaveAttribute('data-step', 'paste', { timeout: 10000 });
	await page.screenshot({ path: 'test-results/teeth-dirty.png' });
	await page.getByTestId('toothpaste').click();
	await expect(scene).toHaveAttribute('data-step', 'brush', { timeout: 5000 });

	// Part-way: dirt goes down and the first part sparkles.
	await rub(page, 'top-left');
	await expect(scene).toHaveAttribute('data-clean', '1');
	await page.screenshot({ path: 'test-results/teeth-brushing.png' });
	for (const z of ['bottom-right', 'top-right', 'bottom-left']) await rub(page, z);
	await expect(scene).toHaveAttribute('data-clean', '4');
	await expect(scene).toHaveAttribute('data-step', 'rinse', { timeout: 8000 });
	await page.getByTestId('cup').click();
	await expect(scene).toHaveAttribute('data-step', 'mirror', { timeout: 8000 });
	await page.screenshot({ path: 'test-results/teeth-mirror.png' });
	await expect(scene).toHaveAttribute('data-step', 'celebrate', { timeout: 10000 });
	await expect(scene).toHaveAttribute('data-stickers', '1');
	// Balloons float (they never hold still), so tap via the event.
	await page.locator('[data-balloon]').first().dispatchEvent('click');
	await expect(scene).toHaveAttribute('data-popped', '1');
	await page.screenshot({ path: 'test-results/teeth-party.png' });
	expect(errors).toEqual([]);
});

test('keyboard brushing works too, and "brush with me" walks through the song', async ({ page }) => {
	await page.goto('/teeth');
	const scene = page.locator('section.teeth');
	await page.locator('.friend-card[data-friend="bunny"]').click({ timeout: 60000 });
	for (const food of await page.locator('.food').all()) await food.click();
	await page.getByTestId('toothpaste').click({ timeout: 10000 });
	await expect(scene).toHaveAttribute('data-step', 'brush', { timeout: 5000 });
	await page.locator('[data-zone="top-left"]').focus();
	for (let i = 0; i < 4; i++) await page.keyboard.press('Enter');
	await expect(scene).toHaveAttribute('data-clean', '1');

	await page.goto('/teeth');
	await page.getByTestId('real-brush').click({ timeout: 60000 });
	await expect(scene).toHaveAttribute('data-step', 'real');
	await expect(scene).toHaveAttribute('data-real-zone', '0', { timeout: 10000 });
	await page.screenshot({ path: 'test-results/teeth-real.png' });
	for (let i = 0; i < 4; i++) await page.locator('[data-action="next"]').click();
	await expect(scene).toHaveAttribute('data-step', 'rinse');
	await page.getByTestId('cup').click();
	await expect(scene).toHaveAttribute('data-step', 'celebrate', { timeout: 12000 });
});
