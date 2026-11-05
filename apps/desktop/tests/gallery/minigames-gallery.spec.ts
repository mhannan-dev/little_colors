/** UI gallery for the Football, Garage, and Birds mini-games → docs/ui/22..27-*.png */
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { answerFor } from '../helpers/minigames.ts';

const OUT = fileURLToPath(new URL('../../../../docs/ui/', import.meta.url));

for (const [n, route, game] of [
	[22, '/football', 'football'],
	[24, '/car', 'garage'],
	[26, '/bird', 'birds']
] as const) {
	test(`${game} screenshots`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto(route);
		await expect(page.locator('.option').first()).toBeVisible();
		await page.waitForTimeout(900);
		await page.screenshot({ path: `${OUT}${n}-${game}-ready.png` });
		await page.locator(await answerFor(page, game)).click();
		await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 10000 });
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${OUT}${n + 1}-${game}-done.png` });
	});
}

test('ghost hand demo (first visit)', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/football');
	await expect(page.getByTestId('ghost-hand')).toHaveClass(/show/, { timeout: 5000 });
	// Capture the moment the hand touches the answer (≈ 1 step after it appears).
	await expect.poll(() => page.getByTestId('ghost-hand').evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 5000 }).toBeGreaterThan(0.95);
	await page.waitForTimeout(700);
	await page.screenshot({ path: `${OUT}28-ghost-hand-demo.png` });
});
