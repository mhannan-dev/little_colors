import { createMachine, type Machine } from '../fsm/createMachine.ts';
import type { MatchingActivity } from './activityGenerator.ts';
import { isCorrectMatch, type MatchItem } from './matchValidator.ts';

export type MatchingState = 'IDLE' | 'SOURCE_SELECTED' | 'DRAGGING' | 'VALIDATING' | 'SNAPPED' | 'RETURNING' | 'CELEBRATING' | 'COMPLETE';
export type MatchingEvent =
	| { type: 'TAP_SOURCE'; itemId: string } | { type: 'DRAG_START'; itemId: string }
	| { type: 'TAP_TARGET'; targetId: string } | { type: 'DROP'; targetId: string | null }
	| { type: 'TAP_EMPTY' } | { type: 'DRAG_CANCEL' } | { type: 'VALIDATE' }
	| { type: 'SNAP_DONE' } | { type: 'RETURN_DONE' } | { type: 'HINT' }
	| { type: 'CELEBRATION_DONE' } | { type: 'NEXT' } | { type: 'RESET' };
export interface MatchingContext {
	activity: MatchingActivity;
	selectedId: string | null;
	targetId: string | null;
	matchedIds: string[];
	attempts: number;
	hintsUsed: number;
	hintEnabled: boolean;
}
export type MatchingEffect =
	| { type: 'narrate'; key: string }
	| { type: 'highlight' | 'followPointer' | 'return'; itemId: string }
	| { type: 'snap' | 'hint'; itemId: string; targetId: string }
	| { type: 'validate' | 'celebrate' | 'next' | 'cancelAll' }
	| { type: 'complete'; activityId: string; hintsUsed: number; shapes: string[] };
export type MatchingMachine = Machine<MatchingState, MatchingEvent, MatchingContext, MatchingEffect>;

export function createMatchingMachine(activity: MatchingActivity): MatchingMachine {
	const snapshot = JSON.parse(JSON.stringify(activity)) as MatchingActivity;
	const fresh = (): MatchingContext => ({ activity: snapshot, selectedId: null, targetId: null, matchedIds: [], attempts: 0, hintsUsed: 0, hintEnabled: false });
	const available = (ctx: MatchingContext, id: string) => ctx.activity.sources.some((item) => item.id === id) && !ctx.matchedIds.includes(id);
	const source = (ctx: MatchingContext) => ctx.activity.sources.find((item) => item.id === ctx.selectedId)!;
	const target = (ctx: MatchingContext) => ctx.activity.targets.find((item) => item.id === ctx.targetId)!;
	const name = (item: MatchItem, kind = 'name') => `match.${kind}.${item.color}.${item.shape}`;
	const validTarget = (ctx: MatchingContext, id: string | null) => id !== null && ctx.activity.targets.some((item) => item.id === id);
	const machine = createMachine<MatchingState, MatchingEvent, MatchingContext, MatchingEffect>({
		initialState: 'IDLE', initialContext: fresh,
		transitions: {
			IDLE: {
				TAP_SOURCE: { target: 'SOURCE_SELECTED', guard: (ctx, e) => available(ctx, e.itemId), reduce: (ctx, e) => ({ ...ctx, selectedId: e.itemId }), effects: (_, e, next) => [{ type: 'highlight', itemId: e.itemId }, { type: 'narrate', key: name(source(next)) }] },
				DRAG_START: { target: 'DRAGGING', guard: (ctx, e) => available(ctx, e.itemId), reduce: (ctx, e) => ({ ...ctx, selectedId: e.itemId }), effects: (_, e) => [{ type: 'followPointer', itemId: e.itemId }] },
				HINT: { target: 'IDLE', guard: (ctx) => ctx.hintEnabled, reduce: (ctx) => ({ ...ctx, hintsUsed: ctx.hintsUsed + 1 }), effects: (ctx) => {
					const item = ctx.activity.sources.find((item) => !ctx.matchedIds.includes(item.id));
					const match = item && ctx.activity.targets.find((target) => isCorrectMatch(item, target, ctx.activity.matchMode));
					return item && match ? [{ type: 'hint', itemId: item.id, targetId: match.id }, { type: 'narrate', key: name(item) }] : [];
				} }
			},
			SOURCE_SELECTED: {
				TAP_SOURCE: { target: 'SOURCE_SELECTED', guard: (ctx, e) => available(ctx, e.itemId), reduce: (ctx, e) => ({ ...ctx, selectedId: e.itemId }), effects: (_, e, next) => [{ type: 'highlight', itemId: e.itemId }, { type: 'narrate', key: name(source(next)) }] },
				TAP_TARGET: { target: 'VALIDATING', guard: (ctx, e) => validTarget(ctx, e.targetId), reduce: (ctx, e) => ({ ...ctx, targetId: e.targetId }), effects: () => [{ type: 'validate' }] },
				TAP_EMPTY: { target: 'IDLE', reduce: (ctx) => ({ ...ctx, selectedId: null }) }
			},
			DRAGGING: {
				DROP: [
					{ target: 'VALIDATING', guard: (ctx, e) => validTarget(ctx, e.targetId), reduce: (ctx, e) => ({ ...ctx, targetId: e.targetId }), effects: () => [{ type: 'validate' }] },
					{ target: 'RETURNING', effects: (ctx) => [{ type: 'return', itemId: ctx.selectedId! }] }
				],
				DRAG_CANCEL: { target: 'RETURNING', effects: (ctx) => [{ type: 'return', itemId: ctx.selectedId! }] }
			},
			VALIDATING: { VALIDATE: [
				{ target: 'SNAPPED', guard: (ctx) => isCorrectMatch(source(ctx), target(ctx), ctx.activity.matchMode), reduce: (ctx) => ({ ...ctx, matchedIds: [...ctx.matchedIds, ctx.selectedId!] }), effects: (ctx) => [{ type: 'snap', itemId: ctx.selectedId!, targetId: ctx.targetId! }, { type: 'narrate', key: name(source(ctx), 'correct') }] },
				{ target: 'RETURNING', reduce: (ctx) => ({ ...ctx, attempts: ctx.attempts + 1 }), effects: (ctx) => [{ type: 'return', itemId: ctx.selectedId! }, { type: 'narrate', key: 'match.retry' }] }
			] },
			SNAPPED: { SNAP_DONE: [
				{ target: 'IDLE', guard: (ctx) => ctx.matchedIds.length < ctx.activity.sources.length, reduce: (ctx) => ({ ...ctx, selectedId: null, targetId: null }) },
				{ target: 'CELEBRATING', effects: () => [{ type: 'celebrate' }, { type: 'narrate', key: 'match.celebrate' }] }
			] },
			RETURNING: { RETURN_DONE: { target: 'IDLE', reduce: (ctx) => ({ ...ctx, selectedId: null, targetId: null, hintEnabled: ctx.attempts >= 2 }) } },
			CELEBRATING: { CELEBRATION_DONE: { target: 'COMPLETE', effects: (ctx) => [{ type: 'complete', activityId: ctx.activity.id, hintsUsed: ctx.hintsUsed, shapes: [...new Set(ctx.activity.sources.map((item) => item.shape))] }] } },
			COMPLETE: { NEXT: { target: 'IDLE', reduce: fresh, effects: () => [{ type: 'next' }] } }
		},
		global: { RESET: { target: 'IDLE', reduce: fresh, effects: () => [{ type: 'cancelAll' }] } }
	});
	machine.reset = () => { machine.send({ type: 'RESET' }); };
	return machine;
}
