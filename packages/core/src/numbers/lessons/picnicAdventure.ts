import { createRng } from '../../learning/rng.ts';
import {
	createThinkingLesson, initialThinkingProgress, thinkingReducer,
	type ThinkingAgeBand, type ThinkingKind, type ThinkingLesson, type ThinkingProgress, type ThinkingAction, type PicnicPicture
} from './thinkingLessons.ts';

export const PICNIC_CHAPTERS = ['pack', 'remember', 'bridge', 'path'] as const;
export type PicnicChapter = (typeof PICNIC_CHAPTERS)[number];
export interface PicnicStage { id: PicnicChapter; titleKey: string; storyKey: string; successKey: string; lesson: ThinkingLesson }
export interface PicnicAdventure { ageBand: ThinkingAgeBand; seed: number; stages: PicnicStage[] }
export interface PicnicProgress {
	phase: 'intro' | 'playing' | 'chapter-complete' | 'finished';
	stageIndex: number;
	completedChapters: PicnicChapter[];
	lessonProgress: ThinkingProgress;
	bridgeNumber: number | null;
}
export type PicnicAction = { type: 'BEGIN' } | { type: 'NEXT' } | { type: 'RESTART' } | { type: 'PLAY'; action: ThinkingAction };

export function createPicnicAdventure(ageBand: ThinkingAgeBand, seed: number): PicnicAdventure {
	const rng = createRng(seed);
	const kinds: ThinkingKind[] = ['odd-one-out', 'sequence-memory', 'number-pattern', 'grid-path'];
	const stages = PICNIC_CHAPTERS.map((id, index): PicnicStage => {
		const lesson = createThinkingLesson(kinds[index]!, ageBand, Math.floor(rng() * 0x100000000));
		lesson.id = `picnic.${ageBand}.${seed}.${id}`;
		if (lesson.kind === 'odd-one-out') {
			if (ageBand === '5-7') {
				lesson.attribute = 'shape';
				lesson.options = lesson.options.map((option) => ({ ...option, quantity: 1,
					token: { ...option.token, shape: option.id === lesson.answerId ? 'square' : 'circle', picture: option.id === lesson.answerId ? 'sock' : 'apple' }
				}));
				lesson.instructionKey = 'picnic.instruction.pack.sock';
			} else {
				const quantity = 3 + Math.floor(rng() * 3);
				lesson.attribute = 'quantity';
				lesson.options = lesson.options.map((option) => ({ ...option, quantity: option.id === lesson.answerId ? quantity + 2 : quantity, token: { ...option.token, shape: 'circle', picture: 'apple' } }));
				lesson.instructionKey = 'picnic.instruction.pack.count';
			}
		} else if (lesson.kind === 'sequence-memory') {
			const pictures: PicnicPicture[] = ['apple', 'sandwich', 'bottle', 'napkin'];
			const byId = new Map(lesson.options.map((token, i) => [token.id, { ...token, picture: pictures[i]! }]));
			lesson.options = lesson.options.map((token) => byId.get(token.id)!);
			lesson.sequence = lesson.sequence.map((token) => byId.get(token.id)!);
			lesson.instructionKey = 'picnic.instruction.memory.observe';
		} else lesson.instructionKey = `picnic.instruction.${id}`;
		return { id, lesson, titleKey: `picnic.chapter.${id}`, storyKey: `picnic.story.${id}`, successKey: id === 'pack' && ageBand === '8-10' ? 'picnic.success.pack.count' : `picnic.success.${id}` };
	});
	return { ageBand, seed, stages };
}

export function initialPicnicProgress(adventure: PicnicAdventure): PicnicProgress {
	return { phase: 'intro', stageIndex: 0, completedChapters: [], lessonProgress: initialThinkingProgress(adventure.stages[0]!.lesson), bridgeNumber: null };
}

/** Adventure progression is driven entirely by child input, never audio/timers. */
export function picnicReducer(adventure: PicnicAdventure, state: PicnicProgress, action: PicnicAction): PicnicProgress {
	if (action.type === 'RESTART') return initialPicnicProgress(adventure);
	if (action.type === 'BEGIN') return state.phase === 'intro' ? { ...state, phase: 'playing' } : state;
	if (action.type === 'NEXT') {
		if (state.phase !== 'chapter-complete') return state;
		const stageIndex = state.stageIndex + 1;
		return stageIndex === adventure.stages.length ? { ...state, phase: 'finished' }
			: { ...state, stageIndex, phase: 'intro', lessonProgress: initialThinkingProgress(adventure.stages[stageIndex]!.lesson) };
	}
	if (action.type !== 'PLAY' || state.phase !== 'playing') return state;
	const stage = adventure.stages[state.stageIndex]!;
	const result = thinkingReducer(stage.lesson, state.lessonProgress, action.action);
	if (result === state.lessonProgress) return state;
	const progress = action.action.type === 'REMEMBER' ? { ...result, feedbackKey: 'picnic.instruction.memory.recall' } : result;
	if (progress.phase !== 'success') return { ...state, lessonProgress: progress };
	const lesson = stage.lesson;
	const bridgeNumber = lesson.kind === 'number-pattern' ? lesson.options.find((option) => option.id === lesson.answerId)!.value : state.bridgeNumber;
	return { ...state, lessonProgress: progress, bridgeNumber, phase: 'chapter-complete', completedChapters: [...state.completedChapters, stage.id] };
}
