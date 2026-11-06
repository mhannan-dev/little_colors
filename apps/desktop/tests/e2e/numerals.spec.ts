import { expect, test } from '@playwright/test';

// Start in the app's default language (English), not the bn-BD state other tests use.
test.use({ storageState: { cookies: [], origins: [] } });

const BENGALI_DIGIT = /[০-৯]/;
const LATIN_DIGIT = /[0-9]/;

test('digits follow the language: English → 123, বাংলা → ১২৩', async ({ page }) => {
	await page.goto('/animals');
	await page.locator('section.detective .modes button').nth(1).click(); // count the animals
	const numbers = page.locator('section.detective .numbers button .num');
	await expect(numbers).toHaveCount(3);
	for (const t of await numbers.allInnerTexts()) {
		expect(t, 'English shows Latin digits').toMatch(LATIN_DIGIT);
		expect(t).not.toMatch(BENGALI_DIGIT);
	}

	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	for (const t of await numbers.allInnerTexts()) {
		expect(t, 'Bangla shows Bengali digits').toMatch(BENGALI_DIGIT);
		expect(t).not.toMatch(LATIN_DIGIT);
	}

	await page.getByRole('button', { name: 'English', exact: true }).click();
	for (const t of await numbers.allInnerTexts()) expect(t).toMatch(LATIN_DIGIT);
});

test('digits follow the language after a reload too', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await page.goto('/numbers');
	await expect(page.locator('.field')).toBeVisible();
	await page.reload();
	await page.locator('button.count-object').first().click();
	await expect(page.locator('.obj .badge').first()).toHaveText('১');
});
