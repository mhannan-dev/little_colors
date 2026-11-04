import { describe, expect, it } from 'vitest';
import {
	createMixingRound,
	getNarration,
	mixColors,
	narrationText,
	VOICE_MANIFEST,
	type Difficulty
} from '../src/index.ts';

describe('createMixingRound (spec 11)', () => {
	it('beginner: 3 recipes in fixed order with 2 containers', () => {
		const round = createMixingRound('beginner', 1);
		expect(round.activities.map((a) => a.expectedOutcome)).toEqual(['orange', 'green', 'purple']);
		for (const a of round.activities) {
			expect(a.offered).toHaveLength(2);
			expect(a.target).toBeNull();
			expect(mixColors(a.offered[0]!, a.offered[1]!)).toBe(a.expectedOutcome);
		}
	});

	it('advanced: target named, 3 primary containers', () => {
		const round = createMixingRound('advanced', 7);
		for (const a of round.activities) {
			expect(a.target).toBe(a.expectedOutcome);
			expect([...a.offered].sort()).toEqual(['blue', 'red', 'yellow']);
			expect(a.instructionKey).toBe(`mix.target.${a.target}`);
		}
	});

	it.each(['beginner', 'explorer', 'advanced'] as Difficulty[])(
		'%s: every round covers each recipe once and is reproducible from its seed',
		(difficulty) => {
			for (let seed = 0; seed < 1000; seed++) {
				const round = createMixingRound(difficulty, seed);
				expect(round.activities).toHaveLength(3);
				expect(new Set(round.activities.map((a) => a.expectedOutcome)).size).toBe(3);
				expect(createMixingRound(difficulty, seed)).toEqual(round);
			}
		}
	);

	it('every instruction key exists in the voice manifest', () => {
		for (const d of ['beginner', 'explorer', 'advanced'] as Difficulty[]) {
			for (const a of createMixingRound(d, 3).activities) {
				expect(getNarration(a.instructionKey)).toBeDefined();
			}
		}
	});
});

describe('voice manifest (AU-20..AU-22)', () => {
	it('has unique keys with Bengali and English text', () => {
		const keys = VOICE_MANIFEST.map((e) => e.key);
		expect(new Set(keys).size).toBe(keys.length);
		for (const e of VOICE_MANIFEST) {
			expect(e.bn.trim(), e.key).not.toBe('');
			expect(e.en.trim(), e.key).not.toBe('');
		}
	});

	it('every Islamic line has neutral variants', () => {
		for (const e of VOICE_MANIFEST.filter((x) => x.islamic)) {
			expect(e.neutralBn, e.key).toBeTruthy();
			expect(e.neutralEn, e.key).toBeTruthy();
		}
	});

	it('honors the Islamic expressions setting', () => {
		expect(narrationText('feedback.celebrate', 'bn-BD', true)).toBe('মাশাআল্লাহ! খুব সুন্দর!');
		expect(narrationText('feedback.celebrate', 'bn-BD', false)).toBe('খুব সুন্দর!');
		expect(narrationText('feedback.celebrate', 'en-US', false)).toBe('Beautiful!');
	});

	it('has every mixing narration the machine can emit', () => {
		for (const k of ['red-yellow', 'blue-yellow', 'blue-red']) {
			expect(getNarration(`mix.result.${k}`)).toBeDefined();
			expect(getNarration(`mix.intro.${k}`)).toBeDefined();
		}
		for (const c of ['red', 'yellow', 'blue', 'orange', 'green', 'purple']) {
			expect(getNarration(`color.${c}`)).toBeDefined();
		}
		expect(narrationText('mix.result.red-yellow', 'bn-BD', true)).toBe(
			'লাল আর হলুদ মিলে কমলা রং হলো!'
		);
	});
});
