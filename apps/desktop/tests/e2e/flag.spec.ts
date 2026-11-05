import { expect, test } from '@playwright/test';

test('flag quiz fits the minimum desktop size and default viewport', async ({ page }) => {
	for (const viewport of [
		{ width: 800, height: 600 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/flag');

		await expect(page.getByRole('heading', { name: 'দেশের পতাকা চিনো' })).toBeInViewport();
		await expect(page.locator('.flag-panel')).toBeInViewport();
		const choices = page.locator('.choices button');
		await expect(choices).toHaveCount(4);
		for (let index = 0; index < 4; index++) {
			await expect(choices.nth(index)).toBeInViewport();
		}
		await expect(page.getByRole('button', { name: 'অন্য খেলা' })).toBeInViewport();
	}
});
