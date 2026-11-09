export const COLOR_BLOCK_SIZE = 5;

export const BLOCK_STYLES = {
	r: { color: 'red', symbol: '●', bn: 'লাল', en: 'Red' },
	b: { color: 'blue', symbol: '◆', bn: 'নীল', en: 'Blue' },
	g: { color: 'green', symbol: '▲', bn: 'সবুজ', en: 'Green' },
	y: { color: 'yellow', symbol: '★', bn: 'হলুদ', en: 'Yellow' }
} as const;

export type BlockId = keyof typeof BLOCK_STYLES;
export type BlockBoard = Partial<Record<BlockId, number>>;
export type BlockDirection = 'up' | 'down' | 'left' | 'right';

export interface ColorBlockLevel {
	start: BlockBoard;
	gates: BlockBoard;
	walls: number[];
}

const ids = Object.keys(BLOCK_STYLES) as BlockId[];
const directions: Record<BlockDirection, readonly [number, number]> = {
	up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
};

function makeLevel(rows: readonly string[]): ColorBlockLevel {
	const level: ColorBlockLevel = { start: {}, gates: {}, walls: [] };
	for (const [cell, tile] of [...rows.join('')].entries()) {
		if (tile === '#') level.walls.push(cell);
		const id = ids.find(color => color === tile.toLowerCase());
		if (id) (tile === id ? level.gates : level.start)[id] = cell;
	}
	return level;
}

export const COLOR_BLOCK_LEVELS = [
	makeLevel(['.....', '.....', '..R.r', '.....', '.....']),
	makeLevel(['##b##', '#..##', '#B#Rr', '#...#', '#####']),
	makeLevel(['#####', '##.##', 'rB.Rb', '##.##', '#####']),
	makeLevel(['##g##', '##B##', 'rG.Rb', '##.##', '##.##']),
	makeLevel(['##g##', '##Y##', 'rB.Gb', '##R##', '##y##'])
] as const;

/** Slide along one axis and stop at the first obstacle or matching gate. */
export function slideColorBlock(
	level: ColorBlockLevel,
	board: BlockBoard,
	id: BlockId,
	direction: BlockDirection,
	distance = 1
): BlockBoard {
	const start = board[id];
	if (start === undefined) return board;

	const [dx, dy] = directions[direction];
	const occupied = Object.values(board);
	let position = start;
	for (let step = 0; step < distance; step++) {
		const x = position % COLOR_BLOCK_SIZE + dx;
		const y = Math.floor(position / COLOR_BLOCK_SIZE) + dy;
		if (x < 0 || y < 0 || x >= COLOR_BLOCK_SIZE || y >= COLOR_BLOCK_SIZE) break;
		const next = y * COLOR_BLOCK_SIZE + x;
		if (level.walls.includes(next) || occupied.includes(next)) break;
		if (next === level.gates[id]) {
			const cleared = { ...board };
			delete cleared[id];
			return cleared;
		}
		position = next;
	}
	return position === start ? board : { ...board, [id]: position };
}

type BlockHint = { id: BlockId; direction: BlockDirection };

/** Search one-cell moves so each hint can be followed with one arrow press. */
export function colorBlockHint(level: ColorBlockLevel, board: BlockBoard): BlockHint | undefined {
	const key = (state: BlockBoard) => ids.map(id => state[id] ?? '-').join(',');
	const queue: { board: BlockBoard; first?: BlockHint }[] = [{ board }];
	const seen = new Set([key(board)]);
	for (let i = 0; i < queue.length; i++) {
		const current = queue[i]!;
		if (!Object.keys(current.board).length) return current.first;
		for (const id of ids) {
			for (const direction of Object.keys(directions) as BlockDirection[]) {
				const next = slideColorBlock(level, current.board, id, direction);
				if (next === current.board) continue;
				const hash = key(next);
				if (seen.has(hash)) continue;
				seen.add(hash);
				queue.push({ board: next, first: current.first ?? { id, direction } });
			}
		}
	}
}
