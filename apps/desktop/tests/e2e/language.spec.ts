import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('defaults to English and keeps the current game round when switching languages', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
	await expect(page.getByRole('heading', { name: 'Rumi Learning Adventures' })).toBeVisible();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await page.getByRole('button', { name: 'Animal Detective', exact: true }).click();
	await page.getByRole('button', { name: /Count the animals/ }).click();

	const photos = page.locator('.photo');
	await expect(photos).toHaveCount(7);
	await photos.first().click();
	const images = () => photos.locator('img').evaluateAll(items => items.map(item => item.getAttribute('src')));
	const round = await images();

	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await expect(page.getByRole('heading', { name: /কয়টি ছবিতে/ })).toBeVisible();
	await expect(photos.first()).toHaveAttribute('aria-pressed', 'true');
	expect(await images()).toEqual(round);

	await page.reload();
	await expect(page.getByRole('button', { name: 'বাংলা', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.reload();
	await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('heading', { name: 'Animal Detective' })).toBeVisible();
});
