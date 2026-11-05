import { describe, expect, it } from 'vitest';
import { createPicnicAdventure, initialPicnicProgress, picnicReducer, PICNIC_CHAPTERS, type PicnicAdventure, type PicnicProgress } from '../../src/numbers/lessons/picnicAdventure.ts';
import { findGridPath, moveOnGrid, sameCell, THINKING_DIRECTIONS, type ThinkingAgeBand, type ThinkingAction } from '../../src/numbers/lessons/thinkingLessons.ts';
import { PICNIC_NARRATION } from '../../src/numbers/lessons/picnicNarration.ts';
import { getNarration } from '../../src/audio/catalog.ts';

function solveStage(plan: PicnicAdventure, state: PicnicProgress): PicnicProgress {
	let next = picnicReducer(plan, state, { type: 'BEGIN' });
	const lesson = plan.stages[next.stageIndex]!.lesson;
	const play = (action: ThinkingAction) => { next = picnicReducer(plan, next, { type: 'PLAY', action }); };
	if (lesson.kind === 'odd-one-out' || lesson.kind === 'number-pattern') play({ type: 'ANSWER', optionId: lesson.answerId });
	else if (lesson.kind === 'sequence-memory') {
		play({ type: 'REMEMBER' });
		for (const token of lesson.sequence) play({ type: 'ANSWER', optionId: token.id });
	} else {
		for (const cell of findGridPath(lesson)!) {
			const direction = THINKING_DIRECTIONS.find((direction) => { const target = moveOnGrid(lesson, next.lessonProgress.position, direction); return target && sameCell(target, cell); })!;
			play({ type: 'MOVE', direction });
		}
	}
	return next;
}

describe('picnic story and lesson generation', () => {
	it.each(['5-7', '8-10'] as ThinkingAgeBand[])('%s: deterministic four-chapter adventures with coherent pictures and valid narration over 1,000 seeds', (ageBand) => {
		for (let seed = 0; seed < 1000; seed++) {
			const plan = createPicnicAdventure(ageBand, seed);
			expect(createPicnicAdventure(ageBand, seed)).toEqual(plan);
			expect(plan.stages.map((stage) => stage.id)).toEqual(PICNIC_CHAPTERS);
			expect(new Set(plan.stages.map((stage) => stage.lesson.id)).size).toBe(4);
			expect(plan.stages.map((stage) => stage.lesson.kind)).toEqual(['odd-one-out', 'sequence-memory', 'number-pattern', 'grid-path']);
			for (const stage of plan.stages) {
				for (const key of [stage.titleKey, stage.storyKey, stage.successKey, stage.lesson.instructionKey]) expect(getNarration(key), key).toBeDefined();
				const lesson = stage.lesson;
				if (lesson.kind === 'odd-one-out') {
					const groups = new Map<string, string[]>();
					for (const option of lesson.options) {
						const attribute = ageBand === '5-7' ? option.token.picture! : String(option.quantity);
						groups.set(attribute, [...(groups.get(attribute) ?? []), option.id]);
					}
					expect([...groups.values()].filter((group) => group.length === 1)).toEqual([[lesson.answerId]]);
				} else if (lesson.kind === 'sequence-memory') {
					expect(new Set(lesson.options.map((token) => token.picture)).size).toBe(lesson.options.length);
					for (const token of lesson.sequence) expect(lesson.options).toContainEqual(token);
				} else if (lesson.kind === 'grid-path') expect(findGridPath(lesson)?.length).toBeGreaterThan(0);
			}
		}
	}, 60_000);
	it('registers unique bilingual placeholder story lines without changing the narration contract', () => {
		expect(new Set(PICNIC_NARRATION.map((entry) => entry.key)).size).toBe(PICNIC_NARRATION.length);
		for (const entry of PICNIC_NARRATION) { expect(getNarration(entry.key)).toEqual(entry); expect(entry.bn).toBeTruthy(); expect(entry.en).toBeTruthy(); expect(entry.status).toBe('placeholder'); }
	});
});

describe('child-controlled picnic progression', () => {
	it.each(['5-7', '8-10'] as ThinkingAgeBand[])('%s completes in order and only reveals packed items/bridge after solving', (ageBand) => {
		const plan = createPicnicAdventure(ageBand, 112);
		let state = initialPicnicProgress(plan);
		for (let index = 0; index < 4; index++) {
			expect(state.phase).toBe('intro'); expect(state.stageIndex).toBe(index);
			expect(state.completedChapters).toEqual(PICNIC_CHAPTERS.slice(0, index));
			expect(picnicReducer(plan, state, { type: 'NEXT' })).toBe(state);
			expect(picnicReducer(plan, state, { type: 'PLAY', action: { type: 'ANSWER', optionId: 'unknown' } })).toBe(state);
			state = solveStage(plan, state);
			expect(state.phase).toBe('chapter-complete'); expect(state.stageIndex).toBe(index);
			expect(state.completedChapters).toEqual(PICNIC_CHAPTERS.slice(0, index + 1));
			expect(picnicReducer(plan, state, { type: 'PLAY', action: { type: 'RESET' } })).toBe(state);
			if (index === 2) {
				const lesson = plan.stages[2]!.lesson;
				if (lesson.kind !== 'number-pattern') throw new Error('wrong stage');
				expect(state.bridgeNumber).toBe(lesson.options.find((option) => option.id === lesson.answerId)!.value);
			}
			state = picnicReducer(plan, state, { type: 'NEXT' });
		}
		expect(state.phase).toBe('finished'); expect(state.completedChapters).toEqual(PICNIC_CHAPTERS);
		expect(picnicReducer(plan, state, { type: 'NEXT' })).toBe(state);
		expect(picnicReducer(plan, state, { type: 'BEGIN' })).toBe(state);
		expect(picnicReducer(plan, state, { type: 'RESTART' })).toEqual(initialPicnicProgress(plan));
	});
	it('wrong choices and hints cannot unlock the next chapter or pack food automatically', () => {
		const plan = createPicnicAdventure('5-7', 42);
		const lesson = plan.stages[0]!.lesson;
		if (lesson.kind !== 'odd-one-out') throw new Error('wrong stage');
		let state = picnicReducer(plan, initialPicnicProgress(plan), { type: 'BEGIN' });
		expect(picnicReducer(plan, state, { type: 'BEGIN' })).toBe(state);
		const wrong = lesson.options.find((option) => option.id !== lesson.answerId)!.id;
		for (let i = 0; i < 2; i++) state = picnicReducer(plan, state, { type: 'PLAY', action: { type: 'ANSWER', optionId: wrong } });
		state = picnicReducer(plan, state, { type: 'PLAY', action: { type: 'HINT' } });
		expect(state.phase).toBe('playing'); expect(state.lessonProgress.hintVisible).toBe(true); expect(state.completedChapters).toEqual([]);
		expect(picnicReducer(plan, state, { type: 'NEXT' })).toBe(state);
	});
	it('resetting the recall lesson preserves the packed basket but clears current recall and hints', () => {
		const plan = createPicnicAdventure('8-10', 8);
		let state = solveStage(plan, initialPicnicProgress(plan));
		state = picnicReducer(plan, state, { type: 'NEXT' });
		state = picnicReducer(plan, state, { type: 'BEGIN' });
		state = picnicReducer(plan, state, { type: 'PLAY', action: { type: 'REMEMBER' } });
		expect(state.lessonProgress.feedbackKey).toBe('picnic.instruction.memory.recall');
		state = picnicReducer(plan, state, { type: 'PLAY', action: { type: 'RESET' } });
		expect(state.completedChapters).toEqual(['pack']); expect(state.stageIndex).toBe(1);
		expect(state.lessonProgress.phase).toBe('observe'); expect(state.lessonProgress.memoryIndex).toBe(0); expect(state.bridgeNumber).toBeNull();
	});
	it('does not mutate the adventure or prior progress while solving', () => {
		const plan = createPicnicAdventure('5-7', 4), original = JSON.stringify(plan);
		const state = initialPicnicProgress(plan), before = JSON.stringify(state);
		solveStage(plan, state);
		expect(JSON.stringify(plan)).toBe(original); expect(JSON.stringify(state)).toBe(before);
	});
});
