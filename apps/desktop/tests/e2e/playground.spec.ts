import { expect, test, type Page, type Locator } from '@playwright/test';

const cell = (page: Page, index: number) => page.locator(`[data-playground-cell="${index}"]`);
const stamp = (page: Page, id: string) => page.locator(`[data-stamp="${id}"]`);
async function open(page: Page, older = false) {
	await page.goto('/thinking');
	const sound = page.locator('[data-testid="sound-toggle"]').first();
	if (await sound.getAttribute('aria-pressed') === 'true') await sound.click();
	if (older) await page.getByTestId('age-8-10').click();
	await page.getByTestId('open-playground').click(); await expect(page.getByTestId('creative-playground')).toBeVisible();
}
async function center(locator: Locator) { await locator.scrollIntoViewIfNeeded(); const box = (await locator.boundingBox())!; return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }
async function drag(page: Page, source: Locator, target: Locator) {
	const to = await center(target), from = await center(source);
	await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 12, from.y + 2, { steps: 3 });
	await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
}
async function addPattern(page: Page, items: string[]) {
	await page.getByTestId('playground-pattern').click();
	for (const id of items) { await stamp(page, id).click(); await page.getByTestId('pattern-add').click(); }
}

test('tap placement, move, rotate, remove, clear and undo retain a session draft', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
	await open(page);
	await stamp(page, 'food.apple').click(); await cell(page, 0).click();
	await expect(cell(page, 0)).toHaveAttribute('data-token', 'food.apple');
	const id = await cell(page, 0).getAttribute('data-item-id');
	await page.getByTestId('playground-rotate').click(); await expect(cell(page, 0)).toHaveAttribute('data-rotation', '90');
	await cell(page, 1).click(); await expect(cell(page, 1)).toHaveAttribute('data-item-id', id!); await expect(cell(page, 0)).not.toHaveAttribute('data-item-id');
	await page.getByTestId('playground-remove').click(); await expect(cell(page, 1)).not.toHaveAttribute('data-item-id');
	await page.getByTestId('playground-undo').click(); await expect(cell(page, 1)).toHaveAttribute('data-item-id', id!);
	await page.getByTestId('playground-clear').click(); await expect(page.locator('[data-playground-cell][data-item-id]')).toHaveCount(0);
	await page.getByTestId('playground-undo').click(); await expect(cell(page, 1)).toHaveAttribute('data-item-id', id!);
	await page.getByTestId('playground-back').click(); await page.getByTestId('open-playground').click();
	await expect(cell(page, 1)).toHaveAttribute('data-item-id', id!); expect(errors).toEqual([]);
});

test('pointer dragging places and moves items, and dropping outside the board cancels', async ({ page }) => {
	await open(page);
	await drag(page, stamp(page, 'food.apple'), cell(page, 5));
	await expect(page.locator('[data-playground-cell][data-item-id]')).toHaveCount(1);
	await expect(cell(page, 5)).toHaveAttribute('data-token', 'food.apple');
	const id = await cell(page, 5).getAttribute('data-item-id');
	await drag(page, cell(page, 5), cell(page, 10)); await expect(cell(page, 10)).toHaveAttribute('data-item-id', id!);
	await drag(page, cell(page, 10), page.getByRole('heading', { level: 1 }));
	await expect(cell(page, 10)).toHaveAttribute('data-item-id', id!);
	await expect(page.locator('[data-playground-cell][data-item-id]')).toHaveCount(1);
});

test('keyboard can choose shapes, place, nudge, rotate and undo', async ({ page }) => {
	await open(page); await page.getByTestId('playground-shapes').click();
	await stamp(page, 'triangle.blue').focus(); await page.keyboard.press('Enter');
	await cell(page, 0).focus(); await page.keyboard.press('Space'); await expect(cell(page, 0)).toHaveAttribute('data-token', 'triangle.blue');
	await page.keyboard.press('ArrowRight'); await expect(cell(page, 1)).toHaveAttribute('data-token', 'triangle.blue'); await expect(cell(page, 1)).toBeFocused();
	await page.getByTestId('playground-rotate').focus(); await page.keyboard.press('Enter'); await expect(cell(page, 1)).toHaveAttribute('data-rotation', '90');
	await page.getByTestId('playground-undo').focus(); await page.keyboard.press('Enter'); await expect(cell(page, 1)).toHaveAttribute('data-rotation', '0');
});

test('garden ideas are editable and undoable, and Rumi responds to taps', async ({ page }, testInfo) => {
	await open(page); await page.getByTestId('playground-garden').click();
	await page.getByTestId('playground-flower').click(); await expect(page.locator('[data-playground-cell][data-item-id]')).toHaveCount(8);
	await page.screenshot({ path: testInfo.outputPath('creative-flower.png') });
	await page.getByTestId('playground-cat').click(); await expect(page.locator('[data-playground-cell][data-item-id]')).toHaveCount(7);
	await page.getByTestId('playground-undo').click(); await expect(page.locator('[data-playground-cell][data-item-id]')).toHaveCount(8);
	await page.getByTestId('playground-rumi').click(); await expect(page.getByTestId('playground-silly-hat')).toBeVisible();
});

test('child-created pattern lets Rumi copy one item at a time without a timer', async ({ page }, testInfo) => {
	await open(page, true); const items = ['food.apple', 'food.sandwich', 'food.bottle', 'food.apple', 'food.sandwich', 'food.bottle'];
	await addPattern(page, items); await page.getByTestId('pattern-rumi').click();
	await expect(page.locator('[data-testid="pattern-copy"] [data-pattern-token]')).toHaveCount(0);
	for (let index = 0; index < items.length; index++) { await page.getByTestId('pattern-rumi-next').click(); await expect(page.locator('[data-testid="pattern-copy"] [data-pattern-token]')).toHaveCount(index + 1); }
	await expect(page.getByTestId('pattern-matched')).toBeVisible();
	const tokens = await page.locator('[data-testid="pattern-copy"] [data-pattern-token]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-pattern-token')));
	expect(tokens).toEqual(items);
	await page.screenshot({ path: testInfo.outputPath('creative-pattern.png') });
});

test('copy together encourages a retry without removing earlier matches', async ({ page }) => {
	await open(page); await addPattern(page, ['food.apple', 'food.sandwich', 'food.apple']);
	await page.getByTestId('pattern-together').click();
	await stamp(page, 'food.apple').click(); await page.getByTestId('pattern-copy-add').click();
	await page.getByTestId('pattern-copy-add').click(); await expect(page.locator('[data-testid="pattern-copy"] [data-pattern-token]')).toHaveCount(1);
	await expect(page.getByTestId('pattern-matched')).toHaveCount(0);
	await stamp(page, 'food.sandwich').click(); await page.getByTestId('pattern-copy-add').click();
	await stamp(page, 'food.apple').click(); await page.getByTestId('pattern-copy-add').click();
	await expect(page.getByTestId('pattern-matched')).toBeVisible();
	await page.getByTestId('pattern-edit').click(); await expect(page.locator('[data-testid="pattern-source"] [data-pattern-token]')).toHaveCount(3);
});

test('touch tap placement works without requiring dragging', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 800, height: 600 } });
	const page = await context.newPage(); await open(page);
	const token = await center(stamp(page, 'food.apple')); await page.touchscreen.tap(token.x, token.y);
	const spot = await center(cell(page, 2)); await page.touchscreen.tap(spot.x, spot.y);
	await expect(cell(page, 2)).toHaveAttribute('data-token', 'food.apple'); await context.close();
});

test('creative controls remain reachable without horizontal overflow on small screens', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const [width, height] of [[1280, 800], [800, 600], [360, 640]]) {
		await page.setViewportSize({ width: width!, height: height! }); await open(page);
		await cell(page, 15).scrollIntoViewIfNeeded(); await expect(cell(page, 15)).toBeInViewport();
		expect(await page.getByTestId('thinking-scene').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
		await page.getByTestId('playground-pattern').click();
		expect(await page.getByTestId('thinking-scene').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
	}
});
