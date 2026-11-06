/**
 * UI gallery: walks the app and saves screenshots to docs/ui/.
 * Regenerate after UI changes with:  pnpm --filter desktop ui:shots
 */
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { field, solve } from '../helpers/numbers.ts';
import { saveWebpScreenshot } from './webpScreenshot.ts';

const OUT = fileURLToPath(new URL('../../../../docs/ui/', import.meta.url));
const shot = (page: Page, name: string) => saveWebpScreenshot(page, `${OUT}${name}.webp`);
const settle = (page: Page, ms = 1200) => page.waitForTimeout(ms);

test.describe.configure({ mode: 'serial' });

test('main flow at 1280×800', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });

	await page.goto('/');
	await expect(page.getByRole('button', { name: 'খেলি' })).toBeVisible();
	await settle(page);
	await shot(page, '01-welcome');

	await page.getByRole('button', { name: 'খেলি' }).click();
	await expect(page.getByRole('heading', { name: 'কোন খেলা খেলবে?' })).toBeVisible();
	await settle(page, 600);
	await shot(page, '02-mode-selection');

	await page.getByRole('button', { name: 'রং মেশানো' }).click();
	await expect(page.getByRole('img', { name: 'সাদা ফুটবল' })).toBeVisible();
	await settle(page, 600);
	await shot(page, '03-mixing-ready');

	await page.getByRole('button', { name: 'লাল', exact: true }).click();
	await page.waitForTimeout(250);
	await shot(page, '04-mixing-pouring-red');

	await expect(page.getByRole('img', { name: 'লাল ফুটবল' })).toBeVisible();
	await settle(page);
	await shot(page, '05-mixing-red-applied');

	await page.getByRole('button', { name: 'হলুদ', exact: true }).click();
	await page.waitForTimeout(1500);
	await shot(page, '06-mixing-swirl');

	await expect(page.getByRole('img', { name: 'কমলা ফুটবল' })).toBeVisible({ timeout: 5000 });
	await settle(page, 700);
	await shot(page, '07-mixing-result-orange');

	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 8000 });
	await settle(page, 400);
	await shot(page, '08-mixing-goal-next');

	// Finish the round to reach the completion screen.
	for (const [a, b] of [
		['হলুদ', 'নীল'],
		['লাল', 'নীল']
	] as const) {
		await page.getByRole('button', { name: 'পরেরটা' }).click();
		await page.getByRole('button', { name: a, exact: true }).click();
		await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
		await page.waitForTimeout(1000);
		await page.getByRole('button', { name: b, exact: true }).click();
		await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 10000 });
	}
	await page.getByRole('button', { name: 'পরেরটা' }).click();
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
	await settle(page, 2000);
	await shot(page, '09-round-complete');

});

test('shape matching at 1280×800', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/play');
	await page.getByRole('button', { name: 'আকার মেলানো' }).click();
	const src = page.locator('.sources button.source').first();
	await expect(src).toBeVisible();
	await settle(page, 800);
	await shot(page, '13-matching-ready');

	const name = (await src.getAttribute('aria-label')) ?? '';
	await src.click();
	await settle(page, 600);
	await shot(page, '14-matching-selected');

	// Mid-drag toward the right target.
	await page.keyboard.press('Escape');
	await page.locator('.field').click({ position: { x: 5, y: 5 } });
	const target = page.getByRole('button', { name: `জায়গা: ${name}`, exact: true });
	const a = (await src.boundingBox())!;
	const b = (await target.boundingBox())!;
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
	await page.mouse.down();
	await page.mouse.move((a.x + b.x) / 2 + 60, (a.y + b.y) / 2 - 20, { steps: 10 });
	await settle(page, 200);
	await shot(page, '15-matching-dragging');
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
	await page.mouse.up();
	await expect(target.locator('.snapped')).toBeVisible();
	await settle(page, 700);
	await shot(page, '16-matching-snapped');
	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 8000 });
	await settle(page, 400);
	await shot(page, '17-matching-next');
});

test('numbers at 1280×800', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/play');
	await page.getByRole('button', { name: 'সংখ্যা গোনা' }).click();
	// Beginner round: count, numeral-to-quantity, compare, count, pattern.
	const names = ['18-numbers-count', '19-numbers-numeral-to-quantity', '20-numbers-compare', '', '21-numbers-pattern'];
	for (const name of names) {
		await expect(field(page)).toBeVisible();
		await settle(page, 800);
		if (name) await shot(page, name);
		await solve(page);
		if (name === '18-numbers-count') {
			await settle(page, 900);
			await shot(page, '18b-numbers-counted');
		}
		await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 15000 });
		await page.getByRole('button', { name: 'পরেরটা' }).click();
	}
});

test('small window 800×600', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 600 });
	await page.goto('/mixing');
	await expect(page.getByRole('img', { name: 'সাদা ফুটবল' })).toBeVisible();
	await settle(page, 800);
	await shot(page, '11-mixing-800x600');
});

test('large window 1920×1080', async ({ page }) => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'কোন খেলা খেলবে?' })).toBeVisible();
	await settle(page, 600);
	await shot(page, '12-mode-selection-1920x1080');
});
