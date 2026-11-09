import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('animal detective: progress per solved round (no score) and a completion badge', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto('/play');
	await page.getByRole('button', { name: 'প্রাণী গোয়েন্দা', exact: true }).click();
	await expect(page).toHaveURL(/\/animals$/);

	const game = page.getByRole('region', { name: 'প্রাণী গোয়েন্দা' });
	const prompt = game.getByRole('heading', { level: 2 });
	await game.getByRole('button', { name: /প্রাণী চিনি/ }).click();
	const photos = game.locator('.photo');
	await expect(photos).toHaveCount(3);
	await expect.poll(() => photos.locator('img').evaluateAll(images =>
		images.every(image => (image as HTMLImageElement).naturalWidth > 0)
	)).toBe(true);
	const animal = (await prompt.innerText()).split(' কোথায়?')[0]!;
	await photos.and(game.getByRole('button', { name: new RegExp(`^(?!${animal}$).+`) })).first().click();
	await expect(game.getByRole('status')).toContainText('আরেকবার');
	await expect(game.locator('.pdot.filled')).toHaveCount(0);
	await game.getByRole('button', { name: animal, exact: true }).click();
	await expect(game.getByRole('status')).toContainText(/\u09A0\u09BF\u0995|found/u);
	await expect(game.locator('.reward')).toHaveCSS('animation-name', /celebrate/);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(game.locator('.reward')).toHaveCSS('animation-name', 'none');

	await game.getByRole('button', { name: /প্রাণী গুনি/ }).click();
	const seen = new Set<number>();
	const bn = new Intl.NumberFormat('bn');
	for (let round = 1; round <= 6; round++) {
		const target = (await prompt.innerText()).match(/কয়টি ছবিতে (.+) আছে\?/u)?.[1];
		expect(target).toBeTruthy();
		const matches = game.getByRole('button', { name: target!, exact: true });
		await expect(photos).toHaveCount(7);
		const quantity = await matches.count();
		seen.add(quantity);
		await expect(matches.first()).toHaveAttribute('aria-pressed', 'false');
		await matches.first().click();
		await expect(matches.first()).toHaveAttribute('aria-pressed', 'true');
		await game.getByRole('button', { name: bn.format(quantity), exact: true }).click();
		await expect(game.locator('.pdot.filled')).toHaveCount(round);
		await game.getByRole('button', { name: /পরের প্রশ্ন/ }).click();
	}
	expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
	await expect(prompt).toContainText('গোয়েন্দার ব্যাজ পেয়েছ');
	await expect(game.locator('.badge')).toBeVisible();
	await expect(game.locator('.badge .medal svg')).toBeVisible();
	await expect(game.locator('.badge canvas')).toHaveCount(0);
	await game.getByRole('button', { name: /আবার খেলি/ }).click();
	await expect(game.locator('.pdot')).toHaveCount(6);
	await expect(game.locator('.pdot.filled')).toHaveCount(0);
});

test('help appears after two misses and marks the right photo (PR-22)', async ({ page }) => {
	await page.goto('/animals');
	const game = page.locator('section.detective');
	await game.getByRole('button', { name: /প্রাণী চিনি/ }).click();
	const animal = (await game.getByRole('heading', { level: 2 }).innerText()).trim().split(' ')[0]!;
	const wrong = game.locator('.photo').and(game.getByRole('button', { name: new RegExp(`^(?!${animal}$).+`) })).first();
	await expect(page.locator('[data-action="hint"]')).toHaveCount(0);
	await wrong.click();
	await wrong.click();
	await page.locator('[data-action="hint"]').click();
	await expect(game.locator('.photo.hinted')).toHaveAccessibleName(animal);
	await expect(page.getByTestId('ghost-hand')).toHaveClass(/show/);
});

test('every animal photo is bundled and loads, including the buffalo', async ({ request }) => {
	const src = readFileSync(new URL('../../../../packages/core/src/numbers/lessons/animalNarration.ts', import.meta.url), 'utf8');
	const files = [...src.matchAll(/'((?:pexels|mohish)-[^']+)'/g)].map((m) => m[1]!);
	expect(files).toContain('mohish-20211115090834');
	expect(files.length).toBeGreaterThanOrEqual(11);
	for (const f of files) {
		const res = await request.get(`/images/${f}.webp`);
		expect(res.status(), f).toBe(200);
	}
});

test('no score or star-count text (PR-07)', async ({ page }) => {
	await page.goto('/animals');
	const game = page.locator('section.detective');
	await game.getByRole('button', { name: /প্রাণী চিনি/ }).click();
	await expect(game.locator('.stars')).toHaveCount(0);
	await expect(game).not.toContainText(' / ');
});
