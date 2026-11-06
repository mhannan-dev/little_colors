import { expect, test } from '@playwright/test';

test('learns flower names and counts a full set from the play menu', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'ফুল চিনি ও গুনি', exact: true }).click();
	await expect(page).toHaveURL(/\/flower$/);
	const garden = page.getByRole('region', { name: 'রুমির ফুলের বাগান' });
	const artByName = new Map<string, string>();
	for (const card of await garden.locator('.flower-card').all()) {
		artByName.set(await card.locator('svg').innerHTML(), (await card.innerText()).trim());
	}
	expect(artByName.size).toBe(6);
	await garden.getByRole('button', { name: 'শাপলা', exact: true }).click();
	await expect(garden.getByRole('heading', { name: 'শাপলা' })).toBeVisible();
	await expect(garden.getByText('Water lily', { exact: true })).toBeVisible();

	await garden.getByRole('button', { name: 'ফুল চিনি', exact: true }).click();
	const correct = artByName.get(await garden.locator(':scope > svg').innerHTML());
	await garden.getByRole('button', { name: correct!, exact: true }).click();
	await expect(garden.getByRole('button', { name: /পরের ফুল/ })).toBeVisible();

	await garden.getByRole('button', { name: 'ফুল গুনি', exact: true }).click();
	const seen = new Set<number>();
	for (let i = 0; i < 6; i++) {
		const flowers = garden.getByRole('group', { name: 'ফুল গুনি', exact: true }).getByRole('button');
		const count = await flowers.count();
		seen.add(count);
		await expect(flowers.first()).toHaveAttribute('aria-pressed', 'false');
		await flowers.first().click();
		await expect(flowers.first()).toHaveAttribute('aria-pressed', 'true');
		await garden.getByRole('button', { name: new Intl.NumberFormat('bn').format(count), exact: true }).click();
		await garden.getByRole('button', { name: /পরের ফুল/ }).click();
	}
	expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
	await expect(garden.getByRole('status')).toContainText('ছয়টি ফুলের খেলা শেষ');
});
