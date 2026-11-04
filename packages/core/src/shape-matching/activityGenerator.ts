import { COLORS, type Difficulty } from '../types/colors.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import { SHAPES } from './shapes.ts';
import type { MatchItem, MatchMode } from './matchValidator.ts';

export interface MatchingActivity {
	id: string;
	mode: 'matching';
	difficulty: Difficulty;
	matchMode: MatchMode;
	instructionKey: string;
	expectedOutcome: string;
	sources: MatchItem[];
	targets: MatchItem[];
}

export function createMatchingActivity(seed: number, difficulty: Difficulty, mode?: MatchMode): MatchingActivity {
	const rng = createRng(seed);
	const matchMode = mode ?? (difficulty === 'advanced' ? 'both' : rng() < 0.5 ? 'color' : 'shape');
	const count = difficulty === 'beginner' ? 2 : 3;
	const colors = shuffle(COLORS, rng).slice(0, count);
	const shapes = shuffle(SHAPES, rng).slice(0, count);
	const targets: MatchItem[] = shapes.map((shape, i) => ({
		id: `target-${i}`, shape: matchMode === 'color' ? shapes[0]!.key : shape.key,
		color: matchMode === 'shape' ? colors[0]! : colors[i]!
	}));
	const sourceCount = difficulty === 'beginner' ? 1 : difficulty === 'explorer' ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
	const sources = shuffle(targets, rng).slice(0, sourceCount).map((target, i) => ({ ...target, id: `source-${i}` }));
	return {
		id: `matching.${difficulty}.${matchMode}.${seed}`, mode: 'matching', difficulty, matchMode,
		instructionKey: `match.instruction.${matchMode}`, expectedOutcome: 'matched',
		sources, targets: shuffle(targets, rng)
	};
}
