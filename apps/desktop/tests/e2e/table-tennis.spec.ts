import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test('plays 3D table tennis in one window with keyboard, slider, pause and language switching', async ({ page }) => {
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/play');
	await page.getByRole('button', { name: 'English', exact: true }).click();
	await page.getByTestId('game-search').fill('table tennis');
	await page.getByRole('button', { name: '3D Table Tennis', exact: true }).click();
	const arena = page.locator('.arena');
	await expect(arena).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	await page.locator('canvas').focus();
	await page.keyboard.down('ArrowRight');
	await expect.poll(async () => Number(await arena.getAttribute('data-paddle-x'))).toBeGreaterThan(0.2);
	await page.keyboard.up('ArrowRight');
	await page.getByRole('slider', { name: 'Move paddle' }).fill('0');
	await expect.poll(async () => Math.abs(Number(await arena.getAttribute('data-paddle-x')))).toBeLessThan(0.1);
	await page.getByRole('button', { name: '🏓 Serve', exact: true }).click();
	await expect(arena).toHaveAttribute('data-phase', 'playing');
	await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
	await expect(page.getByRole('button', { name: '▶ Resume', exact: true })).toBeVisible();
	await page.getByRole('button', { name: '▶ Resume', exact: true }).click();
	await page.getByRole('button', { name: '↻ Start over', exact: true }).click();
	await expect(arena).toHaveAttribute('data-phase', 'ready');
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'থ্রিডি টেবিল টেনিস' })).toBeVisible();
	await page.screenshot({ path: 'test-results/table-tennis.png' });
	expect(page.context().pages()).toHaveLength(1);
	await page.getByRole('button', { name: 'ফিরে যাই', exact: true }).click();
	await expect(page).toHaveURL(/\/play$/);
	expect(errors).toEqual([]);
});
