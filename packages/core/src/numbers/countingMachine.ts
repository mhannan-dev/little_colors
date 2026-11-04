import { createMachine, type Machine } from '../fsm/createMachine.ts';
import type { Clock } from '../session/Clock.ts';
import { questionObjects, type NumberQuestion } from './questionGenerator.ts';

export const COUNT_RESULT_DISPLAY_MS = 1500;
export type CountingState = 'READY' | 'COUNTING' | 'ANSWER_SELECTED' | 'VALIDATING' | 'CORRECT' | 'TRY_AGAIN' | 'CELEBRATING' | 'COMPLETE';
export type CountingEvent =
	| { type: 'TAP_OBJECT'; objectId: string } | { type: 'SELECT_ANSWER'; answerId: string }
	| { type: 'ANSWER_READY' } | { type: 'VALIDATE' } | { type: 'COUNT_DONE' }
	| { type: 'FEEDBACK_DONE' } | { type: 'HINT' } | { type: 'HINT_DONE' }
	| { type: 'RESULT_SHOWN' } | { type: 'CELEBRATION_DONE' } | { type: 'NEXT' } | { type: 'RESET' };
export interface CountingContext {
	question: NumberQuestion; countedIds: string[]; selectedAnswerId: string | null;
	attempts: number; hintsUsed: number; hintEnabled: boolean; hinting: boolean;
	resultEnteredAt: number | null;
}
export interface CountingStep { objectId: string; number: number; key: string }
export type CountingEffect =
	| { type: 'counted'; objectId: string; number: number; key: string }
	| { type: 'wiggle'; objectId: string }
	| { type: 'highlightAnswer'; answerId: string }
	| { type: 'narrate'; key: string }
	| { type: 'total'; number: number; key: string }
	| { type: 'hint' | 'explain'; question: NumberQuestion; steps: CountingStep[] }
	| { type: 'prepareValidation' | 'validate' | 'countComplete' | 'celebrate' | 'next' | 'cancelAll' }
	| { type: 'complete'; activityId: string; hintsUsed: number; countedUpTo: number };
export type CountingMachine = Machine<CountingState, CountingEvent, CountingContext, CountingEffect>;

export function countingSteps(question: NumberQuestion, forHint = false): CountingStep[] {
	const groups = question.kind === 'compare' ? [question.left.objects, question.right.objects]
		: question.kind === 'numeral-to-quantity' && forHint ? question.groups.map((group) => group.objects) : [questionObjects(question)];
	return groups.flatMap((group) => group.map((object, index) => ({ objectId: object.id, number: index + 1, key: `number.${index + 1}` })));
}

export function createCountingMachine(question: NumberQuestion, clock: Pick<Clock, 'now'> = { now: () => Date.now() }): CountingMachine {
	const snapshot = JSON.parse(JSON.stringify(question)) as NumberQuestion;
	const fresh = (): CountingContext => ({ question: snapshot, countedIds: [], selectedAnswerId: null, attempts: 0, hintsUsed: 0, hintEnabled: snapshot.kind === 'count', hinting: false, resultEnteredAt: null });
	const total = (ctx: CountingContext) => ctx.question.kind === 'count' ? ctx.question.objects.length : 0;
	const knownObject = (ctx: CountingContext, id: string) => ctx.question.kind === 'count' && ctx.question.objects.some((object) => object.id === id);
	const mark = (ctx: CountingContext, id: string): CountingContext => ({ ...ctx, countedIds: [...ctx.countedIds, id] });
	const counted = (ctx: CountingContext, id: string): CountingEffect => ({ type: 'counted', objectId: id, number: ctx.countedIds.length, key: `number.${ctx.countedIds.length}` });
	const totalEffect = (ctx: CountingContext): CountingEffect => ({ type: 'total', number: total(ctx), key: `numbers.total.${total(ctx)}` });
	const achievement = (q: NumberQuestion) => q.kind === 'pattern' ? 0 : q.kind === 'compare' ? Math.max(q.left.objects.length, q.right.objects.length) : q.answer;
	const resultKey = (q: NumberQuestion) => q.kind === 'add' ? `numbers.add.${q.left.objects.length}.${q.right.objects.length}` : q.kind === 'pattern' ? 'numbers.pattern.correct' : 'numbers.correct';
	const machine = createMachine<CountingState, CountingEvent, CountingContext, CountingEffect>({
		initialState: 'READY', initialContext: fresh,
		transitions: {
			READY: {
				TAP_OBJECT: { target: 'COUNTING', guard: (ctx, e) => !ctx.hinting && knownObject(ctx, e.objectId), reduce: (ctx, e) => mark(ctx, e.objectId), effects: (_, e, next) => [counted(next, e.objectId), ...(total(next) === 1 ? [{ type: 'countComplete' } as const] : [])] },
				SELECT_ANSWER: { target: 'ANSWER_SELECTED', guard: (ctx, e) => !ctx.hinting && ctx.question.kind !== 'count' && ctx.question.options.some((option) => option.id === e.answerId), reduce: (ctx, e) => ({ ...ctx, selectedAnswerId: e.answerId }), effects: (_, e) => [{ type: 'highlightAnswer', answerId: e.answerId }, { type: 'prepareValidation' }] },
				HINT: { target: 'READY', guard: (ctx) => ctx.hintEnabled && !ctx.hinting, reduce: (ctx) => ({ ...ctx, hinting: true, hintsUsed: ctx.hintsUsed + 1 }), effects: (ctx) => [{ type: 'hint', question: ctx.question, steps: countingSteps(ctx.question, true) }] },
				HINT_DONE: { target: 'READY', guard: (ctx) => ctx.hinting, reduce: (ctx) => ({ ...ctx, hinting: false }) }
			},
			COUNTING: {
				TAP_OBJECT: [
					{ target: 'COUNTING', guard: (ctx, e) => ctx.countedIds.includes(e.objectId), effects: (_, e) => [{ type: 'wiggle', objectId: e.objectId }] },
					{ target: 'CORRECT', guard: (ctx, e) => knownObject(ctx, e.objectId) && ctx.countedIds.length + 1 === total(ctx), reduce: (ctx, e) => ({ ...mark(ctx, e.objectId), resultEnteredAt: clock.now() }), effects: (_, e, next) => [counted(next, e.objectId), totalEffect(next)] },
					{ target: 'COUNTING', guard: (ctx, e) => knownObject(ctx, e.objectId), reduce: (ctx, e) => mark(ctx, e.objectId), effects: (_, e, next) => [counted(next, e.objectId)] }
				],
				COUNT_DONE: { target: 'CORRECT', guard: (ctx) => ctx.countedIds.length === total(ctx) && total(ctx) > 0, reduce: (ctx) => ({ ...ctx, resultEnteredAt: clock.now() }), effects: (ctx) => [totalEffect(ctx)] }
			},
			ANSWER_SELECTED: { ANSWER_READY: { target: 'VALIDATING', effects: () => [{ type: 'validate' }] } },
			VALIDATING: { VALIDATE: [
				{ target: 'CORRECT', guard: (ctx) => ctx.question.options.find((option) => option.id === ctx.selectedAnswerId)?.value === ctx.question.answer, reduce: (ctx) => ({ ...ctx, resultEnteredAt: clock.now() }), effects: (ctx) => [{ type: 'explain', question: ctx.question, steps: countingSteps(ctx.question) }, { type: 'narrate', key: resultKey(ctx.question) }] },
				{ target: 'TRY_AGAIN', reduce: (ctx) => ({ ...ctx, attempts: ctx.attempts + 1 }), effects: () => [{ type: 'narrate', key: 'numbers.retry' }] }
			] },
			TRY_AGAIN: { FEEDBACK_DONE: { target: 'READY', reduce: (ctx) => ({ ...ctx, selectedAnswerId: null, hintEnabled: ctx.attempts >= 2 }) } },
			CORRECT: { RESULT_SHOWN: { target: 'CELEBRATING', guard: (ctx) => ctx.resultEnteredAt !== null && clock.now() - ctx.resultEnteredAt >= COUNT_RESULT_DISPLAY_MS, effects: () => [{ type: 'celebrate' }, { type: 'narrate', key: 'numbers.celebrate' }] } },
			CELEBRATING: { CELEBRATION_DONE: { target: 'COMPLETE', effects: (ctx) => [{ type: 'complete', activityId: ctx.question.id, hintsUsed: ctx.hintsUsed, countedUpTo: achievement(ctx.question) }] } },
			COMPLETE: { NEXT: { target: 'READY', reduce: fresh, effects: () => [{ type: 'next' }] } }
		},
		global: { RESET: { target: 'READY', reduce: fresh, effects: () => [{ type: 'cancelAll' }] } }
	});
	machine.reset = () => { machine.send({ type: 'RESET' }); };
	return machine;
}
