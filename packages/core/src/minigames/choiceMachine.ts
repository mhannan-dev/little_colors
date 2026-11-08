import { createMachine, type Machine } from '../fsm/createMachine.ts';
import type { Clock } from '../session/Clock.ts';
import type { Color, Difficulty } from '../types/colors.ts';

/**
 * Shared "choose one" machine for the Football, Garage, and Birds mini-games.
 * The child picks one option; the app animates it; a correct pick is celebrated,
 * a wrong one returns gently (PR-08) and enables a hint after two misses (PR-22).
 */
export type MiniGame = 'football' | 'garage' | 'birds' | 'abc3d' | 'car3d' | 'race3d';

export interface ChoiceOption {
	id: string;
	color?: Color;
	number?: number;
	/** A letter or numeral symbol id (3D ABC & 123 games). */
	symbol?: string;
}

export interface ChoiceActivity<D = unknown> {
	id: string;
	game: MiniGame;
	difficulty: Difficulty;
	instructionKey: string;
	/** Narrated when the right option is chosen. */
	correctKey: string;
	options: ChoiceOption[];
	answerId: string;
	/** Game-specific scene data (car color, bird groups, …). */
	data: D;
}

export type ChoiceState =
	| 'READY'
	| 'ANIMATING'
	| 'CORRECT'
	| 'TRY_AGAIN'
	| 'CELEBRATING'
	| 'COMPLETE';

export type ChoiceEvent =
	| { type: 'CHOOSE'; optionId: string }
	| { type: 'ANIM_DONE' }
	| { type: 'FEEDBACK_DONE' }
	| { type: 'RESULT_SHOWN' }
	| { type: 'CELEBRATION_DONE' }
	| { type: 'HINT' }
	| { type: 'NEXT' }
	| { type: 'RESET' };

export interface ChoiceContext {
	activity: ChoiceActivity;
	chosenId: string | null;
	attempts: number;
	hintsUsed: number;
	hintEnabled: boolean;
	resultEnteredAt: number | null;
}

export type ChoiceEffect =
	| { type: 'animate'; optionId: string; correct: boolean }
	| { type: 'narrate'; key: string }
	| { type: 'hint'; optionId: string }
	| { type: 'celebrate' }
	| { type: 'complete'; activityId: string; hintsUsed: number }
	| { type: 'next' }
	| { type: 'cancelAll' };

export type ChoiceMachine = Machine<ChoiceState, ChoiceEvent, ChoiceContext, ChoiceEffect>;

export const CHOICE_RESULT_DISPLAY_MS = 1200;

export function createChoiceMachine(
	activity: ChoiceActivity,
	clock: Pick<Clock, 'now'> = { now: () => Date.now() }
): ChoiceMachine {
	const snapshot = JSON.parse(JSON.stringify(activity)) as ChoiceActivity;
	const fresh = (): ChoiceContext => ({
		activity: snapshot,
		chosenId: null,
		attempts: 0,
		hintsUsed: 0,
		hintEnabled: false,
		resultEnteredAt: null
	});
	const known = (ctx: ChoiceContext, id: string) => ctx.activity.options.some((o) => o.id === id);
	const isRight = (ctx: ChoiceContext) => ctx.chosenId === ctx.activity.answerId;

	const machine = createMachine<ChoiceState, ChoiceEvent, ChoiceContext, ChoiceEffect>({
		initialState: 'READY',
		initialContext: fresh,
		transitions: {
			READY: {
				CHOOSE: {
					target: 'ANIMATING',
					guard: (ctx, e) => known(ctx, e.optionId),
					reduce: (ctx, e) => ({ ...ctx, chosenId: e.optionId }),
					effects: (ctx, e) => [
						{ type: 'animate', optionId: e.optionId, correct: e.optionId === ctx.activity.answerId }
					]
				},
				HINT: {
					target: 'READY',
					guard: (ctx) => ctx.hintEnabled,
					reduce: (ctx) => ({ ...ctx, hintsUsed: ctx.hintsUsed + 1 }),
					effects: (ctx) => [
						{ type: 'hint', optionId: ctx.activity.answerId },
						{ type: 'narrate', key: ctx.activity.instructionKey }
					]
				}
			},
			ANIMATING: {
				ANIM_DONE: [
					{
						target: 'CORRECT',
						guard: isRight,
						reduce: (ctx) => ({ ...ctx, resultEnteredAt: clock.now() }),
						effects: (ctx) => [{ type: 'narrate', key: ctx.activity.correctKey }]
					},
					{
						target: 'TRY_AGAIN',
						reduce: (ctx) => ({ ...ctx, attempts: ctx.attempts + 1 }),
						effects: () => [{ type: 'narrate', key: 'feedback.try-again' }]
					}
				]
			},
			TRY_AGAIN: {
				FEEDBACK_DONE: {
					target: 'READY',
					reduce: (ctx) => ({ ...ctx, chosenId: null, hintEnabled: ctx.attempts >= 2 })
				}
			},
			CORRECT: {
				RESULT_SHOWN: {
					target: 'CELEBRATING',
					guard: (ctx) =>
						ctx.resultEnteredAt !== null &&
						clock.now() - ctx.resultEnteredAt >= CHOICE_RESULT_DISPLAY_MS,
					effects: () => [{ type: 'celebrate' }, { type: 'narrate', key: 'feedback.celebrate' }]
				}
			},
			CELEBRATING: {
				CELEBRATION_DONE: {
					target: 'COMPLETE',
					effects: (ctx) => [
						{ type: 'complete', activityId: ctx.activity.id, hintsUsed: ctx.hintsUsed }
					]
				}
			},
			COMPLETE: {
				NEXT: { target: 'READY', reduce: fresh, effects: () => [{ type: 'next' }] }
			}
		},
		global: {
			RESET: { target: 'READY', reduce: fresh, effects: () => [{ type: 'cancelAll' }] }
		}
	});
	machine.reset = () => {
		machine.send({ type: 'RESET' });
	};
	return machine;
}
