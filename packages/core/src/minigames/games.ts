import { createRng, shuffle, type Rng } from '../learning/rng.ts';
import { COLORS, type Color, type Difficulty } from '../types/colors.ts';
import type { ChoiceActivity, ChoiceOption, MiniGame } from './choiceMachine.ts';

/** Rounds are 5 activities, like Shape Matching and Numbers (spec 11). */
export const MINIGAME_ROUND_LENGTH = 5;

export interface MiniGameRound<D = unknown> {
	game: MiniGame;
	difficulty: Difficulty;
	seed: number;
	activities: ChoiceActivity<D>[];
}

const optionCount = (d: Difficulty) => (d === 'beginner' ? 2 : 3);
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** `count` distinct numbers in [min, max] that include `answer`, shuffled. */
function numberChoices(rng: Rng, answer: number, count: number, min: number, max: number): number[] {
	const others = shuffle(
		Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((n) => n !== answer),
		rng
	).slice(0, count - 1);
	return shuffle([answer, ...others], rng);
}

function colorChoices(rng: Rng, count: number): Color[] {
	return shuffle(COLORS, rng).slice(0, count);
}

function build<D>(
	game: MiniGame,
	difficulty: Difficulty,
	seed: number,
	make: (rng: Rng, index: number) => Omit<ChoiceActivity<D>, 'id' | 'game' | 'difficulty'>
): MiniGameRound<D> {
	const rng = createRng(seed);
	const activities = Array.from({ length: MINIGAME_ROUND_LENGTH }, (_, index) => ({
		id: `${game}.${difficulty}.${seed}.${index}`,
		game,
		difficulty,
		...make(rng, index)
	}));
	return { game, difficulty, seed, activities };
}

// ── Football: kick the ball into the named goal ─────────────────────────────
export type FootballData = { by: 'color' | 'number' };

export function createFootballRound(difficulty: Difficulty, seed: number): MiniGameRound<FootballData> {
	return build<FootballData>('football', difficulty, seed, (rng) => {
		if (difficulty === 'advanced') {
			const nums = numberChoices(rng, int(rng, 1, 5), 3, 1, 5);
			const answer = nums[int(rng, 0, nums.length - 1)]!;
			const options: ChoiceOption[] = nums.map((n) => ({ id: `goal-${n}`, number: n }));
			return {
				instructionKey: `football.to.number.${answer}`,
				correctKey: `football.goal.number.${answer}`,
				options,
				answerId: `goal-${answer}`,
				data: { by: 'number' }
			};
		}
		const colors = colorChoices(rng, optionCount(difficulty));
		const answer = colors[int(rng, 0, colors.length - 1)]!;
		return {
			instructionKey: `football.to.${answer}`,
			correctKey: `football.goal.${answer}`,
			options: colors.map((c) => ({ id: `goal-${c}`, color: c })),
			answerId: `goal-${answer}`,
			data: { by: 'color' }
		};
	});
}

// ── Garage: park the car in the matching garage ─────────────────────────────
export type GarageData = { by: 'color'; carColor: Color } | { by: 'count'; carColor: Color; passengers: number };

export function createGarageRound(difficulty: Difficulty, seed: number): MiniGameRound<GarageData> {
	return build<GarageData>('garage', difficulty, seed, (rng) => {
		if (difficulty === 'advanced') {
			const passengers = int(rng, 1, 5);
			const nums = numberChoices(rng, passengers, 3, 1, 5);
			const carColor = colorChoices(rng, 1)[0]!;
			return {
				instructionKey: 'car.park.count',
				correctKey: `car.parked.count.${passengers}`,
				options: nums.map((n) => ({ id: `garage-${n}`, number: n })),
				answerId: `garage-${passengers}`,
				data: { by: 'count', carColor, passengers }
			};
		}
		const colors = colorChoices(rng, optionCount(difficulty));
		const carColor = colors[int(rng, 0, colors.length - 1)]!;
		return {
			instructionKey: `car.park.${carColor}`,
			correctKey: `car.parked.${carColor}`,
			options: colors.map((c) => ({ id: `garage-${c}`, color: c })),
			answerId: `garage-${carColor}`,
			data: { by: 'color', carColor }
		};
	});
}

// ── Birds: how many birds are on the branch(es)? ────────────────────────────
export type BirdsData = { branches: number[]; color: Color };

export function createBirdsRound(difficulty: Difficulty, seed: number): MiniGameRound<BirdsData> {
	return build<BirdsData>('birds', difficulty, seed, (rng) => {
		const color = colorChoices(rng, 1)[0]!;
		let branches: number[];
		if (difficulty === 'advanced') {
			const a = int(rng, 1, 5);
			const b = int(rng, 1, Math.min(5, 10 - a));
			branches = [a, b];
		} else {
			branches = [int(rng, 1, difficulty === 'beginner' ? 5 : 10)];
		}
		const total = branches.reduce((s, n) => s + n, 0);
		const max = difficulty === 'beginner' ? 5 : 10;
		const nums = numberChoices(rng, total, optionCount(difficulty), 1, max);
		return {
			instructionKey: branches.length > 1 ? 'birds.add' : 'birds.count',
			correctKey: `birds.total.${total}`,
			options: nums.map((n) => ({ id: `answer-${n}`, number: n })),
			answerId: `answer-${total}`,
			data: { branches, color }
		};
	});
}

export function createMiniGameRound(game: MiniGame, difficulty: Difficulty, seed: number): MiniGameRound {
	if (game === 'football') return createFootballRound(difficulty, seed);
	if (game === 'garage') return createGarageRound(difficulty, seed);
	return createBirdsRound(difficulty, seed);
}
