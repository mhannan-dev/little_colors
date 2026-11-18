import { describe, expect, it } from 'vitest';
import { createTableTennisGame, serve, stepTableTennis } from './game.ts';

describe('table tennis simulation', () => {
	it('bounces on the table, clears the net and returns from the computer paddle', () => {
		const game = createTableTennisGame();
		serve(game);
		let bounced = false;
		let returned = false;
		for (let tick = 0; tick < 190; tick++) {
			const vy = game.ball.vy;
			stepTableTennis(game, 1 / 120, 0);
			if (vy < 0 && game.ball.vy > 0) bounced = true;
			if (game.ball.vz > 0) returned = true;
		}
		expect(bounced).toBe(true);
		expect(returned).toBe(true);
		expect(game.phase).toBe('playing');
	});
	it('returns from the player paddle and waits for a fresh serve after a miss', () => {
		const game = createTableTennisGame();
		serve(game);
		Object.assign(game.ball, { x: 0, y: 1.4, z: 2.88, vx: 0, vy: 0, vz: 5 });
		stepTableTennis(game, 0.02, 0);
		expect(game.ball.vz).toBeLessThan(0);
		expect(game.message).toBe('return');
		Object.assign(game.ball, { x: 1.8, y: 1.4, z: 2.88, vx: 0, vy: 0, vz: 5 });
		for (let tick = 0; tick < 30; tick++) stepTableTennis(game, 1 / 60, 0);
		expect(game.phase).toBe('ready');
		expect(game.message).toBe('again');
		serve(game);
		expect(game.phase).toBe('playing');
		expect(game.ball.z).toBe(2.75);
	});
	it('clamps frame time and paddle movement and rejects an invalid delta', () => {
		const game = createTableTennisGame();
		stepTableTennis(game, 500, 100);
		expect(game.playerX).toBeCloseTo(0.35, 10);
		const before = structuredClone(game);
		stepTableTennis(game, Number.NaN, 0);
		expect(game).toEqual(before);
	});
});
