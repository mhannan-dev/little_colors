import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('safari: five discoveries include listening, unique counting and picture-based snacks', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	await page.goto('/play');
	await page.getByTestId('game-search').fill('Animal Safari');
	await page.getByRole('button', { name: 'Rumi’s Animal Safari 3D', exact: true }).click();
	const game = page.getByTestId('animal-safari');
	await page.getByRole('button', { name: /Little safari/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.getByRole('button', { name: 'Rabbit', exact: true }).click();
	await page.getByRole('button', { name: 'Lion', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Elephant', exact: true })).toHaveClass(/hinted/);
	await page.getByRole('button', { name: 'Elephant', exact: true }).click();
	await page.getByRole('button', { name: /Next stop/ }).click();
	await expect(game).toHaveAttribute('data-lesson', 'listen');
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.getByRole('button', { name: /Hear the toy call/ }).click();
	await page.getByRole('button', { name: 'Lion', exact: true }).click();
	await page.getByRole('button', { name: /Next stop/ }).click();
	await expect(game).toHaveAttribute('data-lesson', 'count');
	await expect(game).toHaveAttribute('data-phase', 'choice');
	const first = page.getByRole('button', { name: 'Rabbit 1', exact: true });
	await first.click();
	await expect(first).toBeDisabled();
	await first.evaluate(element => (element as HTMLButtonElement).click());
	await expect(game).toHaveAttribute('data-counted', '1');
	await page.getByRole('button', { name: 'Rabbit 2', exact: true }).click();
	await page.getByRole('button', { name: 'Rabbit 3', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'celebrate');
	await page.getByRole('button', { name: /Next stop/ }).click();
	await expect(game).toHaveAttribute('data-lesson', 'food');
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.screenshot({ path: 'test-results/animal-safari-snacks.png' });
	await page.getByRole('button', { name: 'Grass', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.getByRole('button', { name: 'Carrot', exact: true }).click();
	await page.getByRole('button', { name: /Next stop/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.screenshot({ path: 'test-results/animal-safari-giraffe.png' });
	await page.getByRole('button', { name: 'Giraffe', exact: true }).click();
	await page.getByRole('button', { name: /Meet our friends/ }).click();
	await expect(page.getByRole('heading', { name: 'Hello, animal friends!' })).toBeVisible();
	await page.getByRole('button', { name: /Explore again/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'হাতি কোথায়?' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('safari: jeep pauses, projected animals work, and phone layout fits', async ({ page }) => {
	await page.goto('/animal-safari');
	const game = page.getByTestId('animal-safari');
	await expect(game).toHaveAttribute('data-ready', 'true');
	await page.screenshot({ path: 'test-results/animal-safari-picker.png' });
	await page.getByRole('button', { name: /Little safari/ }).click();
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await page.waitForTimeout(2800);
	await expect(game).toHaveAttribute('data-phase', 'travel');
	await page.getByRole('button', { name: /Continue/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.screenshot({ path: 'test-results/animal-safari-3d.png' });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.locator('.stage').scrollIntoViewIfNeeded();
	await page.screenshot({ path: 'test-results/animal-safari-phone.png', fullPage: true });
	expect(await page.locator('.safari-shell').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
	const elephant = page.getByRole('button', { name: 'Elephant', exact: true });
	await expect(elephant).toBeVisible();
	await elephant.click();
	await expect(game).toHaveAttribute('data-phase', 'celebrate');
});

test('safari: counting five rabbits remains unique and keyboard accessible', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/animal-safari');
	await page.getByRole('button', { name: /Count together/ }).click();
	const game = page.getByTestId('animal-safari');
	for (let total = 1; total <= 5; total++) {
		await expect(game).toHaveAttribute('data-phase', 'choice');
		if (total === 5) {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.locator('.stage').scrollIntoViewIfNeeded();
			await expect(page.getByRole('button', { name: 'Rabbit 1', exact: true })).toBeInViewport();
			await page.screenshot({ path: 'test-results/animal-safari-five-rabbits.png' });
			const stage = await page.locator('.stage').boundingBox();
			for (const target of await page.locator('[data-animal-id]').all()) {
				const box = await target.boundingBox();
				expect(box!.x).toBeGreaterThanOrEqual(stage!.x);
				expect(box!.x + box!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
			}
		}
		for (let id = 0; id < total; id++) {
			await page.getByRole('button', { name: `Rabbit ${id + 1}`, exact: true }).focus();
			await page.keyboard.press('Enter');
		}
		await expect(game).toHaveAttribute('data-phase', 'celebrate');
		await page.getByRole('button', { name: total === 5 ? /Meet our friends/ : /Next stop/ }).click();
	}
	await expect(game).toHaveAttribute('data-phase', 'done');
});

test('safari: picture fallback, muted calls and Bengali snacks remain usable', async ({ page }) => {
	await page.addInitScript(() => {
		const context = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
			if (type === 'webgl' || type === 'webgl2') return null;
			return Reflect.apply(context, this, [type, ...args]);
		} as typeof context;
	});
	await page.goto('/animal-safari');
	const game = page.getByTestId('animal-safari');
	await expect(game).toHaveAttribute('data-fallback', 'true');
	await page.getByTestId('sound-toggle').click();
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await page.getByRole('button', { name: /খাবারের সময়/ }).click();
	await expect(page.getByRole('heading', { name: 'খরগোশ গাজর চায়' })).toBeVisible();
	await page.getByRole('button', { name: 'পাতা', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.getByRole('button', { name: 'গাজর', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'celebrate');
});

test('safari: illustrated guide pauses the jeep, traps focus and restores the help button', async ({ page }) => {
	await page.goto('/animal-safari');
	const help = page.getByRole('button', { name: /How to play/ });
	await help.click();
	const guide = page.getByRole('dialog', { name: 'How to play', exact: true });
	await expect(guide.getByRole('heading', { name: 'Hop into the jeep' })).toBeVisible();
	for (let step = 0; step < 4; step++) await guide.getByRole('button', { name: /Next step/ }).click();
	await expect(guide.getByRole('heading', { name: 'Match the snack' })).toBeVisible();
	await guide.getByRole('button', { name: /Let’s explore/ }).click();
	await expect(help).toBeFocused();
	await page.getByRole('button', { name: /Little safari/ }).click();
	await help.click();
	await page.waitForTimeout(2800);
	await expect(page.getByTestId('animal-safari')).toHaveAttribute('data-phase', 'travel');
	await page.keyboard.press('Escape');
	await expect(guide).toHaveCount(0);
	await expect(help).toBeFocused();
	await expect(page.getByTestId('animal-safari')).toHaveAttribute('data-phase', 'choice');
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
	await page.getByRole('button', { name: /কীভাবে খেলব/ }).click();
	const banglaGuide = page.getByRole('dialog', { name: 'কীভাবে খেলব' });
	await expect(banglaGuide).toBeInViewport();
	await expect(banglaGuide.getByRole('heading', { name: 'জিপে উঠে পড়ি' })).toBeVisible();
	await banglaGuide.getByRole('button', { name: 'একটি একটি করে গুনি', exact: true }).click();
	await expect(banglaGuide.getByRole('heading', { name: 'একটি একটি করে গুনি' })).toBeVisible();
	await page.screenshot({ path: 'test-results/animal-safari-how-to-play.png' });
	await page.keyboard.press('Tab');
	expect(await banglaGuide.evaluate(element => element.contains(document.activeElement))).toBe(true);
	await banglaGuide.getByRole('button', { name: 'নির্দেশনা বন্ধ করি' }).click();
});

test('safari: hints point to the correct animal, next uncounted rabbit and requested snack', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/animal-safari');
	await page.getByRole('button', { name: /Little safari/ }).click();
	const game = page.getByTestId('animal-safari');
	await expect(page.getByRole('button', { name: 'Elephant', exact: true })).toBeVisible();
	await page.getByRole('button', { name: /💡 Hint/ }).click();
	await expect(page.getByRole('button', { name: 'Elephant', exact: true })).toHaveClass(/hinted/);
	await expect(game).toHaveAttribute('data-phase', 'choice');
	await page.getByRole('button', { name: /Choose an adventure/ }).click();
	await page.getByRole('button', { name: /Count together/ }).click();
	await page.getByRole('button', { name: 'Rabbit 1', exact: true }).click();
	await page.getByRole('button', { name: /Next stop/ }).click();
	await page.getByRole('button', { name: 'Rabbit 1', exact: true }).click();
	await page.getByRole('button', { name: /💡 Hint/ }).click();
	await expect(page.getByRole('button', { name: 'Rabbit 1', exact: true })).not.toHaveClass(/hinted/);
	await expect(page.getByRole('button', { name: 'Rabbit 2', exact: true })).toHaveClass(/hinted/);
	await expect(game).toHaveAttribute('data-counted', '1');
	await page.getByRole('button', { name: /Choose an adventure/ }).click();
	await page.getByRole('button', { name: /Snack time/ }).click();
	await page.getByRole('button', { name: /💡 Hint/ }).click();
	await expect(page.getByRole('button', { name: 'Carrot', exact: true })).toHaveClass(/hinted/);
	await expect(page.getByRole('button', { name: 'Grass', exact: true })).not.toHaveClass(/hinted/);
	await expect(game).toHaveAttribute('data-phase', 'choice');
});
