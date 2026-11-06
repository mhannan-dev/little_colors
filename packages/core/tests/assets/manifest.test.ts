import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, audioPathFor, placeholders } from '../../src/assets/manifest.ts';
import { NARRATION_CATALOG as VOICE_MANIFEST } from '../../src/audio/catalog.ts';
import { CLIPS } from '../../src/audio/segments.ts';

describe('asset manifest (spec 14)', () => {
	it('has unique keys, and every entry has a path, status, and license (AS-10, AS-50)', () => {
		const keys = ASSET_MANIFEST.map((a) => a.key);
		expect(new Set(keys).size).toBe(keys.length);
		for (const a of ASSET_MANIFEST) {
			expect(a.path, a.key).toBeTruthy();
			expect(a.license, a.key).toBeTruthy();
			expect(['placeholder', 'final']).toContain(a.status);
		}
	});

	it('lists a recording slot for every narration line in both languages', () => {
		for (const n of VOICE_MANIFEST) {
			for (const locale of ['bn-BD', 'en-US'] as const) {
				expect(ASSET_MANIFEST.some((a) => a.path === audioPathFor(n.key, locale))).toBe(true);
			}
		}
	});

	it('maps narration keys to file names', () => {
		expect(audioPathFor('mix.result.red-yellow', 'bn-BD')).toBe(
			'audio/bn-BD/mix-result-red-yellow.mp3'
		);
	});

	it('reports the mascot as a placeholder until final art exists (AS-42)', () => {
		expect(placeholders().some((a) => a.key === 'mascot.rumi')).toBe(true);
	});
});

describe('asset manifest: recordings the app can request', () => {
	it('lists neutral variants of Islamic lines and every composition clip', () => {
		const paths = new Set(ASSET_MANIFEST.map((a) => a.path));
		for (const n of VOICE_MANIFEST.filter((e) => e.islamic)) {
			expect(paths.has(audioPathFor(n.key, 'bn-BD', true)), n.key).toBe(true);
		}
		for (const c of CLIPS) expect(paths.has(audioPathFor(c.key, 'bn-BD')), c.key).toBe(true);
	});
});
