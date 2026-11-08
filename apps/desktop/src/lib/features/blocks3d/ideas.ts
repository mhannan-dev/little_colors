import { HEIGHT, PALETTE, SIZE, columnTop, isLockedColumn, key, type Block, type Cell } from './blocks.ts';

/**
 * "Give me an idea" (💡): a faint shadow of a small build appears on the mat and the child
 * fills it in. There is no right or wrong (blocks outside the shadow are fine) and no score.
 * Every idea is made of full columns standing on the ground, because a tap always stacks on
 * top of a column, so every shadow block can be reached.
 */
export type IdeaId = 'tower' | 'steps' | 'tree' | 'house' | 'count' | 'yard';

const C = {
	coral: PALETTE[0].hex, orange: PALETTE[1].hex, yellow: PALETTE[2].hex, green: PALETTE[3].hex,
	blue: PALETTE[4].hex, purple: PALETTE[5].hex, cream: PALETTE[6].hex, brown: PALETTE[7].hex
};

type Column = { x: number; z: number; colors: string[] };

const IDEAS: Record<IdeaId, Column[]> = {
	tower: [{ x: 0, z: 0, colors: [C.coral, C.orange, C.yellow, C.green] }],
	steps: [
		{ x: 0, z: 0, colors: [C.orange] },
		{ x: 1, z: 0, colors: [C.yellow, C.yellow] },
		{ x: 2, z: 0, colors: [C.green, C.green, C.green] }
	],
	tree: [
		{ x: 1, z: 1, colors: [C.brown, C.brown, C.green, C.green] },
		{ x: 0, z: 1, colors: [C.green] },
		{ x: 2, z: 1, colors: [C.green] },
		{ x: 1, z: 0, colors: [C.green] },
		{ x: 1, z: 2, colors: [C.green] }
	],
	house: [0, 1].flatMap((x) => [0, 1].map((z) => ({ x, z, colors: [C.cream, C.cream, C.coral] }))),
	// Matches the "3 red and 2 blue" mission.
	count: [
		{ x: 0, z: 0, colors: [C.coral] }, { x: 1, z: 0, colors: [C.coral] }, { x: 2, z: 0, colors: [C.coral] },
		{ x: 0, z: 1, colors: [C.blue] }, { x: 1, z: 1, colors: [C.blue] }
	],
	// Matches the "4 different colors on the ground" mission.
	yard: [
		{ x: 0, z: 0, colors: [C.coral] }, { x: 1, z: 0, colors: [C.yellow] },
		{ x: 0, z: 1, colors: [C.blue] }, { x: 1, z: 1, colors: [C.purple] }
	]
};

/** Free play cycles through these; a mission picks the idea that helps with it. */
export const FREE_IDEAS: IdeaId[] = ['tower', 'steps', 'tree', 'house', 'yard'];
const FOR_MISSION: Record<string, IdeaId> = { 'colors-count': 'count', 'tall-tower': 'tower', 'colorful-yard': 'yard', 'creative-builder': 'house' };
export const ideaForMission = (missionId: string | null | undefined): IdeaId | null => (missionId ? FOR_MISSION[missionId] ?? null : null);

export interface Guide {
	id: IdeaId;
	cells: Block[];
}

/** Put the idea on empty ground, as close to the middle of the mat as possible. */
export function placeIdea(id: IdeaId, blocks: Block[]): Guide | null {
	const cols = IDEAS[id];
	const w = Math.max(...cols.map((c) => c.x)) + 1;
	const d = Math.max(...cols.map((c) => c.z)) + 1;
	const mid = (SIZE - 1) / 2;
	const spots: { ox: number; oz: number; dist: number }[] = [];
	for (let ox = 0; ox + w <= SIZE; ox++) {
		for (let oz = 0; oz + d <= SIZE; oz++) {
			const free = cols.every((c) => columnTop(blocks, ox + c.x, oz + c.z) === 0 && !isLockedColumn(blocks, ox + c.x, oz + c.z));
			if (free) spots.push({ ox, oz, dist: Math.abs(ox + (w - 1) / 2 - mid) + Math.abs(oz + (d - 1) / 2 - mid) });
		}
	}
	if (spots.length === 0) return null;
	spots.sort((a, b) => a.dist - b.dist || a.ox - b.ox || a.oz - b.oz);
	const { ox, oz } = spots[0]!;
	const cells = cols.flatMap((c) => c.colors.map((color, y) => ({ x: ox + c.x, y, z: oz + c.z, color })));
	return { id, cells };
}

/** Shadow blocks still to fill. A block of any color in the right place counts. */
export const remaining = (guide: Guide, blocks: Block[]) => {
	const filled = new Set(blocks.map(key));
	return guide.cells.filter((c) => !filled.has(key(c)));
};

/** The one to show next: the lowest empty shadow block (always reachable by a tap). */
export function nextCell(guide: Guide, blocks: Block[]): Block | null {
	const left = remaining(guide, blocks);
	left.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
	return left[0] ?? null;
}

/**
 * Where a stuck child can build: the lowest open column (never the Kaaba), on the side facing
 * the camera so nothing hides it. `angle` is the view angle used by the renderer.
 */
export function freeTile(blocks: Block[], angle = Math.PI / 4): Cell | null {
	const sin = Math.sin(angle), cos = Math.cos(angle);
	const mid = (SIZE - 1) / 2;
	let best: Cell | null = null;
	let bestScore = Infinity;
	for (let x = 0; x < SIZE; x++) {
		for (let z = 0; z < SIZE; z++) {
			const top = columnTop(blocks, x, z);
			if (top >= HEIGHT || isLockedColumn(blocks, x, z)) continue;
			const toward = (x - mid) * sin + (z - mid) * cos;
			const score = top * 100 - toward * 10 + Math.abs((x - mid) * cos - (z - mid) * sin);
			if (score < bestScore) { bestScore = score; best = { x, y: top, z }; }
		}
	}
	return best;
}
