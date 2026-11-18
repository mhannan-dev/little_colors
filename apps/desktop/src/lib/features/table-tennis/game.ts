export const TABLE = { halfWidth: 2, halfLength: 3.5, height: 1, paddleZ: 2.9, paddleRadius: 0.62, ballRadius: 0.1 };
export interface TableTennisGame {
	playerX: number;
	computerX: number;
	ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
	phase: 'ready' | 'playing';
	message: 'ready' | 'return' | 'again';
}
export function createTableTennisGame(): TableTennisGame {
	return {
		playerX: 0, computerX: 0, phase: 'ready', message: 'ready',
		ball: { x: 0, y: 1.95, z: 2.65, vx: 0, vy: 0, vz: 0 }
	};
}
export function serve(game: TableTennisGame) {
	if (game.phase === 'playing') return;
	Object.assign(game.ball, { x: game.playerX, y: 1.35, z: 2.75, vx: -game.playerX * 0.25, vy: 3, vz: -5 });
	game.phase = 'playing';
	game.message = 'ready';
}
const clamp = (value: number, max: number) => Math.max(-max, Math.min(max, value));

/** Fixed substeps prevent a fast ball from skipping paddle and tabletop collisions. */
export function stepTableTennis(game: TableTennisGame, seconds: number, targetX: number) {
	if (!Number.isFinite(seconds) || seconds <= 0) return;
	const duration = Math.min(seconds, 0.05);
	const steps = Math.ceil(duration / (1 / 120));
	const dt = duration / steps;
	for (let step = 0; step < steps; step++) {
		game.playerX += clamp(clamp(targetX, 1.75) - game.playerX, dt * 7);
		if (game.phase !== 'playing') {
			game.ball.x = game.playerX;
			game.ball.y = 1.95;
			game.ball.z = 2.65;
			continue;
		}
		const ball = game.ball;
		game.computerX += clamp(clamp(ball.x * 0.92, 1.7) - game.computerX, dt * 1.8);
		const previousZ = ball.z;
		const previousY = ball.y;
		ball.vy -= 6 * dt;
		ball.x += ball.vx * dt;
		ball.y += ball.vy * dt;
		ball.z += ball.vz * dt;
		if (previousY >= 1.1 && ball.y < 1.1 && Math.abs(ball.x) <= 2 && Math.abs(ball.z) <= 3.5) {
			ball.y = 1.1;
			ball.vy = Math.max(2.8, -ball.vy * 0.88);
		}
		// A low shot touches the net. The next serve is always available.
		if (previousZ * ball.z <= 0 && ball.y < 1.42) {
			game.phase = 'ready';
			game.message = 'again';
		}
		const near = ball.vz > 0 && previousZ < TABLE.paddleZ && ball.z >= TABLE.paddleZ;
		const far = ball.vz < 0 && previousZ > -TABLE.paddleZ && ball.z <= -TABLE.paddleZ;
		const paddle = near ? game.playerX : game.computerX;
		if ((near || far) && Math.abs(ball.x - paddle) <= TABLE.paddleRadius && ball.y > 1.05 && ball.y < 2.2) {
			ball.z = near ? TABLE.paddleZ : -TABLE.paddleZ;
			ball.vz = near ? -5 : 5;
			ball.vy = 3;
			ball.vx = clamp((ball.x - paddle) * 3, 1.8);
			if (near) game.message = 'return';
		}
		if (Math.abs(ball.z) > 3.8 || ball.y < 0.2 || Math.abs(ball.x) > 2.8) {
			game.phase = 'ready';
			game.message = 'again';
		}
	}
}
