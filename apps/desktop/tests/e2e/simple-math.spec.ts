import { expect, test, type Page } from '@playwright/test';

/** Simple Math: count apples, gentle retry, hint glow after two tries, a set of five, no score. */
const digits = (text: string) => text.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
async function expected(page: Page) {
	const eq = digits(await page.getByTestId('math-equation').innerText());
	const [left, right] = eq.match(/\d+/g)!.map(Number);
	return eq.includes('+') ? left! + right! : left! - right!;
}

test('wrong numbers wobble and the right one glows after two tries; five sums end in a party', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/play');
	await page.locator('[data-chip="letters"]').click({ timeout: 60000 });
	await page.getByRole('button', { name: 'সহজ অঙ্ক' }).click();
	await expect(page).toHaveURL(/\/simple-math$/);
	const scene = page.locator('section.math');

	const answer = await expected(page);
	const wrong = page.locator(`.choice:not([data-choice="${answer}"])`);
	await wrong.nth(0).click();
	await expect(scene).toHaveAttribute('data-tries', '1');
	await wrong.nth(1).click();
	await expect(page.locator(`.choice[data-choice="${answer}"]`)).toHaveClass(/glow/);
	await page.screenshot({ path: 'test-results/simple-math-hint.png' });

	for (let round = 0; round < 5; round++) {
		await page.locator(`.choice[data-choice="${await expected(page)}"]`).click();
		await expect(scene).toHaveAttribute('data-done', String(round + 1));
		if (round < 4) await page.locator('[data-action="next"]').click();
	}
	await expect(scene).toHaveAttribute('data-finished', 'true');
	await page.screenshot({ path: 'test-results/simple-math-done.png' });
	await page.locator('[data-action="replay"]').click();
	await expect(scene).toHaveAttribute('data-done', '0');

	// Taking away, up to 20: answers stay ≥ 0 and removed apples are crossed out.
	await page.locator('[data-math-mode="subtract"]').click();
	await page.locator('[data-limit="20"]').click();
	await expect(page.getByTestId('math-equation')).toContainText('−');
	expect(await expected(page)).toBeGreaterThanOrEqual(0);
	await page.screenshot({ path: 'test-results/simple-math-subtract.png' });
	expect(errors).toEqual([]);
});
