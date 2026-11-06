import { describe, expect, it } from 'vitest';
import { PICTURE_FLAGS, getNarration } from '@little-colors/core';
import { FLAG_COUNTRIES, PICTURE_ROUND_LENGTH, createPictureQuiz, flagFamily, flagQuizReducer, pictureChoices } from './flagGame.ts';

describe('flag picture mode (PR-27)', () => {
	it('every familiar flag exists in the collection and has a spoken question', () => {
		for (const f of PICTURE_FLAGS) {
			expect(FLAG_COUNTRIES.some((c) => c.id === f.id), f.id).toBe(true);
			expect(getNarration(`flags.find.${f.id}`), f.id).toBeDefined();
		}
	});

	it('rounds start with Bangladesh, have no repeats, and stay in the familiar list (1,000 seeds)', () => {
		const familiar = new Set<string>(PICTURE_FLAGS.map((f) => f.id));
		for (let seed = 0; seed < 1000; seed++) {
			const q = createPictureQuiz(seed);
			expect(q.deck[0]).toBe('bd');
			expect(q.deck).toHaveLength(PICTURE_ROUND_LENGTH);
			expect(new Set(q.deck).size).toBe(q.deck.length);
			for (const id of q.deck) expect(familiar.has(id)).toBe(true);
		}
	});

	it('each question offers 3 distinct pictures: the answer once, no look-alikes, all familiar', () => {
		const familiar = new Set<string>(PICTURE_FLAGS.map((f) => f.id));
		for (let seed = 0; seed < 300; seed++) {
			let q = createPictureQuiz(seed);
			for (let i = 0; i < q.deck.length; i++) {
				const options = pictureChoices(q);
				const answer = q.deck[q.index]!;
				expect(options).toHaveLength(3);
				expect(new Set(options.map((o) => o.id)).size).toBe(3);
				expect(options.filter((o) => o.id === answer)).toHaveLength(1);
				expect(options.filter((o) => flagFamily(o.id) === flagFamily(answer))).toHaveLength(1);
				for (const o of options) expect(familiar.has(o.id)).toBe(true);
				q = flagQuizReducer(q, { type: 'ANSWER', id: answer }, pictureChoices);
				expect(q.phase).toBe('correct');
				q = flagQuizReducer(q, { type: 'NEXT' }, pictureChoices);
			}
			expect(q.phase).toBe('finished');
		}
	});

	it('choices stay stable after a wrong answer and a hint', () => {
		const q = createPictureQuiz(5);
		const before = pictureChoices(q);
		const wrong = before.find((o) => o.id !== q.deck[0])!;
		const after = flagQuizReducer(flagQuizReducer(q, { type: 'ANSWER', id: wrong.id }, pictureChoices), { type: 'HINT' }, pictureChoices);
		expect(after.phase).toBe('play');
		expect(after.attempts).toBe(1);
		expect(pictureChoices(after)).toEqual(before);
	});
});
