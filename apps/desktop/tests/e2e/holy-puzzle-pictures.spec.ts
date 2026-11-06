import { expect, test, type Locator } from '@playwright/test';

/** Swap tiles until every piece is in its slot (same strategy a child would use). */
async function solve(tiles: Locator) {
	const current = await tiles.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-piece'))));
	for (let slot = 0; slot < current.length; slot++) {
		if (current[slot] === slot) continue;
		const partner = current.indexOf(slot, slot + 1);
		await tiles.nth(slot).click();
		await tiles.nth(partner).click();
		[current[slot], current[partner]] = [current[partner]!, current[slot]!];
	}
}

test('all six puzzle pictures can be chosen by their picture and solved', async ({ page }) => {
	await page.goto('/holy-puzzle');
	const choices = page.locator('.picture-choice');
	await expect(choices).toHaveCount(6);
	const board = page.getByTestId('puzzle-board');
	const tiles = board.locator('.tile');

	const labels = new Set<string>();
	for (let i = 0; i < 6; i++) {
		const choice = choices.nth(i);
		await choice.scrollIntoViewIfNeeded();
		// Every choice shows a picture thumbnail, not only a word (PR-25).
		expect(await choice.locator('.thumb').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('data:image/svg+xml');
		await choice.click();
		await expect(choice).toHaveAttribute('aria-pressed', 'true');
		labels.add((await board.getAttribute('aria-label'))!);
		await expect(tiles).toHaveCount(4);
		await solve(tiles);
		await expect(board).toHaveClass(/complete/);
	}
	expect(labels.size).toBe(6); // six different pictures
});

test('the finished picture is shown as a guide on wide screens, hidden on phones', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/holy-puzzle');
	await expect(page.getByTestId('puzzle-preview')).toBeVisible();
	await page.setViewportSize({ width: 360, height: 640 });
	await expect(page.getByTestId('puzzle-preview')).toBeHidden();
	await expect(page.getByTestId('puzzle-board')).toBeInViewport();
});

test('the moves counter uses the language digits', async ({ page }) => {
	await page.goto('/holy-puzzle'); // tests start in বাংলা
	const tiles = page.getByTestId('puzzle-board').locator('.tile');
	await page.getByRole('button', { name: /কঠিন/ }).click(); // 9 tiles: one swap never solves it
	await tiles.nth(0).click();
	await tiles.nth(1).click();
	await expect(page.locator('.status')).toContainText('১');
	await expect(page.locator('.status')).not.toContainText(/[0-9]/);
});
