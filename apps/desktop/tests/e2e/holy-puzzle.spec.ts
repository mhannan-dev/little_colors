import { expect, test } from '@playwright/test';

test('mosque and Kaaba puzzles work at desktop and small viewports', async ({ page }) => {
	for (const viewport of [
		{ width: 1280, height: 800 },
		{ width: 800, height: 600 },
		{ width: 360, height: 640 }
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/holy-puzzle');
		await expect(page.getByRole('heading', { name: 'মসজিদ ও কাবার পাজল' })).toBeInViewport();

		const board = page.getByTestId('puzzle-board');
		const tiles = board.locator('.tile');
		await expect(tiles).toHaveCount(4);
		await expect(board).toBeInViewport();
		await expect(page.getByRole('button', { name: 'মসজিদ', exact: true })).toBeInViewport();
		await expect(page.getByRole('button', { name: 'সহজ · ৪ টুকরো' })).toBeInViewport();
		await expect(page.getByRole('button', { name: 'অন্য খেলা' })).toBeInViewport();
		await page.getByRole('button', { name: 'কঠিন · ৯ টুকরো' }).click();
		await expect(tiles).toHaveCount(9);

		const current = await tiles.evaluateAll((elements) =>
			elements.map((element) => Number(element.getAttribute('data-piece')))
		);
		for (let slot = 0; slot < current.length; slot++) {
			if (current[slot] === slot) continue;
			const partner = current.indexOf(slot, slot + 1);
			await tiles.nth(slot).click();
			await tiles.nth(partner).click();
			[current[slot], current[partner]] = [current[partner]!, current[slot]!];
		}
		await expect(page.getByText('দারুণ! পাজলটি মিলে গেছে!')).toBeVisible();
		await page.getByRole('button', { name: 'কাবা', exact: true }).click();
		await expect(board).toHaveAttribute('aria-label', 'কাবা puzzle');
	}
});
