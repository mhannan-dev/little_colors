import { createMachine, type Machine } from '../fsm/createMachine.ts';
import type { Color } from '../types/colors.ts';
import type { Clock } from '../session/Clock.ts';
import { mixColors } from './colorMixer.ts';

export const RESULT_DISPLAY_MS = 1500;

/** Spec 05 — Football Color Mixing state machine (transition table in 05-color-mixing.md). */
export type MixingState =
	| 'READY'
	| 'FIRST_COLOR_SELECTED'
	| 'FIRST_COLOR_APPLIED'
	| 'SECOND_COLOR_SELECTED'
	| 'MIXING'
	| 'RESULT'
	| 'CELEBRATING'
	| 'COMPLETE';

export type MixingEvent =
	| { type: 'SELECT_COLOR'; color: Color }
	| { type: 'POUR_DONE' }
	| { type: 'MIX_DONE' }
	| { type: 'RESULT_SHOWN' }
	| { type: 'CELEBRATION_DONE' }
	| { type: 'NEXT' }
	| { type: 'RESET' };

export interface MixingContext {
	offered: Color[];
	target: Color | null;
	first: Color | null;
	second: Color | null;
	footballColor: Color | 'white';
	result: Color | null;
	/** Time in the injected gameplay clock; null outside a successful result. */
	resultEnteredAt: number | null;
}

export type MixingEffect =
	| { type: 'pour'; color: Color }
	| { type: 'mix'; from: Color; to: Color }
	| { type: 'wiggle'; color: Color }
	| { type: 'narrate'; key: string }
	| { type: 'showWrongResult'; color: Color }
	| { type: 'celebrate' }
	| { type: 'complete'; result: Color }
	| { type: 'next' }
	| { type: 'cancelAll' };

export interface MixingSetup {
	offered: Color[];
	target?: Color | null;
}

export type MixingMachine = Machine<MixingState, MixingEvent, MixingContext, MixingEffect>;

export function initialMixingContext(setup: MixingSetup): MixingContext {
	return {
		offered: [...setup.offered],
		target: setup.target ?? null,
		first: null,
		second: null,
		footballColor: 'white',
		result: null,
		resultEnteredAt: null
	};
}

/** Sorted, dash-joined recipe id used in narration keys, e.g. "red-yellow". */
export function recipeKey(a: Color, b: Color): string {
	return [a, b].sort().join('-');
}

/** Inject a gameplay clock for deterministic/paused time. No timers run here. */
export function createMixingMachine(
	setup: MixingSetup,
	clock: Pick<Clock, 'now'> = { now: () => Date.now() }
): MixingMachine {
	const initialSetup: MixingSetup = { offered: [...setup.offered], target: setup.target ?? null };
	const fresh = () => initialMixingContext(initialSetup);
	const machine = createMachine<MixingState, MixingEvent, MixingContext, MixingEffect>({
		initialState: 'READY',
		initialContext: fresh,
		transitions: {
			READY: {
				SELECT_COLOR: {
					target: 'FIRST_COLOR_SELECTED',
					guard: (ctx, e) => ctx.offered.includes(e.color),
					reduce: (ctx, e) => ({ ...ctx, first: e.color }),
					effects: (_, e) => [{ type: 'pour', color: e.color }]
				}
			},
			FIRST_COLOR_SELECTED: {
				POUR_DONE: {
					target: 'FIRST_COLOR_APPLIED',
					guard: (ctx) => ctx.first !== null,
					reduce: (ctx) => ({ ...ctx, footballColor: ctx.first! }),
					effects: (ctx) => [{ type: 'narrate', key: `color.${ctx.first}` }]
				}
			},
			FIRST_COLOR_APPLIED: {
				SELECT_COLOR: [
					{
						// Same color again: no change, gentle hint on another container.
						target: 'FIRST_COLOR_APPLIED',
						guard: (ctx, e) => e.color === ctx.first,
						effects: (ctx) => {
							const other = ctx.offered.find((c) => c !== ctx.first);
							return other ? [{ type: 'wiggle', color: other }] : [];
						}
					},
					{
						target: 'SECOND_COLOR_SELECTED',
						guard: (ctx, e) => ctx.offered.includes(e.color),
						reduce: (ctx, e) => ({ ...ctx, second: e.color }),
						effects: (_, e) => [{ type: 'pour', color: e.color }]
					}
				]
			},
			SECOND_COLOR_SELECTED: {
				POUR_DONE: {
					target: 'MIXING',
					guard: (ctx) => ctx.first !== null && ctx.second !== null,
					reduce: (ctx) => ({ ...ctx, result: mixColors(ctx.first!, ctx.second!) }),
					// Even an unsupported pair needs a completion path to MIX_DONE.
					// Keep the existing color during its swirl, then let the retry reset it.
					effects: (ctx, _, next) => [
						{ type: 'mix', from: ctx.first!, to: next.result ?? ctx.first! }
					]
				}
			},
			MIXING: {
				MIX_DONE: [
					{
						// Unsupported pair (CM-32): football back to white, gentle retry.
						target: 'READY',
						guard: (ctx) => ctx.result === null,
						reduce: fresh,
						effects: () => [{ type: 'narrate', key: 'mix.retry' }]
					},
					{
						// Advanced: real result shown, then invite another try.
						target: 'READY',
						guard: (ctx) => ctx.target !== null && ctx.result !== ctx.target,
						reduce: fresh,
						effects: (ctx) => [
							{ type: 'showWrongResult', color: ctx.result! },
							{ type: 'narrate', key: `mix.result.${recipeKey(ctx.first!, ctx.second!)}` },
							{ type: 'narrate', key: `mix.target.${ctx.target}` }
						]
					},
					{
						target: 'RESULT',
						reduce: (ctx) => ({ ...ctx, footballColor: ctx.result!, resultEnteredAt: clock.now() }),
						effects: (ctx) => [
							{ type: 'narrate', key: `mix.result.${recipeKey(ctx.first!, ctx.second!)}` }
						]
					}
				]
			},
			RESULT: {
				RESULT_SHOWN: {
					target: 'CELEBRATING',
					guard: (ctx) => ctx.resultEnteredAt !== null && clock.now() - ctx.resultEnteredAt >= RESULT_DISPLAY_MS,
					effects: () => [{ type: 'celebrate' }]
				}
			},
			CELEBRATING: {
				CELEBRATION_DONE: {
					target: 'COMPLETE',
					effects: (ctx) => [{ type: 'complete', result: ctx.result! }]
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
	// Both public reset paths must cancel app-layer work, not just clear state.
	machine.reset = () => { machine.send({ type: 'RESET' }); };
	return machine;
}
