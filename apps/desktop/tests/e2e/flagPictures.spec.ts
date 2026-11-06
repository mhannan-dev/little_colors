import { expect, test, type Page } from '@playwright/test';

/** Pick the option whose country name appears in the spoken/captioned question. */
async function answerFor(page: Page): Promise<string> {
	const text = await page.getByTestId('flag-picture-prompt').innerText();
	const options = await page.locator('[data-flag-picture]').evaluateAll((els) =>
		els.map((e) => ({ id: (e as HTMLElement).dataset.flagPicture!, name: e.getAttribute('aria-label') ?? '' }))
	);
	const hit = options.find((o) => o.name && text.includes(o.name));
	expect(hit, `question "${text}" names exactly one option`).toBeTruthy();
	return hit!.id;
}

test('picture mode is the default: hear a country, pick its flag from 3 pictures (PR-27)', async ({ page }) => {
	await page.goto('/flag');
	await expect(page.getByTestId('flag-pictures')).toBeVisible();
	await expect(page.getByTestId('flag-pictures-tab')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('flag-region')).toHaveCount(0);
	// Every round starts with Bangladesh.
	await expect(page.locator('[data-flag-picture="bd"]')).toBeVisible();
	const options = page.locator('[data-flag-picture]');
	await expect(options).toHaveCount(3);
	// Choices are pictures only: no visible words to read.
	for (const t of await options.allInnerTexts()) expect(t.trim()).toBe('');
	await expect
		.poll(() => options.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0)))
		.toBe(true);

	expect(await answerFor(page)).toBe('bd');
	await page.locator('[data-flag-picture="bd"]').click();
	await expect(page.locator('[data-flag-picture="bd"]')).toHaveClass(/correct/);
	await expect(page.locator('[data-action="next"]')).toBeVisible();
});

test('a full round of 8 flags ends with the badge and replay', async ({ page }) => {
	await page.goto('/flag');
	for (let i = 0; i < 8; i++) {
		await expect(page.getByTestId('flag-picture-prompt')).toBeVisible();
		await page.locator(`[data-flag-picture="${await answerFor(page)}"]`).click();
		await page.locator('[data-action="next"]').click();
	}
	await expect(page.locator('[data-action="replay"]')).toBeVisible();
	await page.locator('[data-action="replay"]').click();
	await expect(page.locator('[data-flag-picture="bd"]')).toBeVisible();
	expect(await answerFor(page)).toBe('bd');
});

test('help: offered after one miss, shown by itself after two (PR-22)', async ({ page }) => {
	await page.goto('/flag');
	const wrong = page.locator('[data-flag-picture]:not([data-flag-picture="bd"])').first();
	await expect(page.locator('[data-action="hint"]')).toHaveCount(0);
	await wrong.click();
	await expect(page.locator('[data-action="hint"]')).toBeVisible();
	await wrong.click();
	await expect(page.locator('[data-flag-picture="bd"]')).not.toHaveClass(/correct/);
	await expect(page.locator('[data-flag-picture="bd"]')).toHaveClass(/hinted/);
	await expect(page.getByTestId('ghost-hand')).toHaveClass(/show/);
});

test('the name quiz and the flag explorer are still one tap away', async ({ page }) => {
	await page.goto('/flag');
	await page.getByTestId('flag-quiz-tab').click();
	await expect(page.getByTestId('flag-panel')).toBeVisible();
	await page.getByTestId('flag-learn-tab').click();
	await expect(page.locator('[data-gallery-country]').first()).toBeVisible();
	await page.getByTestId('flag-pictures-tab').click();
	await expect(page.getByTestId('flag-pictures')).toBeVisible();
});

test('English mode asks in English', async ({ page }) => {
	await page.goto('/flag');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await expect(page.getByTestId('flag-picture-prompt')).toContainText('Which is the flag of');
});

test('the help button shows the answer after one miss', async ({ page }) => {
	await page.goto('/flag');
	await page.locator('[data-flag-picture]:not([data-flag-picture="bd"])').first().click();
	await page.locator('[data-action="hint"]').click();
	await expect(page.locator('[data-flag-picture="bd"]')).toHaveClass(/hinted/);
});
