import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('learning trail offers gentle retries and finishes five discoveries', async ({ page }) => {
	test.setTimeout(90_000);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/play');
	await page.getByTestId('game-search').fill('Learning Trail');
	await page.getByRole('button', { name: 'Rumi’s Learning Trail', exact: true }).click();
	const game = page.getByTestId('learning-runner');
	await page.getByRole('button', { name: /Little adventure/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await expect(page.getByRole('heading', { name: 'Where is red?' })).toBeVisible();
	const options = page.locator('[data-trail-options]');
	for (let i = 0; i < 2; i++) await options.getByRole('button', { name: 'yellow', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await expect(options.getByRole('button', { name: 'red', exact: true })).toHaveClass(/hinted/);
	await page.getByRole('button', { name: /Show me/ }).click();
	await options.getByRole('button', { name: 'red', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(game).toHaveAttribute('data-phase', 'celebrate');
	await page.getByRole('button', { name: /Next discovery/ }).click();
	for (const target of ['circle', 'one', 'blue', 'three']) {
		await expect(game).toHaveAttribute('data-phase', 'choice');
		await options.getByRole('button', { name: target, exact: true }).click();
		await expect(game).toHaveAttribute('data-phase', 'celebrate');
		await page.getByRole('button', { name: target === 'three' ? /See our discoveries/ : /Next discovery/ }).click();
	}
	await expect(page.getByRole('heading', { name: 'So many discoveries!' })).toBeVisible();
	await expect(page.locator('.discovered > div')).toHaveCount(5);
	await page.getByRole('button', { name: /Play again/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(options.getByRole('button', { name: 'red', exact: true })).toBeVisible();
	expect(await page.locator('.runner-shell').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'লাল কোনটি?' })).toBeVisible();
	await page.getByRole('button', { name: /অন্য পথ/ }).click();
	await expect(page.getByRole('heading', { name: 'কোন পথে যাবো?' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('3D travel waits at each choice and pause freezes the journey', async ({ page }) => {
	await page.goto('/learning-runner');
	const game = page.getByTestId('learning-runner');
	await page.getByRole('button', { name: /Color trail/ }).click();
	await page.getByRole('button', { name: /Hop/ }).click();
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'A little rest' })).toBeVisible();
	await page.waitForTimeout(2800);
	await expect(game).toHaveAttribute('data-phase', 'travel');
	await page.getByRole('button', { name: /Continue/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.waitForTimeout(1500);
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.screenshot({ path: 'test-results/learning-runner.png' });
});

test('reference characters and scenery support manual jump and slide', async ({ page }) => {
	await page.goto('/learning-runner');
	const game = page.getByTestId('learning-runner');
	await expect(game).toHaveAttribute('data-ready', 'true');
	await page.getByRole('button', { name: 'Fox', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Fox', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: /Snow/, exact: false }).click();
	expect(await page.locator('.stage').evaluate(element => element.scrollTop)).toBe(0);
	await expect(page.getByRole('heading', { name: 'Where shall we explore?' })).toBeInViewport();
	await page.screenshot({ path: 'test-results/learning-runner-reference-picker.png' });
	await page.getByRole('checkbox', { name: 'Help me jump and slide' }).uncheck();
	await page.getByRole('button', { name: /Color trail/ }).click();
	await expect(game).toHaveAttribute('data-obstacle', 'jump');
	await page.waitForTimeout(500);
	await expect(game).toHaveAttribute('data-phase', 'travel');
	await page.locator('.stage > canvas').focus();
	await page.keyboard.press('Space');
	await expect(game).toHaveAttribute('data-motion', 'jump');
	await expect(game).toHaveAttribute('data-obstacle', 'slide');
	await page.keyboard.press('ArrowDown');
	await expect(game).toHaveAttribute('data-motion', 'slide');
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.screenshot({ path: 'test-results/learning-runner-reference-play.png' });
});

test('learning choices remain usable when WebGL is unavailable', async ({ page }) => {
	await page.addInitScript(() => {
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
			if (type === 'webgl2' || type === 'webgl') return null;
			return Reflect.apply(getContext, this, [type, ...args]);
		} as typeof getContext;
	});
	await page.goto('/learning-runner');
	await page.getByRole('button', { name: /Counting trail/ }).click();
	await page.locator('[data-trail-options]').getByRole('button', { name: 'one', exact: true }).click();
	await expect(page.getByTestId('learning-runner')).toHaveAttribute('data-phase', 'celebrate');
});
