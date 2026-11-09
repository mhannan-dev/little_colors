import { expect, test, type Page } from '@playwright/test';

/** 3D ABC & ১২৩ blocks and Rumi's toy car (Claude). Taps go through the real buttons over the 3D objects. */

const answer = (page: Page) => page.locator('[data-answer]').getAttribute('data-answer');

function watchErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	return errors;
}

test('blocks: pick ABC and play a whole round', async ({ page }) => {
	const errors = watchErrors(page);
	await page.goto('/abc-123');
	await page.locator('[data-set="abc"]').click();
	await expect(page.locator('section[data-ready="true"]')).toBeVisible();
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('.tap').first()).toBeVisible();
		const id = await answer(page);
		if (i === 0) await page.screenshot({ path: 'test-results/play3d-blocks.png' });
		await page.locator(`[data-option-id="${id}"]`).click();
		const next = page.getByRole('button', { name: 'পরেরটা' });
		await expect(next).toBeVisible({ timeout: 10000 });
		await next.click();
	}
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('blocks: Bangla letters have spoken names; a wrong tap is gentle and the hint comes after two', async ({ page }) => {
	await page.goto('/abc-123');
	await page.locator('[data-set="bangla"]').click();
	await expect(page.locator('.tap').first()).toBeVisible();
	await expect(page.locator('[data-option-id="bangla-o"], [data-option-id="bangla-aa"], .tap').first()).toHaveAttribute('aria-label', /.+/);
	const id = await answer(page);
	const wrong = page.locator(`.tap:not([data-option-id="${id}"])`).first();
	for (let i = 0; i < 2; i++) {
		await wrong.click();
		await expect(page.getByText('আবার চেষ্টা করি!').first()).toBeVisible();
		await page.waitForTimeout(1200);
	}
	await page.getByRole('button', { name: 'সাহায্য' }).click();
	await expect(page.locator(`.tap.hinted[data-option-id="${id}"]`)).toBeVisible();
	await page.locator(`[data-option-id="${id}"]`).click();
	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 10000 });
});

test('blocks: numbers follow the numeral setting', async ({ page }) => {
	await page.goto('/abc-123');
	await expect(page.locator('[data-set="123"]')).toContainText('১২৩');
	await page.locator('[data-set="123"]').click();
	await expect(page.locator('.tap').first()).toHaveAttribute('aria-label', /^(এক|দুই|তিন|চার|পাঁচ)$/);
});

test('toy car: steer with the arrows, drive with Go, and finish a round', async ({ page }) => {
	const errors = watchErrors(page);
	await page.goto('/toy-car');
	await page.locator('[data-set="123"]').click();
	await expect(page.locator('section[data-ready="true"]')).toBeVisible();
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('section[data-phase="wait"]')).toBeVisible();
		const id = await answer(page);
		const target = Number(await page.locator(`[data-option-id="${id}"]`).getAttribute('data-lane-index'));
		if (i === 0) await page.screenshot({ path: 'test-results/play3d-car.png' });
		// Steer with the on-screen arrows (first half) or the keyboard (second half).
		while (Number(await page.locator('section.scene').getAttribute('data-lane')) !== target) {
			const lane = Number(await page.locator('section.scene').getAttribute('data-lane'));
			if (i % 2 === 0) await page.locator(`[data-steer="${lane < target ? 'right' : 'left'}"]`).click();
			else await page.keyboard.press(lane < target ? 'ArrowRight' : 'ArrowLeft');
		}
		if (i % 2 === 0) await page.locator('.controls').getByRole('button').nth(1).click();
		else await page.keyboard.press('ArrowUp');
		const next = page.getByRole('button', { name: 'পরেরটা' });
		await expect(next).toBeVisible({ timeout: 10000 });
		if (i === 0) await page.screenshot({ path: 'test-results/play3d-car-win.png' });
		await next.click();
	}
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('toy car: tapping a sign drives there; a wrong sign backs up gently, hint after two', async ({ page }) => {
	await page.goto('/toy-car');
	await page.locator('[data-set="abc"]').click();
	await expect(page.locator('section[data-phase="wait"]')).toBeVisible();
	const id = await answer(page);
	const wrong = page.locator(`.tap:not([data-option-id="${id}"])`).first();
	for (let i = 0; i < 2; i++) {
		await wrong.click();
		await expect(page.getByText('আবার চেষ্টা করি!').first()).toBeVisible();
		await expect(page.locator('section[data-phase="wait"]')).toBeVisible();
		await page.waitForTimeout(300);
	}
	await page.getByRole('button', { name: 'সাহায্য' }).click();
	await expect(page.locator(`.tap.hinted[data-option-id="${id}"]`)).toBeVisible();
	await page.locator(`[data-option-id="${id}"]`).click();
	await expect(page.getByRole('button', { name: 'পরেরটা' })).toBeVisible({ timeout: 10000 });
});

async function steerTo(page: Page, target: number, keys: boolean) {
	const scene = page.locator('section.scene');
	while (Number(await scene.getAttribute('data-lane')) !== target) {
		const lane = Number(await scene.getAttribute('data-lane'));
		if (keys) await page.keyboard.press(lane < target ? 'ArrowRight' : 'ArrowLeft');
		else await page.locator(`[data-steer="${lane < target ? 'right' : 'left'}"]`).click();
	}
}

test('race: steer onto the named pads, then everyone finishes together', async ({ page }) => {
	test.setTimeout(150_000);
	const errors = watchErrors(page);
	await page.goto('/race');
	await page.locator('[data-set="abc"]').click();
	const scene = page.locator('section.scene');
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('.tap').first()).toBeVisible({ timeout: 15000 });
		const id = await answer(page);
		const target = Number(await page.locator(`[data-option-id="${id}"]`).getAttribute('data-lane-index'));
		const steered = Number(await scene.getAttribute('data-lane')) !== target;
		await steerTo(page, target, i % 2 === 1);
		// Already in the right lane? The pads wait for the child: drive on with Go (keyboard: ArrowUp).
		if (!steered) {
			if (i % 2 === 1) await page.keyboard.press('ArrowUp');
			else {
				await expect(scene).toHaveAttribute('data-phase', 'wait', { timeout: 15000 });
				await page.getByTestId('race-go').getByRole('button').click();
			}
		}
		if (i === 0) {
			await page.waitForTimeout(2500);
			await page.screenshot({ path: 'test-results/play3d-race.png' });
		}
		await expect(scene).toHaveAttribute('data-progress', String(i + 1), { timeout: 15000 });
		if (i === 0) await page.screenshot({ path: 'test-results/play3d-race-boost.png' });
	}
	await expect(scene).toHaveAttribute('data-phase', 'finish');
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible({ timeout: 20000 });
	expect(errors).toEqual([]);
});

test('race: a missed pad costs nothing, then the pads wait; tapping a pad steers there', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/race');
	await page.locator('[data-set="123"]').click();
	const scene = page.locator('section.scene');
	await expect(page.locator('.tap').first()).toBeVisible({ timeout: 15000 });
	const id = await answer(page);
	const target = Number(await page.locator(`[data-option-id="${id}"]`).getAttribute('data-lane-index'));
	await steerTo(page, (target + 1) % 3, false);
	await expect(page.getByText('আবার চেষ্টা করি!').first()).toBeVisible({ timeout: 15000 });
	await expect(scene).toHaveAttribute('data-progress', '0');
	// The same pads come back and wait for the child: no hurry.
	await expect(scene).toHaveAttribute('data-phase', 'wait', { timeout: 15000 });
	await page.waitForTimeout(2000);
	await expect(scene).toHaveAttribute('data-phase', 'wait');
	await expect(page.getByTestId('race-go').getByRole('button')).toBeVisible();
	await page.locator(`[data-option-id="${id}"]`).click();
	await expect(scene).toHaveAttribute('data-progress', '1', { timeout: 15000 });
});

test('all three 3D games open from the game picker', async ({ page }) => {
	for (const [name, url] of [['ABC আর ১২৩ ব্লক', '/abc-123'], ['রুমির খেলনা গাড়ি', '/toy-car'], ['বন্ধুদের সাথে রেস', '/race']] as const) {
		await page.goto('/play');
		const card = page.getByRole('button', { name, exact: true });
		await expect(card).toBeVisible();
		if (url === '/race') await page.screenshot({ path: 'test-results/play3d-picker.png', fullPage: true });
		await card.click();
		await expect(page).toHaveURL(new RegExp(`${url}$`));
		await expect(page.locator('[data-set="abc"]')).toBeVisible();
	}
});

test('race: just drive — no questions, VROOM, balloons pop, nothing to lose', async ({ page }) => {
	test.setTimeout(120_000);
	await page.goto('/race');
	await page.locator('[data-set="free"]').click({ timeout: 60000 });
	const scene = page.locator('section.scene');
	await expect(scene).toHaveAttribute('data-mode', 'free');
	await expect(scene).toHaveAttribute('data-phase', 'drive', { timeout: 15000 });
	await expect(page.locator('.tap')).toHaveCount(0); // no questions
	await page.getByTestId('race-vroom').getByRole('button').click();
	// Steer toward the next balloon until one pops.
	await expect(async () => {
		const next = Number(await scene.getAttribute('data-next-balloon'));
		if (next >= 0) await steerTo(page, next, true);
		expect(Number(await scene.getAttribute('data-popped'))).toBeGreaterThan(0);
	}).toPass({ timeout: 40000, intervals: [300] });
	await page.screenshot({ path: 'test-results/play3d-free.png' });
	// Leaving is always allowed; nothing is lost.
	await page.getByRole('button', { name: 'অন্য খেলা' }).click();
	await expect(page.locator('[data-set="free"]')).toBeVisible();
});
