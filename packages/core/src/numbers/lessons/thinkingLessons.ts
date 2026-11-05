import { createRng, shuffle } from '../../learning/rng.ts';
import type { Color } from '../../types/colors.ts';

export type ThinkingAgeBand = '5-7' | '8-10';
export type ThinkingKind = 'odd-one-out' | 'sequence-memory' | 'number-pattern' | 'grid-path';
export type ThinkingShape = 'circle' | 'square' | 'triangle' | 'star';
export interface ThinkingToken { id: string; shape: ThinkingShape; color: Color }
export interface GridCell { row: number; column: number }
export type GridDirection = 'up' | 'down' | 'left' | 'right';
interface LessonBase { id: string; kind: ThinkingKind; ageBand: ThinkingAgeBand; instructionKey: string }
export interface ObservationLesson extends LessonBase {
	kind: 'odd-one-out'; attribute: 'shape' | 'quantity';
	options: { id: string; token: ThinkingToken; quantity: number }[]; answerId: string;
}
export interface MemoryLesson extends LessonBase { kind: 'sequence-memory'; sequence: ThinkingToken[]; options: ThinkingToken[] }
export interface PatternLesson extends LessonBase { kind: 'number-pattern'; sequence: number[]; step: number; options: { id: string; value: number }[]; answerId: string }
export interface PathLesson extends LessonBase { kind: 'grid-path'; size: number; start: GridCell; goal: GridCell; walls: GridCell[] }
export type ThinkingLesson = ObservationLesson | MemoryLesson | PatternLesson | PathLesson;
export const THINKING_KINDS: readonly ThinkingKind[] = ['odd-one-out', 'sequence-memory', 'number-pattern', 'grid-path'];
export const THINKING_DIRECTIONS: readonly GridDirection[] = ['up', 'down', 'left', 'right'];
const DELTAS: Record<GridDirection, GridCell> = { up: { row: -1, column: 0 }, down: { row: 1, column: 0 }, left: { row: 0, column: -1 }, right: { row: 0, column: 1 } };
export const sameCell = (a: GridCell, b: GridCell) => a.row === b.row && a.column === b.column;

export function moveOnGrid(lesson: PathLesson, from: GridCell, direction: GridDirection): GridCell | null {
	const delta = DELTAS[direction];
	const next = { row: from.row + delta.row, column: from.column + delta.column };
	return next.row < 0 || next.column < 0 || next.row >= lesson.size || next.column >= lesson.size || lesson.walls.some((wall) => sameCell(wall, next)) ? null : next;
}

/** Returns the shortest route, excluding the starting cell. No timer or step limit. */
export function findGridPath(lesson: PathLesson, from: GridCell = lesson.start): GridCell[] | null {
	const queue: { cell: GridCell; path: GridCell[] }[] = [{ cell: from, path: [] }];
	const visited = new Set<string>([`${from.row},${from.column}`]);
	for (let index = 0; index < queue.length; index++) {
		const entry = queue[index]!;
		if (sameCell(entry.cell, lesson.goal)) return entry.path;
		for (const direction of THINKING_DIRECTIONS) {
			const cell = moveOnGrid(lesson, entry.cell, direction);
			if (!cell || visited.has(`${cell.row},${cell.column}`)) continue;
			visited.add(`${cell.row},${cell.column}`); queue.push({ cell, path: [...entry.path, cell] });
		}
	}
	return null;
}

export function createThinkingLesson(kind: ThinkingKind, ageBand: ThinkingAgeBand, seed: number): ThinkingLesson {
	const rng = createRng(seed);
	const integer = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
	const older = ageBand === '8-10';
	const base = { id: `thinking.${ageBand}.${kind}.${seed}`, ageBand };
	const shapes = shuffle(['circle', 'square', 'triangle', 'star'] as ThinkingShape[], rng);
	const colors: Color[] = ['blue', 'green', 'orange'];
	const tokens = shapes.map((shape, i) => ({ id: `token-${i}`, shape, color: colors[i % colors.length]! }));
	if (kind === 'odd-one-out') {
		const attribute = rng() < 0.5 ? 'shape' : 'quantity';
		const count = older ? 6 : 4, answer = integer(0, count - 1), quantity = integer(older ? 3 : 1, older ? 5 : 3);
		const options = Array.from({ length: count }, (_, index) => ({
			id: `choice-${index}`, token: { ...tokens[attribute === 'shape' && index === answer ? 1 : 0]!, id: `item-${index}` },
			quantity: attribute === 'quantity' && index === answer ? quantity + (older ? 2 : 1) : attribute === 'shape' ? 1 : quantity
		}));
		return { ...base, kind, attribute, options, answerId: options[answer]!.id, instructionKey: `thinking.instruction.odd.${attribute}` };
	}
	if (kind === 'sequence-memory') {
		const options = tokens.slice(0, older ? 4 : 3);
		const sequence = Array.from({ length: older ? 5 : 3 }, () => options[integer(0, options.length - 1)]!);
		if (new Set(sequence.map((token) => token.id)).size < 2) sequence[sequence.length - 1] = options.find((token) => token.id !== sequence[0]!.id)!;
		return { ...base, kind, options: shuffle(options, rng), sequence, instructionKey: 'thinking.instruction.memory.observe' };
	}
	if (kind === 'number-pattern') {
		const step = older ? integer(2, 3) : integer(1, 2), start = integer(1, older ? 5 : 2);
		const sequence = Array.from({ length: 4 }, (_, index) => start + index * step), answer = start + 4 * step;
		const distractors = shuffle(Array.from({ length: older ? 20 : 10 }, (_, index) => index + 1).filter((value) => value !== answer), rng).slice(0, older ? 3 : 2);
		return { ...base, kind, sequence, step, options: shuffle([answer, ...distractors], rng).map((value) => ({ id: `number-${value}`, value })), answerId: `number-${answer}`, instructionKey: 'thinking.instruction.pattern' };
	}
	const size = older ? 4 : 3;
	const lesson: PathLesson = { ...base, kind, size, start: { row: size - 1, column: 0 }, goal: { row: 0, column: size - 1 }, walls: [], instructionKey: 'thinking.instruction.path' };
	const candidates = shuffle(Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), column: index % size })).filter((cell) => !sameCell(cell, lesson.start) && !sameCell(cell, lesson.goal)), rng);
	for (const candidate of candidates) {
		if (lesson.walls.length >= (older ? 5 : 2)) break;
		lesson.walls.push(candidate);
		if (!findGridPath(lesson)) lesson.walls.pop();
	}
	return lesson;
}

export function createThinkingRound(kind: ThinkingKind, ageBand: ThinkingAgeBand, seed: number): ThinkingLesson[] {
	const rng = createRng(seed);
	return Array.from({ length: 3 }, (_, index) => {
		const lesson = createThinkingLesson(kind, ageBand, Math.floor(rng() * 0x100000000));
		return { ...lesson, id: `${lesson.id}.${index}` };
	});
}

export interface ThinkingProgress {
	phase: 'observe' | 'play' | 'success'; attempts: number; hintsUsed: number; hintVisible: boolean;
	memoryIndex: number; position: GridCell; feedbackKey: string;
}
export type ThinkingAction = { type: 'ANSWER'; optionId: string } | { type: 'MOVE'; direction: GridDirection } | { type: 'REMEMBER' } | { type: 'HINT' } | { type: 'RESET' };
export function initialThinkingProgress(lesson: ThinkingLesson): ThinkingProgress {
	return { phase: lesson.kind === 'sequence-memory' ? 'observe' : 'play', attempts: 0, hintsUsed: 0, hintVisible: false, memoryIndex: 0,
		position: lesson.kind === 'grid-path' ? { ...lesson.start } : { row: 0, column: 0 }, feedbackKey: lesson.instructionKey };
}

export function thinkingReducer(lesson: ThinkingLesson, state: ThinkingProgress, action: ThinkingAction): ThinkingProgress {
	if (action.type === 'RESET') return initialThinkingProgress(lesson);
	if (action.type === 'REMEMBER') return lesson.kind === 'sequence-memory' && state.phase === 'observe' ? { ...state, phase: 'play', feedbackKey: 'thinking.instruction.memory.recall' } : state;
	if (state.phase !== 'play') return state;
	if (action.type === 'HINT') return state.attempts >= 2 && !state.hintVisible ? { ...state, hintsUsed: state.hintsUsed + 1, hintVisible: true, feedbackKey: 'thinking.hint' } : state;
	if (action.type === 'MOVE' && lesson.kind === 'grid-path') {
		const next = moveOnGrid(lesson, state.position, action.direction);
		if (!next) return { ...state, attempts: state.attempts + 1, feedbackKey: 'thinking.blocked' };
		const success = sameCell(next, lesson.goal);
		return { ...state, position: next, hintVisible: false, phase: success ? 'success' : 'play', feedbackKey: success ? 'thinking.success' : 'thinking.step' };
	}
	if (action.type !== 'ANSWER' || lesson.kind === 'grid-path' || !lesson.options.some((option) => option.id === action.optionId)) return state;
	const answerId = lesson.kind === 'sequence-memory' ? lesson.sequence[state.memoryIndex]!.id : lesson.answerId;
	if (action.optionId !== answerId) return { ...state, attempts: state.attempts + 1, hintVisible: false, feedbackKey: 'thinking.retry' };
	const memoryIndex = lesson.kind === 'sequence-memory' ? state.memoryIndex + 1 : state.memoryIndex;
	const success = lesson.kind !== 'sequence-memory' || memoryIndex === lesson.sequence.length;
	return { ...state, memoryIndex, hintVisible: false, phase: success ? 'success' : 'play', feedbackKey: success ? 'thinking.success' : 'thinking.step' };
}

export function thinkingHint(lesson: ThinkingLesson, state: ThinkingProgress) {
	if (lesson.kind === 'grid-path') return { kind: lesson.kind, cell: findGridPath(lesson, state.position)?.[0] ?? null } as const;
	if (lesson.kind === 'sequence-memory') return { kind: lesson.kind, token: lesson.sequence[state.memoryIndex] ?? null } as const;
	if (lesson.kind === 'number-pattern') return { kind: lesson.kind, step: lesson.step } as const;
	return { kind: lesson.kind, attribute: lesson.attribute } as const;
}
