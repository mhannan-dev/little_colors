import { describe, expect, it } from 'vitest';
import { learning, neutral, neutralDark, toCssVariables } from '../src/index.ts';

function luminance(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x! + 0.05) / (y! + 0.05);
};

describe('design tokens (spec 02)', () => {
	it('matches the spec learning palette', () => {
		expect(learning).toEqual({
			red: '#E5484D',
			yellow: '#F2C94C',
			blue: '#3478D4',
			orange: '#F28C28',
			green: '#35A66A',
			purple: '#8A5AC2'
		});
	});

	it.each([
		['light', neutral],
		['dark', neutralDark]
	] as const)('%s text meets WCAG AA on every background (DS-27)', (_, n) => {
		for (const bg of [n['bg-primary'], n['bg-secondary'], n.surface]) {
			expect(contrast(n['text-primary'], bg)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(n['text-secondary'], bg)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('emits CSS variables for all tokens', () => {
		const css = toCssVariables();
		expect(css).toContain('--bg-primary: #FFF9F0;');
		expect(css).toContain('--learn-orange: #F28C28;');
		expect(css).toContain('--target-game: 88px;');
	});
});
