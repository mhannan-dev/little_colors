import { expect, test } from '@playwright/test';

const SHOTS = process.env.SHOT_DIR;
const shot = async (page: import('@playwright/test').Page, name: string) => {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

// Beginner round order (spec 11): red+yellow, blue+yellow (offered yellow, blue), red+blue.
const ROUND = [
	{ a: 'লাল', b: 'হলুদ', result: 'কমলা' },
	{ a: 'হলুদ', b: 'নীল', result: 'সবুজ' },
	{ a: 'লাল', b: 'নীল', result: 'বেগুনি' }
];

test('welcome → mode selection → full beginner color-mixing round → completion', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	await page.goto('/');
	await expect(page.getByRole('button', { name: 'খেলি' })).toBeVisible();
	await page.waitForTimeout(800);
	await shot(page, '01-welcome');
	await page.getByRole('button', { name: 'খেলি' }).click();

	await expect(page.getByRole('heading', { name: 'কোন খেলা খেলবে?' })).toBeVisible();
	await shot(page, '02-mode-selection');
	await page.getByRole('button', { name: 'রং মেশানো' }).click();

	for (const [i, step] of ROUND.entries()) {
		await expect(page.getByRole('img', { name: 'সাদা ফুটবল' })).toBeVisible();
		await page.getByRole('button', { name: step.a, exact: true }).click();
		await expect(page.getByRole('img', { name: `${step.a} ফুটবল` })).toBeVisible();
		if (i === 0) await shot(page, '03-first-color');

		// CM-12: a repeated tap on the same color does nothing.
		await page.getByRole('button', { name: step.a, exact: true }).click();
		await page.getByRole('button', { name: step.b, exact: true }).click();

		await expect(page.getByRole('img', { name: `${step.result} ফুটবল` })).toBeVisible({ timeout: 5000 });
		await expect(page.getByText(`মিলে ${step.result} রং হলো!`)).toBeVisible();
		if (i === 0) await shot(page, '04-result');

		const next = page.getByRole('button', { name: 'পরেরটা' });
		await expect(next).toBeVisible({ timeout: 8000 });
		if (i === 0) await shot(page, '05-complete');
		await next.click();
	}

	await expect(page.getByRole('button', { name: 'আবার খেলি' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'অন্য খেলা' })).toBeVisible();
	await shot(page, '06-round-done');

	await page.getByRole('button', { name: 'অন্য খেলা' }).click();
	await expect(page.getByRole('heading', { name: 'কোন খেলা খেলবে?' })).toBeVisible();

	expect(errors).toEqual([]);
});

test('reset during an activity returns the football to white (CM-36)', async ({ page }) => {
	await page.goto('/mixing');
	await page.getByRole('button', { name: 'লাল', exact: true }).click();
	await expect(page.getByRole('img', { name: 'লাল ফুটবল' })).toBeVisible();
	await page.getByRole('button', { name: 'আবার শুরু' }).click();
	await expect(page.getByRole('img', { name: 'সাদা ফুটবল' })).toBeVisible();
});

test('back during an animation leaves cleanly (CM-37)', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/mixing');
	await page.getByRole('button', { name: 'লাল', exact: true }).click();
	await page.getByRole('button', { name: 'ফিরে যাই' }).click();
	await expect(page.getByRole('heading', { name: 'কোন খেলা খেলবে?' })).toBeVisible();
	await page.waitForTimeout(1500);
	expect(errors).toEqual([]);
});
