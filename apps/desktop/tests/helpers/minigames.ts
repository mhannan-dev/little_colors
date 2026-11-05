import type { Page } from '@playwright/test';

const BN = '০১২৩৪৫৬৭৮৯';
export const toBn = (n: number) => String(n).replace(/\d/g, (d) => BN[Number(d)]!);

const COLOR_BN: Record<string, string> = {
	red: 'লাল',
	yellow: 'হলুদ',
	blue: 'নীল',
	orange: 'কমলা',
	green: 'সবুজ',
	purple: 'বেগুনি'
};
const BN_COLOR = Object.fromEntries(Object.entries(COLOR_BN).map(([k, v]) => [v, k]));

/** The right option, read only from what is on screen (caption, car, birds). */
export async function answerFor(page: Page, game: 'football' | 'garage' | 'birds'): Promise<string> {
	if (game === 'birds') {
		const counts = await page
			.locator('.branch')
			.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-count'))));
		return `[data-option-id="answer-${counts.reduce((s, n) => s + n, 0)}"]`;
	}
	if (game === 'garage') {
		const car = page.locator('.mover.car');
		const passengers = await car.getAttribute('data-passengers');
		if (passengers) return `[data-option-id="garage-${passengers}"]`;
		const label = (await car.getAttribute('aria-label'))!; // e.g. "লাল গাড়ি"
		return `[data-option-id="garage-${BN_COLOR[label.split(' ')[0]!]}"]`;
	}
	const caption = (await page.locator('.caption').textContent())!; // "নীল গোলে বল পাঠাই!"
	const word = caption.split(' ')[0]!;
	if (BN_COLOR[word]) return `[data-option-id="goal-${BN_COLOR[word]}"]`;
	throw new Error(`unexpected football caption: ${caption}`);
}

