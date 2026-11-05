import { expect, test, type Page } from '@playwright/test';
import { answerFor, toBn } from '../helpers/minigames.ts';

async function playRound(page: Page, game: 'football' | 'garage' | 'birds') {
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('.option').first()).toBeVisible();
		await page.waitForTimeout(150); // let the instruction caption settle
		await page.locator(await answerFor(page, game)).click();
		const next = page.getByRole('button', { name: 'পরেরটা' });
		await expect(next).toBeVisible({ timeout: 10000 });
		await next.click();
	}
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
}

for (const [card, route, game] of [
	['ফুটবল', '/football', 'football'],
	['গাড়ি', '/car', 'garage'],
	['পাখি', '/bird', 'birds']
] as const) {
	test(`${game}: full beginner round from the mode card`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		await page.goto('/play');
		await page.getByRole('button', { name: card, exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`${route}$`));
		await playRound(page, game);
		expect(errors).toEqual([]);
	});
}

test('wrong choice returns gently, hint appears after two misses (PR-08, PR-22)', async ({ page }) => {
	await page.goto('/bird');
	await expect(page.locator('.option').first()).toBeVisible();
	const right = await answerFor(page, 'birds');
	const wrong = page.locator(`.option:not(${right})`).first();
	for (let i = 0; i < 2; i++) {
		await wrong.click();
		await expect(page.getByText('আবার চেষ্টা করি!').first()).toBeVisible();
		await page.waitForTimeout(1300);
	}
	await page.getByRole('button', { name: 'সাহায্য' }).click();
	await expect(page.locator(`.option.hinted${right}`)).toBeVisible();
	await page.locator(right).click();
	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 10000 });
});

test('birds: correct answer is announced as a total', async ({ page }) => {
	await page.goto('/bird');
	await expect(page.locator('.option').first()).toBeVisible();
	const total = await page
		.locator('.branch')
		.evaluateAll((els) => els.reduce((s, e) => s + Number(e.getAttribute('data-count')), 0));
	await page.locator(await answerFor(page, 'birds')).click();
	await expect(page.getByText(`মোট`).first()).toBeVisible({ timeout: 5000 });
	await expect(page.locator(`[data-option-id="answer-${total}"]`)).toHaveAccessibleName(toBn(total));
});
