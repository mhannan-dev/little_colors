import { expect, test, type Page } from '@playwright/test';
import { field, fromBn, solve, toBn } from '../helpers/numbers.ts';

async function playRound(page: Page) {
	for (let i = 0; i < 5; i++) {
		await expect(field(page)).toBeVisible();
		await solve(page);
		const next = page.getByRole('button', { name: 'পরেরটা' });
		await expect(next).toBeVisible({ timeout: 15000 });
		await next.click();
	}
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
}

test('full beginner numbers round from mode selection', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.goto('/play');
	await page.getByRole('button', { name: 'সংখ্যা গোনা' }).click();
	await playRound(page);
	expect(errors).toEqual([]);
});

test('counting: an object is never counted twice (NC-30)', async ({ page }) => {
	// Beginner rounds start with a count activity; reload until it has ≥ 2 objects.
	const objs = page.locator('button.count-object');
	for (let tries = 0; tries < 20; tries++) {
		await page.goto('/numbers');
		await expect(field(page)).toHaveAttribute('data-kind', 'count');
		if ((await objs.count()) >= 2) break;
	}
	expect(await objs.count()).toBeGreaterThanOrEqual(2);
	await objs.nth(0).click();
	await objs.nth(0).click();
	await objs.nth(0).click();
	await expect(objs.nth(0).locator('.badge')).toHaveText(toBn(1));
	await objs.nth(1).click();
	await expect(objs.nth(1).locator('.badge')).toHaveText(toBn(2));
});

test('counting: "count with me" hint counts every object aloud (NC-12, NC-13)', async ({ page }) => {
	await page.goto('/numbers');
	await expect(field(page)).toHaveAttribute('data-kind', 'count');
	const n = await page.locator('button.count-object').count();
	await page.getByRole('button', { name: 'চলো একসাথে গুনি' }).click();
	await expect(page.locator('.obj .badge').last()).toHaveText(toBn(n), { timeout: 10000 });
	await expect(page.locator('.obj .badge')).toHaveCount(n);
});

test('wrong answers get gentle retry, then the hint appears (NC-11, NC-12)', async ({ page }) => {
	await page.goto('/numbers');
	// Finish the first (count) activity to reach numeral-to-quantity.
	await solve(page);
	await page.getByRole('button', { name: 'পরেরটা' }).click({ timeout: 15000 });
	await expect(field(page)).toHaveAttribute('data-kind', 'numeral-to-quantity');
	const n = fromBn((await page.getByTestId('target-number').textContent())!.trim());
	const wrong = page.locator(`button.basket:not([data-count="${n}"])`).first();
	for (let i = 0; i < 2; i++) {
		await wrong.click();
		await expect(page.getByText('চলো আবার গুনে দেখি!').first()).toBeVisible();
		await page.waitForTimeout(1400);
	}
	await expect(page.getByRole('button', { name: 'চলো একসাথে গুনি' })).toBeVisible();
	await page.locator(`button.basket[data-count="${n}"]`).click();
	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 15000 });
});
