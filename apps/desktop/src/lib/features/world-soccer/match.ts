export type Point = { x: number; y: number };
export type Result = 'goal' | 'saved' | 'blocked' | 'wide';
export const GOAL = { left: 210, right: 390, line: 76, keeperY: 101 };
export const FIELD = { left: 38, right: 562, bottom: 631 };
export const TEAMS = [
	{ code: 'BAN', en: 'Bangladesh', bn: 'বাংলাদেশ', primary: '#007b63', trim: '#e45150' },
	{ code: 'BRA', en: 'Brazil', bn: 'ব্রাজিল', primary: '#f6d24c', trim: '#21704e' },
	{ code: 'ARG', en: 'Argentina', bn: 'আর্জেন্টিনা', primary: '#bce1f9', trim: '#3687ad' },
	{ code: 'GER', en: 'Germany', bn: 'জার্মানি', primary: '#f1eeeb', trim: '#344054' }
] as const;
export type Team = typeof TEAMS[number];
const CHANCES = 3;
const BALL_RADIUS = 6;
type Flight = { vx: number; vy: number; time: number; target?: number };
export type Match = {
	highlight: number;
	phase: 'attack' | 'defend' | 'result' | 'finished';
	attacking: boolean;
	home: number;
	away: number;
	players: Point[];
	defenders: Point[];
	owner: number;
	ball: Point;
	keeperX: number;
	flight: Flight | null;
	result: Result | null;
};

function formation(highlight: number) {
	const flank = highlight === 2 ? -1 : highlight === 4 ? 1 : 0;
	return {
		players: [{ x: 300 + flank * 83, y: 452 }, { x: 126, y: 345 }, { x: 468, y: 300 }, { x: 316, y: 223 }],
		defenders: [{ x: 236 + flank * 27, y: 320 }, { x: 405, y: 239 }, { x: 265, y: 167 }]
	};
}

function highlight(index: number, home: number, away: number): Match {
	const attacking = index % 2 === 0;
	const { players, defenders } = formation(index);
	if (!attacking) players[0] = { x: [260, 340, 300][Math.floor(index / 2)], y: 265 };
	return {
		highlight: index, phase: attacking ? 'attack' : 'defend', attacking,
		home, away, players, defenders, owner: 0, ball: { ...players[0] },
		keeperX: attacking ? 285 + 15 * (index / 2) : 300, flight: null, result: null
	};
}

export const startMatch = () => highlight(0, 0, 0);
export const roundNumber = (match: Match) => Math.floor(match.highlight / 2) + 1;
export const lastHighlight = (match: Match) => match.highlight === CHANCES * 2 - 1;

export function nextHighlight(match: Match): Match {
	if (match.phase !== 'result') return match;
	return lastHighlight(match) ? { ...match, phase: 'finished' } : highlight(match.highlight + 1, match.home, match.away);
}

export function kick(match: Match, direction: Point, speed: number, target?: number): boolean {
	const distance = Math.hypot(direction.x, direction.y);
	if (match.phase !== 'attack' || match.flight || distance < 1) return false;
	match.flight = { vx: direction.x / distance * speed, vy: direction.y / distance * speed, time: 0, target };
	return true;
}

export function aimAt(match: Match, x: number): boolean {
	return kick(match, { x: x - match.ball.x, y: GOAL.line - match.ball.y }, 715);
}

export function pass(match: Match, player: number): boolean {
	const target = match.players[player];
	if (!target || player === match.owner) return false;
	return kick(match, { x: target.x - match.ball.x, y: target.y - match.ball.y }, 565, player);
}

export function moveKeeper(match: Match, x: number) {
	if (match.phase === 'defend') match.keeperX = Math.max(GOAL.left, Math.min(GOAL.right, x));
}

export function opponentShot(match: Match): boolean {
	if (match.phase !== 'defend' || match.flight) return false;
	const target = [GOAL.right - 24, GOAL.left + 24, 300][roundNumber(match) - 1];
	const dx = target - match.ball.x;
	const dy = GOAL.line - match.ball.y;
	const length = Math.hypot(dx, dy);
	match.flight = { vx: dx / length * 350, vy: dy / length * 350, time: 0 };
	return true;
}

function endPlay(match: Match, result: Result) {
	match.result = result;
	match.flight = null;
	match.phase = 'result';
	if (result === 'goal') {
		if (match.attacking) match.home++;
		else match.away++;
	}
}

function step(match: Match, dt: number) {
	const flight = match.flight;
	if (!flight) return;
	flight.time += dt;
	const previous = match.ball;
	const ball = { x: previous.x + flight.vx * dt, y: previous.y + flight.vy * dt };
	match.ball = ball;
	const friction = Math.exp(-0.36 * dt);
	flight.vx *= friction;
	flight.vy *= friction;
	if (match.attacking && flight.target === undefined && ball.y < 215 && flight.vy < 0) {
		const targetX = ball.x + flight.vx * (GOAL.keeperY - ball.y) / flight.vy;
		match.keeperX += Math.max(-110 * dt, Math.min(110 * dt, targetX - match.keeperX));
		match.keeperX = Math.max(GOAL.left + 13, Math.min(GOAL.right - 13, match.keeperX));
	}
	if (Math.abs(ball.y - GOAL.keeperY) < 14 && Math.abs(ball.x - match.keeperX) < 24 + BALL_RADIUS) {
		endPlay(match, 'saved');
		return;
	}
	if (match.attacking && match.defenders.some(player => Math.hypot(player.x - ball.x, player.y - ball.y) < 17 + BALL_RADIUS)) {
		endPlay(match, 'blocked');
		return;
	}
	if (flight.target !== undefined) {
		const receiver = match.players[flight.target];
		if (Math.hypot(ball.x - receiver.x, ball.y - receiver.y) < 16) {
			match.ball = { ...receiver };
			match.owner = flight.target;
			match.flight = null;
			return;
		}
	}
	if (ball.y <= GOAL.line) {
		const lineX = previous.x + (ball.x - previous.x) * (GOAL.line - previous.y) / (ball.y - previous.y);
		endPlay(match, lineX > GOAL.left + BALL_RADIUS && lineX < GOAL.right - BALL_RADIUS ? 'goal' : 'wide');
	} else if (ball.x < FIELD.left || ball.x > FIELD.right || ball.y > FIELD.bottom || flight.time > 3.5) {
		endPlay(match, 'wide');
	}
}

export function advanceBall(match: Match, elapsed: number) {
	// Keep collision checks smaller than a ball diameter, even on a slow frame.
	let remaining = Math.min(elapsed, 0.08);
	while (match.flight && remaining > 0) {
		const dt = Math.min(remaining, 1 / 120);
		step(match, dt);
		remaining -= dt;
	}
}
