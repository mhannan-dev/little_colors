import { describe, expect, it } from 'vitest';
import {
	createChoiceMachine,
	createPlay3DRound,
	getNarration,
	NARRATION_CATALOG,
	optionCountFor,
	symbolPool,
	SYMBOLS,
	type Difficulty,
	type Play3DGame,
	type SymbolSet
} from '../../src/index.ts';

const SETS: SymbolSet[] = ['abc', 'bangla', '123'];
const GAMES: Play3DGame[] = ['abc3d', 'car3d', 'race3d'];
const DIFFS: Difficulty[] = ['beginner', 'explorer', 'advanced'];

describe('3D symbol sets', () => {
	it('have A–Z, the 11 Bangla vowels and 1–10, with unique ids and spoken names', () => {
		expect(SYMBOLS.abc.map((s) => s.glyph).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
		expect(SYMBOLS.bangla.map((s) => s.glyph).join('')).toBe('অআইঈউঊঋএঐওঔ');
		expect(SYMBOLS['123'].map((s) => s.glyph)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
		for (const set of SETS) {
			const ids = SYMBOLS[set].map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
			for (const s of SYMBOLS[set]) {
				expect(s.bn.trim(), `${set}.${s.id}`).not.toBe('');
				expect(s.en.trim(), `${set}.${s.id}`).not.toBe('');
			}
		}
	});

	it('beginner pools start with the first letters/numbers', () => {
		expect(symbolPool('abc', 'beginner').map((s) => s.glyph).join('')).toBe('ABCDEFGHIJ');
		expect(symbolPool('123', 'beginner').map((s) => s.glyph)).toEqual(['1', '2', '3', '4', '5']);
	});
});

describe('3D rounds (1,000 seeds per game/set/difficulty)', () => {
	for (const game of GAMES) {
		for (const set of SETS) {
			for (const d of DIFFS) {
				it(`${game} / ${set} / ${d}`, () => {
					const pool = new Set(symbolPool(set, d).map((s) => s.id));
					for (let seed = 0; seed < 1000; seed++) {
						const round = createPlay3DRound(game, set, d, seed);
						expect(createPlay3DRound(game, set, d, seed)).toEqual(round);
						expect(round.activities).toHaveLength(5);
						// no symbol asked twice in a round
						expect(new Set(round.activities.map((a) => a.answerId)).size).toBe(5);
						for (const a of round.activities) {
							const ids = a.options.map((o) => o.id);
							expect(new Set(ids).size).toBe(ids.length);
							expect(ids).toContain(a.answerId);
							expect(a.options).toHaveLength(Math.min(optionCountFor(game, d), pool.size));
							for (const o of a.options) expect(pool.has(o.symbol!)).toBe(true);
							expect(getNarration(a.instructionKey), a.instructionKey).toBeDefined();
							expect(getNarration(a.correctKey), a.correctKey).toBeDefined();
						}
					}
				});
			}
		}
	}
});

describe('3D games use the shared choice machine', () => {
	it('a correct choice completes; wrong choices enable help', () => {
		const a = createPlay3DRound('car3d', 'bangla', 'beginner', 7).activities[0]!;
		const m = createChoiceMachine(a, { now: () => 1e9 });
		const wrong = a.options.find((o) => o.id !== a.answerId)!.id;
		for (let i = 0; i < 2; i++) {
			m.send({ type: 'CHOOSE', optionId: wrong });
			m.send({ type: 'ANIM_DONE' });
			m.send({ type: 'FEEDBACK_DONE' });
		}
		expect(m.context.hintEnabled).toBe(true);
		m.send({ type: 'CHOOSE', optionId: a.answerId });
		m.send({ type: 'ANIM_DONE' });
		expect(m.state).toBe('CORRECT');
	});

	it('the narration catalog still has unique keys', () => {
		const keys = NARRATION_CATALOG.map((e) => e.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
