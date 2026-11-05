/**
 * PR-25 / PR-26: a child who cannot read can still play.
 * Every child-facing action button shows a pictogram, first visits get a ghost-hand demo,
 * help points with the hand, idle children hear the prompt again, and matching shows
 * a picture of what to match.
 */
import { expect, test } from '@playwright/test';
import { answerFor } from '../helpers/minigames.ts';

test('every action button carries a pictogram (PR-26)', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-action="play"] svg.icon')).toBeVisible();

	await page.goto('/bird');
	await expect(page.locator('.option').first()).toBeVisible();
	await page.locator(await answerFor(page, 'birds')).click();
	const next = page.locator('[data-action="next"]');
	await expect(next).toBeVisible();
	await expect(next.locator('svg.icon')).toBeVisible();
	// "Go" actions are the green arrow that the idle prompt refers to.
	expect(await next.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(53, 166, 106)');

	for (let i = 0; i < 5; i++) {
		if (i > 0) await page.locator(await answerFor(page, 'birds')).click();
		await page.locator('[data-action="next"]').click();
	}
	for (const action of ['replay', 'choose-game']) {
		await expect(page.locator(`[data-action="${action}"] svg.icon`)).toBeVisible();
	}
});

test('first visit shows a ghost-hand demo once; it never blocks taps (PR-25)', async ({ page }) => {
	await page.goto('/football');
	const hand = page.getByTestId('ghost-hand');
	await expect(hand).toHaveClass(/show/, { timeout: 5000 });
	expect(await page.locator('.hand-layer').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
	// The child can play while the demo runs.
	await page.locator(await answerFor(page, 'football')).click();
	await expect(page.locator('[data-action="next"]')).toBeVisible();

	// Second visit: no demo.
	await page.reload();
	await expect(page.locator('.option').first()).toBeVisible();
	await page.waitForTimeout(2500);
	await expect(hand).not.toHaveClass(/show/);
});

test('help points at the answer with the ghost hand', async ({ page }) => {
	await page.goto('/car');
	await page.evaluate(() => localStorage.setItem('lc.tutorial.seen.garage', '1'));
	await page.reload();
	await expect(page.locator('.option').first()).toBeVisible();
	const right = await answerFor(page, 'garage');
	const wrong = page.locator(`.option:not(${right})`).first();
	for (let i = 0; i < 2; i++) {
		await wrong.click();
		await page.waitForTimeout(1300);
	}
	await page.locator('[data-action="hint"]').click();
	await expect(page.getByTestId('ghost-hand')).toHaveClass(/show/);
});

test('an idle child hears the prompt again, at most twice (PR-25)', async ({ page }) => {
	await page.clock.install();
	await page.goto('/matching');
	await expect(page.locator('.sources button.source').first()).toBeVisible();
	const count = () => page.evaluate(() => Number(document.body.dataset.idlePrompts ?? 0));
	expect(await count()).toBe(0);
	await page.clock.fastForward(8500);
	await expect.poll(count).toBe(1);
	await page.clock.fastForward(8500);
	await expect.poll(count).toBe(2);
	await page.clock.fastForward(20000);
	expect(await count()).toBe(2);
});

test('shape matching shows a picture of what to match (color vs shape)', async ({ page }) => {
	await page.goto('/matching');
	const badge = page.getByTestId('match-mode-badge');
	await expect(badge).toBeVisible();
	expect(['color', 'shape', 'both']).toContain(await badge.getAttribute('data-mode'));
	expect(await badge.locator('svg').count()).toBeGreaterThanOrEqual(1);
});
