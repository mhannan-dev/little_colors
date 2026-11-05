import { createRng, shuffle } from '../../learning/rng.ts';
import { createPlaygroundStamp } from './creativePlayground.ts';
import { createThinkingLesson, moveOnGrid, sameCell, type GridCell, type GridDirection, type PathLesson, type ThinkingAgeBand, type ThinkingToken } from './thinkingLessons.ts';

export const TRAIN_STAGES = ['pattern', 'seats', 'route'] as const;
export interface PatternTrainPlan {
	ageBand: ThinkingAgeBand; seed: number; carriages: ThinkingToken[]; gaps: number[];
	options: ThinkingToken[]; passengers: ThinkingToken[]; seats: (ThinkingToken | null)[]; route: PathLesson;
}
export interface PatternTrainProgress {
	stage: number; phase: 'intro' | 'observe' | 'play' | 'complete' | 'finished';
	filled: number; seated: number; position: GridCell; completed: number; hint: boolean; feedbackKey: string;
}
export type PatternTrainAction = { type: 'BEGIN' } | { type: 'HIDE' } | { type: 'PEEK' } |
	{ type: 'CARRIAGE'; id: string } | { type: 'SEAT'; index: number } | { type: 'MOVE'; direction: GridDirection } |
	{ type: 'HINT' } | { type: 'RESET' } | { type: 'NEXT' };

export function createPatternTrain(ageBand: ThinkingAgeBand, seed: number): PatternTrainPlan {
	const rng = createRng(seed), older = ageBand === '8-10';
	const options = shuffle(['circle', 'square', 'triangle', 'star'] as const, rng).map((shape, i) => createPlaygroundStamp(shape, (['blue', 'green', 'orange'] as const)[i % 3]!));
	const unit = options.slice(0, older ? 3 : 2);
	const carriages = Array.from({ length: older ? 9 : 6 }, (_, i) => unit[i % unit.length]!);
	const passengers = shuffle(options, rng).slice(0, older ? 4 : 3);
	const locations = shuffle([0, 1, 2, 3, 4, 5], rng);
	return { ageBand, seed, options: shuffle(options, rng), carriages, gaps: older ? [4, 8] : [2, 5], passengers,
		seats: Array.from({ length: 6 }, (_, index) => passengers[locations.indexOf(index)] ?? null),
		route: createThinkingLesson('grid-path', ageBand, Math.floor(rng() * 0x100000000)) as PathLesson };
}
export function initialPatternTrain(plan: PatternTrainPlan): PatternTrainProgress {
	return { stage: 0, phase: 'intro', filled: 0, seated: 0, position: { ...plan.route.start }, completed: 0, hint: false, feedbackKey: 'train.story.pattern' };
}
const complete = (state: PatternTrainProgress): PatternTrainProgress => ({ ...state, phase: 'complete', completed: state.completed + 1, hint: false, feedbackKey: 'train.complete' });
export function patternTrainReducer(plan: PatternTrainPlan, state: PatternTrainProgress, action: PatternTrainAction): PatternTrainProgress {
	if (action.type === 'BEGIN') return state.phase === 'intro' ? { ...state, phase: state.stage === 1 ? 'observe' : 'play', feedbackKey: `train.instruction.${TRAIN_STAGES[state.stage]}` } : state;
	if (action.type === 'NEXT') return state.phase !== 'complete' ? state : state.stage === 2
		? { ...state, phase: 'finished', feedbackKey: 'train.done' }
		: { ...state, stage: state.stage + 1, phase: 'intro', hint: false, feedbackKey: `train.story.${TRAIN_STAGES[state.stage + 1]}` };
	if (action.type === 'RESET') return ['play', 'observe'].includes(state.phase) ? { ...state,
		filled: state.stage === 0 ? 0 : state.filled, seated: state.stage === 1 ? 0 : state.seated,
		position: state.stage === 2 ? { ...plan.route.start } : state.position, phase: state.stage === 1 ? 'observe' : 'play', hint: false, feedbackKey: `train.instruction.${TRAIN_STAGES[state.stage]}` } : state;
	if (action.type === 'HIDE') return state.stage === 1 && state.phase === 'observe' ? { ...state, phase: 'play', feedbackKey: 'train.seats.recall' } : state;
	if (action.type === 'PEEK') return state.stage === 1 && state.phase === 'play' ? { ...state, phase: 'observe', hint: false, feedbackKey: 'train.instruction.seats' } : state;
	if (state.phase !== 'play') return state;
	if (action.type === 'HINT') return { ...state, hint: true, feedbackKey: `train.hint.${TRAIN_STAGES[state.stage]}` };
	if (action.type === 'CARRIAGE' && state.stage === 0) {
		if (plan.carriages[plan.gaps[state.filled]!]?.id !== action.id) return { ...state, feedbackKey: 'train.retry' };
		const next = { ...state, filled: state.filled + 1, hint: false, feedbackKey: 'train.filled' };
		return next.filled === plan.gaps.length ? complete(next) : next;
	}
	if (action.type === 'SEAT' && state.stage === 1) {
		if (!Number.isInteger(action.index) || !plan.seats[action.index] || plan.seats[action.index]!.id !== plan.passengers[state.seated]?.id) return { ...state, feedbackKey: 'train.retry' };
		const next = { ...state, seated: state.seated + 1, hint: false, feedbackKey: 'train.seated' };
		return next.seated === plan.passengers.length ? complete(next) : next;
	}
	if (action.type === 'MOVE' && state.stage === 2) {
		const position = moveOnGrid(plan.route, state.position, action.direction);
		if (!position) return { ...state, feedbackKey: 'train.blocked' };
		const next = { ...state, position, hint: false, feedbackKey: 'train.moved' };
		return sameCell(position, plan.route.goal) ? complete(next) : next;
	}
	return state;
}
