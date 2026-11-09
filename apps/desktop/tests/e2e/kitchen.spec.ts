import { expect, test, type Page } from '@playwright/test';

/** Rumi's Kitchen: no clock, nobody leaves; a wrong plate stays and can be fixed. */
async function order(page: Page) {
	const raw = (await page.locator('.bubble').getAttribute('data-order'))!;
	return raw.split(',').map((p) => {
		const [food, n] = p.split(':');
		return { food: food!, count: Number(n) };
	});
}
async function makePlate(page: Page) {
	for (const line of await order(page)) {
		for (let i = 0; i < line.count; i++) {
			await page.locator(`[data-food="${line.food}"]`).click();
			// Stove and juicer take a moment; the plate fills when it's ready.
			await expect(page.locator('.making')).toHaveCount(0, { timeout: 5000 });
		}
	}
}

test('serve five friends and everyone eats together', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/kitchen');
	await expect(page.locator('section.kitchen')).toBeVisible({ timeout: 60000 }); // first load compiles the page
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('section.kitchen')).toHaveAttribute('data-index', String(i));
		await expect(page.locator('section.kitchen')).toHaveAttribute('data-phase', 'order');
		await makePlate(page);
		if (i === 0) await page.screenshot({ path: 'test-results/kitchen.png' });
		await page.getByTestId('serve').click();
		await expect(page.getByText('ধন্যবাদ! খুব মজার খাবার!').first()).toBeVisible();
	}
	await expect(page.locator('section.kitchen')).toHaveAttribute('data-phase', 'done', { timeout: 10000 });
	await expect(page.locator('.guest')).toHaveCount(5);
	await page.screenshot({ path: 'test-results/kitchen-done.png' });
	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('a wrong plate is kept, the friend asks again, food can be taken off, and the right food glows after two tries', async ({ page }) => {
	await page.goto('/kitchen');
	await expect(page.locator('.bubble')).toBeVisible({ timeout: 60000 });
	const want = await order(page);
	const other = ['apple', 'banana', 'milk'].find((f) => !want.some((w) => w.food === f))!;
	await page.locator(`[data-food="${other}"]`).click();
	await expect(page.locator('.making')).toHaveCount(0, { timeout: 5000 });
	for (let i = 0; i < 2; i++) {
		await page.getByTestId('serve').click();
		await expect(page.locator('section.kitchen')).toHaveAttribute('data-phase', 'order');
		await expect(page.locator('.plate')).toHaveAttribute('data-tray', other); // still on the plate
	}
	await expect(page.locator(`[data-food="${want[0]!.food}"].glow`)).toBeVisible();
	await page.locator('.on-plate').first().click(); // take it off
	await expect(page.locator('.plate')).toHaveAttribute('data-tray', '');
	await makePlate(page);
	await page.getByTestId('serve').click();
	await expect(page.locator('section.kitchen')).toHaveAttribute('data-phase', 'thanks');
});
