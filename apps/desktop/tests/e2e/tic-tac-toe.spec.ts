import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('plays Classic, Infinity and large boards with hints and undo', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Tic-Tac-Toe', exact: true }).click();
	const board = page.getByRole('group', { name: 'Tic-Tac-Toe board' });
	const squares = board.getByRole('button');
	const button = (name: string) => page.getByRole('button', { name, exact: true });
	const play = async (indices: number[]) => {
		for (const index of indices) await squares.nth(index).click();
	};
	await button('Two players').click();
	await play([0, 3, 1, 4, 2]);
	await expect(page.locator('.status')).toHaveText('X wins!');
	await expect(board.locator('.win')).toHaveCount(3);
	await button('Play again').click();
	await play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
	await expect(page.locator('.status')).toHaveText('It’s a draw!');

	await button('Infinity').click();
	await play([0, 4, 1, 8, 5, 6]);
	await expect(squares.first()).toHaveClass(/\bfading\b/);
	await play([2]);
	await expect(squares.first()).toHaveAccessibleName('Square 1, empty');
	await expect(page.getByText('O’s turn', { exact: true })).toBeVisible();
	await button('Undo').click();
	await expect(squares.first()).toHaveAccessibleName('Square 1, X');
	await expect(squares.nth(2)).toHaveAccessibleName('Square 3, empty');

	await button('5×5').click();
	await expect(squares).toHaveCount(25);
	await play([0, 1, 6, 2, 12, 3, 18]);
	await expect(board.locator('.win')).toHaveCount(4);
	await button('6×6').click();
	await expect(squares).toHaveCount(36);

	await button('Classic').click();
	await button('Vs. computer').click();
	await button('Hard').click();
	await squares.first().press('Enter');
	await expect(squares.nth(4)).toHaveAccessibleName('Square 5, O');
	await button('Undo').click();
	await expect(board.getByRole('button', { name: /empty$/ })).toHaveCount(9);
	await button('Hint').click();
	await expect(board.locator('.suggested')).toHaveCount(1);
	await button('বাংলা').click();
	await expect(page.getByRole('heading', { name: 'টিক-ট্যাক-টো' })).toBeVisible();
});
