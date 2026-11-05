import { describe, expect, it } from 'vitest';
import {
	createBirdsRound,
	createChoiceMachine,
	createFootballRound,
	createGarageRound,
	createMiniGameRound,
	getNarration,
	CHOICE_RESULT_DISPLAY_MS,
	type ChoiceActivity,
	type ChoiceEffect,
	type Difficulty,
	type MiniGame
} from '../../src/index.ts';
import { createFakeClock } from '../helpers/fakeClock.ts';

const DIFFS: Difficulty[] = ['beginner', 'explorer', 'advanced'];
const GAMES: MiniGame[] = ['football', 'garage', 'birds'];

function machineWith(activity: ChoiceActivity) {
	const clock = createFakeClock();
	const m = createChoiceMachine(activity, clock);
	const effects: ChoiceEffect[] = [];
	m.onEffect((e) => effects.push(e));
	return { m, clock, effects };
}

describe('mini-game rounds (generator invariants over 1,000 seeds, QA-03)', () => {
	for (const game of GAMES) {
		for (const d of DIFFS) {
			it(`${game} / ${d}`, () => {
				for (let seed = 0; seed < 1000; seed++) {
					const round = createMiniGameRound(game, d, seed);
					expect(round.activities).toHaveLength(5);
					expect(createMiniGameRound(game, d, seed)).toEqual(round); // deterministic
					for (const a of round.activities) {
						const ids = a.options.map((o) => o.id);
						expect(new Set(ids).size, a.id).toBe(ids.length); // unique options
						expect(ids).toContain(a.answerId); // exactly one answer exists
						expect(a.options.length).toBe(d === 'beginner' ? 2 : 3);
						expect(getNarration(a.instructionKey), a.instructionKey).toBeDefined();
						expect(getNarration(a.correctKey), a.correctKey).toBeDefined();
						for (const o of a.options) {
							if (o.number !== undefined) {
								expect(Number.isInteger(o.number)).toBe(true);
								expect(o.number).toBeGreaterThanOrEqual(1);
								expect(o.number).toBeLessThanOrEqual(d === 'beginner' ? 5 : 10);
							}
						}
					}
				}
			});
		}
	}

	it('football: color goals below Advanced, numbered goals (1–5) at Advanced', () => {
		for (const a of createFootballRound('beginner', 3).activities) {
			expect(a.options.every((o) => o.color && o.number === undefined)).toBe(true);
		}
		for (const a of createFootballRound('advanced', 3).activities) {
			expect(a.options.every((o) => o.number !== undefined && o.number <= 5)).toBe(true);
		}
	});

	it('garage: color mode answer matches the car; count mode matches passengers', () => {
		for (let seed = 0; seed < 200; seed++) {
			for (const a of createGarageRound('explorer', seed).activities) {
				expect(a.answerId).toBe(`garage-${a.data.carColor}`);
			}
			for (const a of createGarageRound('advanced', seed).activities) {
				expect(a.data.by).toBe('count');
				if (a.data.by === 'count') expect(a.answerId).toBe(`garage-${a.data.passengers}`);
			}
		}
	});

	it('birds: answer is the total; Advanced uses two branches with sum ≤ 10 (no subtraction)', () => {
		for (let seed = 0; seed < 500; seed++) {
			for (const a of createBirdsRound('advanced', seed).activities) {
				expect(a.data.branches).toHaveLength(2);
				const total = a.data.branches[0]! + a.data.branches[1]!;
				expect(total).toBeLessThanOrEqual(10);
				expect(a.answerId).toBe(`answer-${total}`);
			}
			for (const a of createBirdsRound('beginner', seed).activities) {
				expect(a.data.branches).toHaveLength(1);
				expect(a.data.branches[0]).toBeLessThanOrEqual(5);
			}
		}
	});
});

describe('choice machine transition table', () => {
	const activity = createFootballRound('beginner', 1).activities[0]!;
	const wrongId = activity.options.find((o) => o.id !== activity.answerId)!.id;

	it('correct path: READY → ANIMATING → CORRECT → CELEBRATING → COMPLETE', () => {
		const { m, clock, effects } = machineWith(activity);
		expect(m.send({ type: 'CHOOSE', optionId: activity.answerId })).toBe(true);
		expect(m.state).toBe('ANIMATING');
		expect(effects.at(-1)).toEqual({ type: 'animate', optionId: activity.answerId, correct: true });
		m.send({ type: 'ANIM_DONE' });
		expect(m.state).toBe('CORRECT');
		expect(effects.at(-1)).toEqual({ type: 'narrate', key: activity.correctKey });
		// Minimum display time is enforced by the machine.
		expect(m.send({ type: 'RESULT_SHOWN' })).toBe(false);
		clock.advanceBy(CHOICE_RESULT_DISPLAY_MS);
		expect(m.send({ type: 'RESULT_SHOWN' })).toBe(true);
		expect(m.state).toBe('CELEBRATING');
		m.send({ type: 'CELEBRATION_DONE' });
		expect(m.state).toBe('COMPLETE');
		expect(effects.at(-1)).toEqual({ type: 'complete', activityId: activity.id, hintsUsed: 0 });
	});

	it('wrong choice gets a gentle retry; hint unlocks after two misses (PR-08, PR-22)', () => {
		const { m, effects } = machineWith(activity);
		expect(m.send({ type: 'HINT' })).toBe(false);
		for (let i = 0; i < 2; i++) {
			m.send({ type: 'CHOOSE', optionId: wrongId });
			expect(effects.at(-1)).toEqual({ type: 'animate', optionId: wrongId, correct: false });
			m.send({ type: 'ANIM_DONE' });
			expect(m.state).toBe('TRY_AGAIN');
			expect(effects.at(-1)).toEqual({ type: 'narrate', key: 'feedback.try-again' });
			m.send({ type: 'FEEDBACK_DONE' });
			expect(m.state).toBe('READY');
		}
		expect(m.context.hintEnabled).toBe(true);
		expect(m.send({ type: 'HINT' })).toBe(true);
		expect(effects).toContainEqual({ type: 'hint', optionId: activity.answerId });
		expect(m.context.hintsUsed).toBe(1);
	});

	it('ignores unknown options and events not listed for the state', () => {
		const { m } = machineWith(activity);
		expect(m.send({ type: 'CHOOSE', optionId: 'nope' })).toBe(false);
		for (const type of ['ANIM_DONE', 'FEEDBACK_DONE', 'RESULT_SHOWN', 'CELEBRATION_DONE', 'NEXT'] as const) {
			expect(m.send({ type })).toBe(false);
		}
		m.send({ type: 'CHOOSE', optionId: activity.answerId });
		// Double taps while animating are ignored.
		expect(m.send({ type: 'CHOOSE', optionId: wrongId })).toBe(false);
		expect(m.context.chosenId).toBe(activity.answerId);
	});

	it('RESET from any state returns to a fresh READY and cancels app work', () => {
		const { m, effects } = machineWith(activity);
		m.send({ type: 'CHOOSE', optionId: wrongId });
		m.send({ type: 'ANIM_DONE' });
		m.reset();
		expect(m.state).toBe('READY');
		expect(m.context.attempts).toBe(0);
		expect(effects.at(-1)).toEqual({ type: 'cancelAll' });
	});
});
