export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Move = { index: number; mark: Mark };
export type Difficulty = 'easy' | 'medium' | 'hard';

export const VARIANTS = {
	classic: { size: 3, run: 3, fading: false },
	infinity: { size: 3, run: 3, fading: true },
	five: { size: 5, run: 4, fading: false },
	six: { size: 6, run: 4, fading: false }
} as const;
export type Variant = keyof typeof VARIANTS;
type Rules = typeof VARIANTS[Variant];

export function boardFor(moves: readonly Move[], rules: Rules): Cell[] {
	const board: Cell[] = Array(rules.size ** 2).fill(null);
	const count = { X: 0, O: 0 };
	for (let i = moves.length - 1; i >= 0; i--) {
		const { index, mark } = moves[i];
		if ((!rules.fading || count[mark] < 3) && board[index] === null) board[index] = mark;
		count[mark]++;
		if (rules.fading && count.X >= 3 && count.O >= 3) break;
	}
	return board;
}

export function winningLine(board: readonly Cell[], { size, run }: Rules): number[] | undefined {
	for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
		const mark = board[row * size + col];
		if (!mark) continue;
		for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
			const lastRow = row + dr * (run - 1), lastCol = col + dc * (run - 1);
			if (lastRow >= size || lastCol >= size || lastCol < 0) continue;
			const line = Array.from({ length: run }, (_, n) => (row + dr * n) * size + col + dc * n);
			if (line.every(index => board[index] === mark)) return line;
		}
	}
}

function classicScore(board: Cell[], turn: Mark, root: Mark, depth: number, alpha: number, beta: number): number {
	const line = winningLine(board, VARIANTS.classic);
	if (line) return board[line[0]] === root ? 10 - depth : depth - 10;
	if (board.every(Boolean)) return 0;
	const maximizing = turn === root;
	let best = maximizing ? -Infinity : Infinity;
	for (let index = 0; index < board.length; index++) {
		if (board[index]) continue;
		board[index] = turn;
		const score = classicScore(board, turn === 'X' ? 'O' : 'X', root, depth + 1, alpha, beta);
		board[index] = null;
		if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
		else { best = Math.min(best, score); beta = Math.min(beta, best); }
		if (alpha >= beta) break;
	}
	return best;
}

export function chooseMove(moves: readonly Move[], variant: Variant, mark: Mark, difficulty: Difficulty): number | undefined {
	const rules = VARIANTS[variant];
	const board = boardFor(moves, rules);
	const center = (rules.size - 1) / 2;
	const distance = (index: number) => Math.hypot(index % rules.size - center, Math.floor(index / rules.size) - center);
	const empty = board.flatMap((cell, index) => cell === null ? [index] : []).sort((a, b) => distance(a) - distance(b));
	if (empty.length === 0 || winningLine(board, rules)) return undefined;
	if (difficulty === 'easy') return empty[Math.floor(Math.random() * empty.length)];
	const other = mark === 'X' ? 'O' : 'X';
	const wins = (history: readonly Move[], index: number, player: Mark) =>
		!!winningLine(boardFor([...history, { index, mark: player }], rules), rules);
	const win = empty.find(index => wins(moves, index, mark));
	if (win !== undefined) return win;
	if (difficulty === 'medium') return empty.find(index => wins(moves, index, other)) ?? empty[0];

	let best = empty[0];
	let bestScore = -Infinity;
	for (const index of empty) {
		const history = [...moves, { index, mark }];
		const next = boardFor(history, rules);
		const score = variant === 'classic'
			? classicScore(next, other, mark, 1, -Infinity, Infinity)
			: -next.filter((cell, reply) => cell === null && wins(history, reply, other)).length;
		if (score > bestScore) { best = index; bestScore = score; }
	}
	return best;
}
