import { expect, test, type Page } from '@playwright/test';

async function openPicnic(page: Page, age = '5-7') {
	await page.goto('/thinking');
	const toggle = page.locator('header button[aria-pressed]');
	if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click();
	await page.getByTestId(`age-${age}`).click();
	await page.getByTestId('start-picnic').click();
}

async function solveChapter(page: Page, chapter: string) {
	if (chapter === 'pack') {
		const options = await page.locator('.observation-options button').evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-option-id')!, description: element.getAttribute('aria-label')!.split(': ')[1] })));
		const answer = options.find((option) => options.filter((other) => other.description === option.description).length === 1)!;
		await page.locator(`button[data-option-id="${answer.id}"]`).click();
	} else if (chapter === 'remember') {
		const order = await page.locator('.memory-slot').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-token-id')!));
		await page.getByTestId('remember').click();
		await expect(page.locator('.memory-slot[data-token-id]')).toHaveCount(0);
		for (const token of order) await page.locator(`button[data-option-id="${token}"]`).click();
	} else if (chapter === 'bridge') {
		const sequence = await page.locator('.number-sequence [data-value]').evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-value'))));
		const answer = sequence[3]! + sequence[1]! - sequence[0]!;
		await page.locator(`button[data-option-id="number-${answer}"]`).focus();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('missing-plank')).not.toHaveText('?');
	} else {
		const grid = page.getByTestId('path-grid');
		const cells = await grid.locator('[role="gridcell"]').evaluateAll((elements) => elements.map((element) => ({ row: Number(element.getAttribute('data-row')), column: Number(element.getAttribute('data-column')), wall: element.getAttribute('data-wall') === 'true', ball: element.getAttribute('data-ball') === 'true', goal: element.getAttribute('data-goal') === 'true' })));
		const start = cells.find((cell) => cell.ball)!, goal = cells.find((cell) => cell.goal)!, size = Number(await grid.getAttribute('data-size'));
		const queue = [{ row: start.row, column: start.column, path: [] as string[] }], visited = new Set([`${start.row},${start.column}`]);
		const moves = [{ direction: 'Up', row: -1, column: 0 }, { direction: 'Down', row: 1, column: 0 }, { direction: 'Left', row: 0, column: -1 }, { direction: 'Right', row: 0, column: 1 }];
		let route: string[] | undefined;
		for (let index = 0; index < queue.length; index++) {
			const current = queue[index]!;
			if (current.row === goal.row && current.column === goal.column) { route = current.path; break; }
			for (const move of moves) {
				const row = current.row + move.row, column = current.column + move.column, key = `${row},${column}`;
				if (row < 0 || column < 0 || row >= size || column >= size || visited.has(key) || cells.some((cell) => cell.row === row && cell.column === column && cell.wall)) continue;
				visited.add(key); queue.push({ row, column, path: [...current.path, move.direction] });
			}
		}
		expect(route).toBeDefined(); await grid.focus();
		for (const direction of route!) await page.keyboard.press(`Arrow${direction}`);
	}
}

for (const age of ['5-7', '8-10']) {
	test(`picnic ${age}: all four chapters, visible consequences, finale and replay with sound off`, async ({ page }, testInfo) => {
		const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
		await openPicnic(page, age);
		await expect(page.getByTestId('picnic-hat')).toBeVisible();
		await page.getByTestId('picnic-fix-hat').click();
		await expect(page.getByTestId('picnic-hat')).toHaveCount(0);
		await expect(page.getByTestId('picnic-intro')).toHaveAttribute('data-chapter', 'pack');
		const chapters = ['pack', 'remember', 'bridge', 'path'];
		for (const [index, chapter] of chapters.entries()) {
			await expect(page.getByTestId('picnic-intro')).toHaveAttribute('data-chapter', chapter);
			await expect(page.getByTestId('picnic-scene')).toHaveAttribute('data-completed', String(index));
			await page.getByTestId('picnic-begin-chapter').click();
			await solveChapter(page, chapter);
			await expect(page.getByTestId('thinking-next')).toBeVisible();
			await expect(page.getByTestId('picnic-scene')).toHaveAttribute('data-completed', String(index + 1));
			await expect(page.getByTestId('picnic-packed')).toHaveCount(1);
			if (index >= 1) await expect(page.getByTestId('picnic-supplies')).toHaveCount(1);
			if (index >= 2) await expect(page.getByTestId('picnic-bridge')).toHaveCount(1);
			await expect(page.getByTestId('picnic-intro')).toHaveCount(0);
			if (chapter === 'bridge' && age === '5-7') await page.screenshot({ path: testInfo.outputPath('picnic-repaired-bridge.png') });
			await page.getByTestId('thinking-next').click();
		}
		await expect(page.getByTestId('picnic-done')).toBeVisible();
		await expect(page.getByTestId('picnic-feast')).toHaveCount(1);
		if (age === '5-7') await page.screenshot({ path: testInfo.outputPath('picnic-finale.png') });
		await page.getByTestId('picnic-playground').click();
		await expect(page.getByTestId('creative-playground')).toBeVisible();
		await page.getByTestId('playground-back').click();
		await expect(page.getByTestId('picnic-done')).toBeVisible();
		await page.getByTestId('picnic-replay').click();
		await expect(page.getByTestId('picnic-intro')).toHaveAttribute('data-chapter', 'pack');
		await expect(page.getByTestId('picnic-scene')).toHaveAttribute('data-completed', '0');
		await expect(page.getByTestId('picnic-packed')).toHaveCount(0);
		expect(errors).toEqual([]);
	});
}

test('recall mistakes, clues and reset preserve the already packed basket', async ({ page }) => {
	await openPicnic(page); await page.getByTestId('picnic-begin-chapter').click(); await solveChapter(page, 'pack');
	await page.getByTestId('thinking-next').click(); await page.getByTestId('picnic-begin-chapter').click();
	const first = await page.locator('.memory-slot').first().getAttribute('data-token-id');
	await page.getByTestId('remember').click();
	const wrong = page.locator(`.memory-options button:not([data-option-id="${first}"])`).first();
	await wrong.click(); await wrong.click(); await page.getByTestId('thinking-help').click();
	await expect(page.getByTestId('thinking-hint')).toBeVisible(); await expect(page.getByTestId('thinking-next')).toHaveCount(0);
	await page.getByRole('button', { name: 'আবার শুরু', exact: true }).click();
	await expect(page.getByTestId('remember')).toBeVisible(); await expect(page.getByTestId('thinking-hint')).toHaveCount(0);
	await expect(page.getByTestId('picnic-scene')).toHaveAttribute('data-completed', '1');
});

test('picnic stories remain readable and reachable at desktop and narrow sizes with reduced motion', async ({ page }, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const [width, height] of [[1280, 800], [800, 600], [360, 640]]) {
		await page.setViewportSize({ width: width!, height: height! }); await openPicnic(page);
		await expect(page.getByTestId('picnic-intro')).toBeVisible();
		expect(await page.getByTestId('thinking-scene').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
		await page.getByTestId('picnic-begin-chapter').scrollIntoViewIfNeeded();
		await expect(page.getByTestId('picnic-begin-chapter')).toBeInViewport();
		if (width === 1280) await page.screenshot({ path: testInfo.outputPath('picnic-intro.png') });
		await page.getByTestId('picnic-begin-chapter').click();
		await expect(page.locator('.observation-options')).toBeVisible();
	}
});
