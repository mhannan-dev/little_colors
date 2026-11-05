import { expect, type Page } from '@playwright/test';

const BN = '০১২৩৪৫৬৭৮৯';
export const toBn = (n: number) => String(n).replace(/\d/g, (d) => BN[Number(d)]!);
export const fromBn = (s: string) => Number(s.replace(/[০-৯]/g, (c) => String(BN.indexOf(c))));

export const field = (page: Page) => page.locator('.field');

/** Solves whichever activity is on screen, reading only what a child could see. */
export async function solve(page: Page) {
	const kind = await field(page).getAttribute('data-kind');
	if (kind === 'count') {
		const objs = page.locator('button.count-object');
		const n = await objs.count();
		for (let i = 0; i < n; i++) await objs.nth(i).click();
		await expect(page.locator('.numeral.show')).toHaveText(toBn(n));
	} else if (kind === 'numeral-to-quantity') {
		const n = fromBn((await page.getByTestId('target-number').textContent())!.trim());
		await page.locator(`button.basket[data-count="${n}"]`).click();
	} else if (kind === 'compare') {
		const ask = await field(page).getAttribute('data-ask');
		const l = Number(await page.locator('button.side[data-side="left"]').getAttribute('data-count'));
		const r = Number(await page.locator('button.side[data-side="right"]').getAttribute('data-count'));
		if (l === r) await page.getByRole('button', { name: 'সমান' }).click();
		else {
			const pickLeft = ask === 'more' ? l > r : l < r;
			await page.locator(`button.side[data-side="${pickLeft ? 'left' : 'right'}"]`).click();
		}
	} else if (kind === 'add') {
		const counts = await page.locator('.sum .group').evaluateAll((els) =>
			els.map((e) => Number(e.getAttribute('data-count')))
		);
		await page.getByRole('button', { name: toBn(counts[0]! + counts[1]!), exact: true }).click();
	} else if (kind === 'pattern') {
		const seq = await page.locator('.pattern .tok[data-token]').evaluateAll((els) =>
			els.map((e) => e.getAttribute('data-token')!)
		);
		let p = 1;
		while (!seq.every((tok, i) => tok === seq[i % p])) p++;
		await page.locator(`button.token[data-token="${seq[seq.length % p]}"]`).click();
	} else {
		throw new Error(`unknown activity kind ${kind}`);
	}
}

