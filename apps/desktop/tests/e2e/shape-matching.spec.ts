import { expect, test, type Locator, type Page } from '@playwright/test';

const PLACE = 'জায়গা: ';

const sources = (page: Page) => page.locator('.sources button.source');
const targetFor = (page: Page, name: string) =>
	page.getByRole('button', { name: `${PLACE}${name}`, exact: true });

async function nameOf(el: Locator) {
	return (await el.getAttribute('aria-label')) ?? '';
}

async function center(el: Locator) {
	const b = (await el.boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

type Method = 'tap' | 'drag' | 'keyboard';

async function matchAll(page: Page, method: Method) {
	await expect(sources(page).first()).toBeVisible();
	while ((await sources(page).count()) > 0) {
		const src = sources(page).first();
		const name = await nameOf(src);
		const target = targetFor(page, name);
		if (method === 'tap') {
			await src.click();
			await target.click();
		} else if (method === 'keyboard') {
			await src.focus();
			await page.keyboard.press('Enter');
			await target.focus();
			await page.keyboard.press('Enter');
		} else {
			const from = await center(src);
			const to = await center(target);
			await page.mouse.move(from.x, from.y);
			await page.mouse.down();
			await page.mouse.move(from.x + 20, from.y + 10, { steps: 3 });
			await page.mouse.move(to.x, to.y, { steps: 12 });
			await page.mouse.up();
		}
		await expect(target.locator('.snapped')).toBeVisible();
		await page.waitForTimeout(500);
	}
}

async function playRound(page: Page, method: Method) {
	for (let i = 0; i < 5; i++) {
		await matchAll(page, method);
		const next = page.getByRole('button', { name: 'পরেরটা' });
		await expect(next).toBeVisible({ timeout: 8000 });
		await next.click();
	}
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
}

test('full beginner round by tap only, from mode selection (SM-21)', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	await page.goto('/play');
	await page.getByRole('button', { name: 'আকার মেলানো' }).click();
	await expect(page.getByText(/মেলাই!/).first()).toBeVisible();
	await playRound(page, 'tap');
	expect(errors).toEqual([]);
});

test('full beginner round by drag only (SM-20, SM-23)', async ({ page }) => {
	await page.goto('/matching');
	await playRound(page, 'drag');
});

test('keyboard only completes an activity (SM-22)', async ({ page }) => {
	await page.goto('/matching');
	await matchAll(page, 'keyboard');
	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 8000 });
});

test('wrong match returns gently, hint appears after two misses (PR-08, SM-30)', async ({ page }) => {
	await page.goto('/matching');
	const src = sources(page).first();
	const name = await nameOf(src);
	const wrong = page
		.locator('.targets button.target')
		.filter({ hasNot: page.locator(`[aria-label="${PLACE}${name}"]`) })
		.and(page.locator(`:not([aria-label="${PLACE}${name}"])`))
		.first();

	for (let miss = 1; miss <= 2; miss++) {
		await src.click();
		await wrong.click();
		await expect(page.getByText('আবার চেষ্টা করি!').first()).toBeVisible();
		await page.waitForTimeout(600);
		await expect(sources(page)).toHaveCount(1); // returned, not matched
	}
	const hint = page.getByRole('button', { name: 'সাহায্য' });
	await expect(hint).toBeVisible();
	await hint.click();
	await expect(page.locator('.target.hinted')).toHaveAttribute('aria-label', `${PLACE}${name}`);
});

test('drag released on empty space returns the item (SM-40)', async ({ page }) => {
	await page.goto('/matching');
	const src = sources(page).first();
	const from = await center(src);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x, from.y - 200, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(600);
	await expect(sources(page)).toHaveCount(1);
	await expect(page.locator('.snapped')).toHaveCount(0);
});
