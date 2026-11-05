import type { Color } from '../../types/colors.ts';
import type { GridDirection, ThinkingAgeBand, ThinkingToken, PicnicPicture, ThinkingShape } from './thinkingLessons.ts';

export const PLAYGROUND_SIZE = 4;
export const PLAYGROUND_COLORS: readonly Color[] = ['blue', 'green', 'orange'];
export const PLAYGROUND_FOODS: readonly PicnicPicture[] = ['apple', 'sandwich', 'bottle', 'napkin'];
export const PLAYGROUND_SHAPES: readonly ThinkingShape[] = ['circle', 'square', 'triangle', 'star'];
export type PlaygroundStampKind = ThinkingShape | PicnicPicture;
export interface PlaygroundItem { id: string; token: ThinkingToken; cell: number; rotation: number }
interface BoardSnapshot { items: PlaygroundItem[]; selectedId: string | null }
export interface PlaygroundPattern {
	phase: 'build' | 'copy' | 'matched'; who: 'rumi' | 'together';
	source: ThinkingToken[]; copy: ThinkingToken[];
}
export interface CreativePlaygroundState {
	items: PlaygroundItem[]; selectedId: string | null; stamp: ThinkingToken | null;
	nextId: number; history: BoardSnapshot[]; pattern: PlaygroundPattern; feedbackKey: string;
}
export type PlaygroundAction =
	| { type: 'CHOOSE'; token: ThinkingToken } | { type: 'PLACE'; cell: number }
	| { type: 'SELECT'; id: string } | { type: 'MOVE'; id: string; cell: number }
	| { type: 'NUDGE'; direction: GridDirection } | { type: 'ROTATE' } | { type: 'REMOVE' }
	| { type: 'UNDO' } | { type: 'CLEAR' } | { type: 'TEMPLATE'; name: 'flower' | 'cat' }
	| { type: 'PATTERN_ADD' } | { type: 'PATTERN_REMOVE'; index: number }
	| { type: 'PATTERN_START'; who: 'rumi' | 'together' } | { type: 'PATTERN_COPY' }
	| { type: 'RUMI_NEXT' } | { type: 'PATTERN_EDIT' } | { type: 'PATTERN_CLEAR' };

const cloneItems = (items: PlaygroundItem[]) => items.map((item) => ({ ...item, token: { ...item.token } }));
const validCell = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < PLAYGROUND_SIZE * PLAYGROUND_SIZE;
export const playgroundTokenKey = (token: ThinkingToken) => token.picture ? `food.${token.picture}` : `${token.shape}.${token.color}`;
export const playgroundPatternLimit = (ageBand: ThinkingAgeBand) => ageBand === '5-7' ? 4 : 6;

export function createPlaygroundStamp(kind: PlaygroundStampKind, color: Color = 'blue'): ThinkingToken {
	if (PLAYGROUND_SHAPES.includes(kind as ThinkingShape)) return { id: `${kind}.${color}`, shape: kind as ThinkingShape, color };
	const shapes: Record<PicnicPicture, ThinkingShape> = { apple: 'circle', sandwich: 'triangle', bottle: 'square', napkin: 'square', sock: 'star' };
	return { id: `food.${kind}`, picture: kind as PicnicPicture, shape: shapes[kind as PicnicPicture], color: kind === 'apple' || kind === 'napkin' ? 'green' : kind === 'sandwich' ? 'orange' : 'blue' };
}

export function initialCreativePlayground(): CreativePlaygroundState {
	return { items: [], selectedId: null, stamp: null, nextId: 1, history: [], pattern: { phase: 'build', who: 'together', source: [], copy: [] }, feedbackKey: 'playground.instruction' };
}

export function playgroundNeighbor(cell: number, direction: GridDirection): number | null {
	if (!validCell(cell)) return null;
	const row = Math.floor(cell / PLAYGROUND_SIZE), column = cell % PLAYGROUND_SIZE;
	if (direction === 'up') return row > 0 ? cell - PLAYGROUND_SIZE : null;
	if (direction === 'down') return row < PLAYGROUND_SIZE - 1 ? cell + PLAYGROUND_SIZE : null;
	if (direction === 'left') return column > 0 ? cell - 1 : null;
	return column < PLAYGROUND_SIZE - 1 ? cell + 1 : null;
}

function editBoard(state: CreativePlaygroundState, items: PlaygroundItem[], selectedId: string | null, feedbackKey: string): CreativePlaygroundState {
	return { ...state, items, selectedId, feedbackKey, history: [...state.history.slice(-49), { items: cloneItems(state.items), selectedId: state.selectedId }] };
}
const selectedToken = (state: CreativePlaygroundState) => state.stamp ?? state.items.find((item) => item.id === state.selectedId)?.token;

/** Pure creative actions: no scoring, timer, automatic placement, or destructive overwrite. */
export function creativePlaygroundReducer(state: CreativePlaygroundState, action: PlaygroundAction, ageBand: ThinkingAgeBand): CreativePlaygroundState {
	if (action.type === 'CHOOSE') return { ...state, stamp: { ...action.token }, selectedId: null, feedbackKey: 'playground.place' };
	if (action.type === 'SELECT') return state.items.some((item) => item.id === action.id) ? { ...state, stamp: null, selectedId: action.id, feedbackKey: 'playground.move' } : state;
	if (action.type === 'PLACE') {
		if (!state.stamp || !validCell(action.cell)) return state;
		if (state.items.some((item) => item.cell === action.cell)) return { ...state, feedbackKey: 'playground.occupied' };
		const id = `creation-${state.nextId}`;
		return { ...editBoard(state, [...state.items, { id, token: { ...state.stamp }, cell: action.cell, rotation: 0 }], id, 'playground.placed'), stamp: null, nextId: state.nextId + 1 };
	}
	if (action.type === 'NUDGE') {
		const item = state.items.find((item) => item.id === state.selectedId);
		const cell = item && playgroundNeighbor(item.cell, action.direction);
		return item && cell !== null && cell !== undefined ? creativePlaygroundReducer(state, { type: 'MOVE', id: item.id, cell }, ageBand) : state;
	}
	if (action.type === 'MOVE') {
		const item = state.items.find((item) => item.id === action.id);
		if (!item || !validCell(action.cell) || item.cell === action.cell) return state;
		const occupant = state.items.find((other) => other.cell === action.cell);
		const items = state.items.map((other) => other.id === item.id ? { ...other, cell: action.cell } : other.id === occupant?.id ? { ...other, cell: item.cell } : other);
		return { ...editBoard(state, items, item.id, 'playground.moved'), stamp: null };
	}
	if (action.type === 'ROTATE' || action.type === 'REMOVE') {
		if (!state.selectedId || !state.items.some((item) => item.id === state.selectedId)) return state;
		const items = action.type === 'REMOVE' ? state.items.filter((item) => item.id !== state.selectedId) : state.items.map((item) => item.id === state.selectedId ? { ...item, rotation: (item.rotation + 90) % 360 } : item);
		return editBoard(state, items, action.type === 'REMOVE' ? null : state.selectedId, action.type === 'REMOVE' ? 'playground.removed' : 'playground.turned');
	}
	if (action.type === 'UNDO') {
		const snapshot = state.history[state.history.length - 1];
		return snapshot ? { ...state, items: cloneItems(snapshot.items), selectedId: snapshot.selectedId, stamp: null, history: state.history.slice(0, -1), feedbackKey: 'playground.undone' } : state;
	}
	if (action.type === 'CLEAR') return state.items.length ? { ...editBoard(state, [], null, 'playground.cleared'), stamp: null } : state;
	if (action.type === 'TEMPLATE') {
		const entries: [number, ThinkingShape, Color][] = action.name === 'flower'
			? [[1, 'circle', 'orange'], [4, 'circle', 'orange'], [5, 'circle', 'blue'], [6, 'circle', 'orange'], [9, 'square', 'green'], [8, 'triangle', 'green'], [10, 'triangle', 'green'], [13, 'square', 'green']]
			: [[0, 'triangle', 'orange'], [2, 'triangle', 'orange'], [5, 'circle', 'orange'], [9, 'square', 'orange'], [12, 'circle', 'blue'], [14, 'circle', 'blue'], [11, 'triangle', 'green']];
		const items = entries.map(([cell, shape, color], index) => ({ id: `creation-${state.nextId + index}`, cell, token: createPlaygroundStamp(shape, color), rotation: 0 }));
		return { ...editBoard(state, items, null, `playground.idea.${action.name}`), nextId: state.nextId + items.length, stamp: null };
	}
	const pattern = state.pattern;
	if (action.type === 'PATTERN_ADD') {
		const token = selectedToken(state);
		return pattern.phase === 'build' && token && pattern.source.length < playgroundPatternLimit(ageBand)
			? { ...state, pattern: { ...pattern, source: [...pattern.source, { ...token }] }, feedbackKey: 'playground.pattern.added' } : state;
	}
	if (action.type === 'PATTERN_REMOVE') return pattern.phase === 'build' && Number.isInteger(action.index) && action.index >= 0 && action.index < pattern.source.length
		? { ...state, pattern: { ...pattern, source: pattern.source.filter((_, index) => index !== action.index) }, feedbackKey: 'playground.pattern.removed' } : state;
	if (action.type === 'PATTERN_START') return pattern.phase === 'build' && pattern.source.length >= 2
		? { ...state, pattern: { ...pattern, phase: 'copy', who: action.who, copy: [] }, feedbackKey: action.who === 'rumi' ? 'playground.pattern.rumi.turn' : 'playground.pattern.your.turn' } : state;
	if (action.type === 'PATTERN_COPY' || action.type === 'RUMI_NEXT') {
		if (pattern.phase !== 'copy' || (action.type === 'RUMI_NEXT') !== (pattern.who === 'rumi')) return state;
		const expected = pattern.source[pattern.copy.length]!;
		const token = action.type === 'RUMI_NEXT' ? expected : selectedToken(state);
		if (!token) return state;
		if (playgroundTokenKey(token) !== playgroundTokenKey(expected)) return { ...state, feedbackKey: 'playground.pattern.retry' };
		const copy = [...pattern.copy, { ...token }];
		return { ...state, pattern: { ...pattern, copy, phase: copy.length === pattern.source.length ? 'matched' : 'copy' }, feedbackKey: copy.length === pattern.source.length ? 'playground.pattern.matched' : 'playground.pattern.step' };
	}
	if (action.type === 'PATTERN_EDIT') return { ...state, pattern: { ...pattern, phase: 'build', copy: [] }, feedbackKey: 'playground.pattern.instruction' };
	if (action.type === 'PATTERN_CLEAR') return { ...state, pattern: { phase: 'build', who: 'together', source: [], copy: [] }, feedbackKey: 'playground.pattern.instruction' };
	return state;
}
