import { expect, test, type Page } from '@playwright/test';

async function mute(page: Page) {
	const toggle = page.locator('header button[aria-pressed]');
	if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click();
}

async function solveObservation(page: Page) {
	const options = page.locator('.observation-options button');
	const names = await options.evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-option-id')!, description: element.getAttribute('aria-label')!.split(': ')[1] })));
	const answer = names.find((option) => names.filter((other) => other.description === option.description).length === 1)!;
	await page.locator(`[data-option-id="${answer.id}"]`).click();
}
async function solveMemory(page: Page) {
	const order = await page.locator('.memory-slot').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-token-id')!));
	await page.getByTestId('remember').click();
	await expect(page.locator('.memory-slot[data-token-id]')).toHaveCount(0);
	for (const id of order) await page.locator(`button[data-option-id="${id}"]`).click();
}
async function solvePattern(page: Page) {
	const values = await page.locator('.number-sequence [data-value]').evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-value'))));
	const next = values[3]! + values[1]! - values[0]!;
	const answer = page.locator(`button[data-option-id="number-${next}"]`);
	await answer.focus(); await page.keyboard.press('Enter');
}
async function solvePath(page: Page, keyboard: boolean) {
	const grid = page.getByTestId('path-grid');
	const cells = await grid.locator('[role="gridcell"]').evaluateAll((elements) => elements.map((element) => ({ row: Number(element.getAttribute('data-row')), column: Number(element.getAttribute('data-column')), wall: element.getAttribute('data-wall') === 'true', ball: element.getAttribute('data-ball') === 'true', goal: element.getAttribute('data-goal') === 'true' })));
	const start = cells.find((cell) => cell.ball)!, goal = cells.find((cell) => cell.goal)!;
	const size = Number(await grid.getAttribute('data-size'));
	const queue = [{ row: start.row, column: start.column, path: [] as string[] }];
	const visited = new Set([`${start.row},${start.column}`]);
	const moves = [{ name: 'up', row: -1, column: 0 }, { name: 'down', row: 1, column: 0 }, { name: 'left', row: 0, column: -1 }, { name: 'right', row: 0, column: 1 }];
	let route: string[] | undefined;
	for (let i = 0; i < queue.length; i++) {
		const current = queue[i]!;
		if (current.row === goal.row && current.column === goal.column) { route = current.path; break; }
		for (const move of moves) {
			const row = current.row + move.row, column = current.column + move.column, key = `${row},${column}`;
			if (row < 0 || column < 0 || row >= size || column >= size || visited.has(key) || cells.some((cell) => cell.row === row && cell.column === column && cell.wall)) continue;
			visited.add(key); queue.push({ row, column, path: [...current.path, move.name] });
		}
	}
	expect(route).toBeDefined();
	if (keyboard) await grid.focus();
	for (const direction of route!) {
		if (keyboard) await page.keyboard.press(`Arrow${direction[0]!.toUpperCase()}${direction.slice(1)}`);
		else await page.locator(`[data-direction="${direction}"]`).click();
	}
}

for (const age of ['5-7', '8-10']) {
	for (const kind of ['odd-one-out', 'sequence-memory', 'number-pattern', 'grid-path']) {
		test(`${age}: three ${kind} lessons complete with sound off`, async ({ page }) => {
			const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
			await page.goto('/thinking'); await mute(page);
			await page.getByTestId(`age-${age}`).click();
			await page.getByTestId(`lesson-${kind}`).click();
			for (let index = 0; index < 3; index++) {
				if (kind === 'odd-one-out') await solveObservation(page);
				else if (kind === 'sequence-memory') await solveMemory(page);
				else if (kind === 'number-pattern') await solvePattern(page);
				else await solvePath(page, age === '8-10');
				await expect(page.getByTestId('thinking-next')).toBeVisible();
				await page.getByTestId('thinking-next').click();
			}
			await expect(page.getByTestId('thinking-done')).toBeVisible(); expect(errors).toEqual([]);
		});
	}
}

test('memory retries preserve progress, clues unlock after two misses, reset restores observation', async ({ page }) => {
	await page.goto('/thinking'); await mute(page); await page.getByTestId('lesson-sequence-memory').click();
	const first = await page.locator('.memory-slot').first().getAttribute('data-token-id');
	await page.getByTestId('remember').click();
	const wrong = page.locator(`.memory-options button:not([data-option-id="${first}"])`).first();
	await expect(page.getByTestId('thinking-help')).toBeDisabled();
	await wrong.click(); await wrong.click();
	await expect(page.getByTestId('thinking-help')).toBeEnabled(); await page.getByTestId('thinking-help').click();
	await expect(page.getByTestId('thinking-hint')).toBeVisible();
	await expect(page.getByTestId('thinking-next')).toHaveCount(0);
	await page.getByRole('button', { name: 'আবার শুরু', exact: true }).click();
	await expect(page.getByTestId('remember')).toBeVisible(); await expect(page.getByTestId('thinking-hint')).toHaveCount(0);
});

test('mode selection links to age-banded lessons at minimum desktop size', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 600 }); await page.goto('/play');
	const entry = page.locator('.thinking-link'); await expect(entry).toBeInViewport(); await entry.click();
	await expect(page.getByTestId('age-5-7')).toBeVisible(); await expect(page.getByTestId('lesson-grid-path')).toBeVisible();
});

test('lesson hub and planning board fit common viewports and reduced motion', async ({ page }, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const [width, height] of [[1280, 800], [800, 600], [360, 640]]) {
		await page.setViewportSize({ width: width!, height: height! }); await page.goto('/thinking'); await mute(page);
		await expect(page.getByTestId('lesson-grid-path')).toBeVisible();
		if (width === 1280) await page.screenshot({ path: testInfo.outputPath('thinking-hub.png') });
		await page.getByTestId('age-8-10').click(); await page.getByTestId('lesson-grid-path').click();
		await expect(page.getByTestId('path-grid')).toBeInViewport();
		const overflow = await page.getByTestId('thinking-scene').evaluate((element) => element.scrollWidth > element.clientWidth);
		expect(overflow).toBe(false);
		if (width === 1280) await page.screenshot({ path: testInfo.outputPath('thinking-path.png') });
	}
});
