import type { Difficulty } from '../types/colors.ts';
import { createRng } from '../learning/rng.ts';
import { createMatchingActivity, type MatchingActivity } from './activityGenerator.ts';

export interface MatchingRound { mode: 'matching'; difficulty: Difficulty; seed: number; activities: MatchingActivity[] }
export function createMatchingRound(difficulty: Difficulty, seed: number): MatchingRound {
	const rng = createRng(seed);
	return { mode: 'matching', difficulty, seed, activities: Array.from({ length: 5 }, (_, index) => {
		const activity = createMatchingActivity(Math.floor(rng() * 0x100000000), difficulty,
			difficulty === 'advanced' ? 'both' : difficulty === 'beginner' ? index % 2 === 0 ? 'color' : 'shape' : undefined);
		return { ...activity, id: `${activity.id}.${index}` };
	}) };
}
