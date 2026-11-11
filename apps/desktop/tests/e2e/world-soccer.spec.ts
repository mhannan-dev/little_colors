import { expect, test, type Page } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true, viewport: { width: 393, height: 852 }, storageState: { cookies: [], origins: [] } });

async function screenPoint(page: Page, x: number, y: number) {
	return page.locator('svg.pitch').evaluate((svg, point) => {
		const matrix = (svg as SVGSVGElement).getScreenCTM()!;
		const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
		return { x: screen.x, y: screen.y };
	}, { x, y });
}

test('play an international match with touch controls', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/play');
	await page.getByRole('button', { name: 'World Soccer Cup', exact: true }).tap();
	await page.getByLabel('Your team').selectOption('BRA');
	await expect(page.getByLabel('Opponent')).toHaveValue('BAN');
	await page.getByRole('button', { name: 'Kick off' }).tap();
	await expect(page.getByRole('heading', { name: 'Your attack' })).toBeVisible();
	const teammate = await screenPoint(page, 126, 345);
	await page.touchscreen.tap(teammate.x, teammate.y);
	await expect(page.getByRole('button', { name: 'Pass 10' })).toBeEnabled();
	const touch = await page.context().newCDPSession(page);
	const start = await screenPoint(page, 126, 345);
	const end = await screenPoint(page, 181, 197);
	await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
	await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await touch.detach();
	await expect(page.getByRole('heading', { name: 'Goal!' })).toBeVisible();
	await expect(page.locator('.scoreboard')).toHaveAttribute('aria-label', 'Brazil 1, Bangladesh 0');
	await page.getByRole('button', { name: 'Next highlight' }).click();
	await expect(page.getByRole('heading', { name: 'You’re the goalkeeper' })).toBeVisible();
	await page.getByRole('button', { name: 'Right', exact: true }).click();
	await page.getByRole('button', { name: 'Face the shot' }).click();
	await expect(page.getByRole('heading', { name: 'Saved by the keeper!' })).toBeVisible();
	for (let round = 2; round <= 3; round++) {
		await page.getByRole('button', { name: 'Next highlight' }).click();
		await page.getByRole('button', { name: 'Right', exact: true }).click();
		await page.getByRole('button', { name: 'Next highlight' }).click();
		await page.getByRole('button', { name: round === 2 ? 'Left' : 'Center', exact: true }).click();
		await page.getByRole('button', { name: 'Face the shot' }).click();
		await expect(page.getByRole('heading', { name: 'Saved by the keeper!' })).toBeVisible();
	}
	await page.getByRole('button', { name: 'See final result' }).click();
	await expect(page.getByRole('heading', { name: 'Brazil wins' })).toBeVisible();
	await page.getByRole('button', { name: 'Play again' }).click();
	await expect(page.locator('.scoreboard')).toHaveAttribute('aria-label', 'Brazil 0, Bangladesh 0');
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'বিশ্ব ফুটবল কাপ' })).toBeVisible();
	expect(errors).toEqual([]);
});
