import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('opens Color Blocks, drags to the gate, and follows a reversible hint', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Color Blocks', exact: true }).click();
	await expect(page).toHaveURL(/\/color-blocks$/);
	const red = page.getByRole('button', { name: 'Red', exact: true });
	const box = (await red.boundingBox())!;
	const board = (await page.getByRole('group', { name: 'Color Blocks' }).boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + board.width * .4, box.y + box.height / 2, { steps: 5 });
	await page.mouse.up();
	await expect(red).toHaveCount(0);
	await page.getByRole('button', { name: 'Next puzzle' }).click();
	await expect(page.getByText('Puzzle 2')).toBeVisible();
	await page.getByRole('button', { name: /Hint/ }).click();
	const hinted = page.locator('.block.hinted');
	const id = await hinted.getAttribute('data-block');
	const original = await hinted.getAttribute('data-cell');
	const direction = await page.locator('.arrow.hinted').getAttribute('aria-label');
	await hinted.press(`Arrow${direction}`);
	await expect(page.locator('.block.hinted')).toHaveCount(0);
	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.locator(`[data-block="${id}"]`)).toHaveAttribute('data-cell', original!);
});
