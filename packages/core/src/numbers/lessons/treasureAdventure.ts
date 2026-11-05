import { createRng, shuffle } from '../../learning/rng.ts';
import type { ThinkingAgeBand, ThinkingToken } from './thinkingLessons.ts';
import { createPlaygroundStamp, playgroundTokenKey } from './creativePlayground.ts';

export const TREASURE_STAGES = ['clues', 'memory', 'sort', 'pattern'] as const;
export interface TreasurePlan {
	ageBand: ThinkingAgeBand; seed: number;
	objects: ThinkingToken[]; clues: ThinkingToken[];
	spots: (ThinkingToken | null)[]; remembered: ThinkingToken[];
	sorting: ThinkingToken[]; sortShape: ThinkingToken['shape'];
	sequence: ThinkingToken[]; options: ThinkingToken[]; answer: ThinkingToken;
}
export interface TreasureProgress {
	phase: 'intro' | 'observe' | 'play' | 'complete' | 'chest' | 'finished';
	stage: number; found: number; selected: string[]; keys: number;
	hint: boolean; feedbackKey: string;
}
export type TreasureAction = { type: 'BEGIN' } | { type: 'HIDE' } | { type: 'PEEK' } |
	{ type: 'PICK'; id: string } | { type: 'SPOT'; cell: number } |
	{ type: 'NEXT' } | { type: 'RESET' } | { type: 'HINT' } | { type: 'OPEN' };

export function createTreasureAdventure(ageBand: ThinkingAgeBand, seed: number): TreasurePlan {
	const rng = createRng(seed), older = ageBand === '8-10';
	const objects = shuffle(['circle', 'square', 'triangle', 'star'].flatMap((shape) =>
		['blue', 'green', 'orange'].map((color) => createPlaygroundStamp(shape as ThinkingToken['shape'], color as ThinkingToken['color']))), rng).slice(0, older ? 9 : 6);
	const clues = shuffle(objects, rng).slice(0, older ? 3 : 2);
	const remembered = shuffle(['apple', 'bottle', 'sandwich'].map((kind) => createPlaygroundStamp(kind as 'apple' | 'bottle' | 'sandwich')), rng).slice(0, older ? 3 : 2);
	const locations = shuffle(Array.from({ length: 6 }, (_, i) => i), rng);
	const spots = Array.from({ length: 6 }, (_, cell) => remembered[locations.indexOf(cell)] ?? null);
	const sortShape = shuffle(['circle', 'star', 'triangle'] as const, rng)[0]!;
	const sorting = shuffle(['blue', 'orange', 'green'].flatMap((color) => [sortShape, sortShape === 'star' ? 'square' : 'star'].map((shape) => createPlaygroundStamp(shape as ThinkingToken['shape'], color as ThinkingToken['color']))), rng);
	const [a, b] = shuffle(objects, rng);
	const unit = older ? [a!, a!, b!] : [a!, b!];
	const full = [...unit, ...unit, ...unit];
	const sequence = full.slice(0, older ? 7 : 5), answer = full[sequence.length]!;
	return { ageBand, seed, objects, clues, spots, remembered, sorting, sortShape, sequence, answer,
		options: shuffle([a!, b!, objects.find((t) => t.id !== a!.id && t.id !== b!.id)!], rng) };
}

export function initialTreasureProgress(): TreasureProgress {
	return { phase: 'intro', stage: 0, found: 0, selected: [], keys: 0, hint: false, feedbackKey: 'treasure.story.clues' };
}
const complete = (state: TreasureProgress): TreasureProgress => ({ ...state, phase: 'complete', keys: state.keys + 1, hint: false, feedbackKey: 'treasure.complete' });
export function treasureReducer(plan: TreasurePlan, state: TreasureProgress, action: TreasureAction): TreasureProgress {
	if (action.type === 'BEGIN') return state.phase === 'intro' ? { ...state, phase: state.stage === 1 ? 'observe' : 'play', feedbackKey: `treasure.instruction.${TREASURE_STAGES[state.stage]}` } : state;
	if (action.type === 'NEXT') return state.phase !== 'complete' ? state : state.stage === 3
		? { ...state, phase: 'chest', feedbackKey: 'treasure.chest.ready' }
		: { ...state, phase: 'intro', stage: state.stage + 1, found: 0, selected: [], hint: false, feedbackKey: `treasure.story.${TREASURE_STAGES[state.stage + 1]}` };
	if (action.type === 'OPEN') return state.phase === 'chest' && state.keys === 4 ? { ...state, phase: 'finished', feedbackKey: 'treasure.surprise' } : state;
	if (action.type === 'RESET') return state.phase === 'play' || state.phase === 'observe'
		? { ...state, phase: state.stage === 1 ? 'observe' : 'play', found: 0, selected: [], hint: false, feedbackKey: `treasure.instruction.${TREASURE_STAGES[state.stage]}` } : state;
	if (action.type === 'PEEK') return state.stage === 1 && state.phase === 'play' ? { ...state, phase: 'observe', hint: false, feedbackKey: 'treasure.instruction.memory' } : state;
	if (action.type === 'HIDE') return state.phase === 'observe' ? { ...state, phase: 'play', feedbackKey: 'treasure.memory.find' } : state;
	if (state.phase !== 'play') return state;
	if (action.type === 'HINT') return { ...state, hint: true, feedbackKey: `treasure.hint.${TREASURE_STAGES[state.stage]}` };
	let correct = false;
	if (action.type === 'SPOT' && state.stage === 1) {
		const token = plan.spots[action.cell];
		if (!Number.isInteger(action.cell) || !token || token.id !== plan.remembered[state.found]?.id) return { ...state, feedbackKey: 'treasure.retry' };
		correct = true;
	} else if (action.type === 'PICK') {
		if (state.stage === 0) correct = action.id === plan.clues[state.found]?.id;
		else if (state.stage === 2) {
			const token = plan.sorting.find((item) => item.id === action.id);
			if (state.selected.includes(action.id)) return state;
			correct = token?.shape === plan.sortShape;
		} else if (state.stage === 3) correct = action.id === plan.answer.id;
		else return state;
	} else return state;
	if (!correct) return { ...state, feedbackKey: 'treasure.retry' };
	const found = state.found + 1;
	const next = { ...state, found, hint: false, selected: action.type === 'PICK' ? [...state.selected, action.id] : state.selected, feedbackKey: 'treasure.found' };
	const total = state.stage === 0 ? plan.clues.length : state.stage === 1 ? plan.remembered.length : state.stage === 2 ? plan.sorting.filter((t) => t.shape === plan.sortShape).length : 1;
	return found === total ? complete(next) : next;
}

/** Visible clue and optional visual hint; no answer is exposed on hidden memory cells. */
export function treasureTarget(plan: TreasurePlan, state: TreasureProgress): ThinkingToken | undefined {
	return state.stage === 0 ? plan.clues[state.found] : state.stage === 1 ? plan.remembered[state.found] : undefined;
}
export { playgroundTokenKey as treasureTokenKey };
