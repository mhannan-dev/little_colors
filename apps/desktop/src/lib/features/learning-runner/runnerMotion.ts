import { HAZARDS, type Hazard } from './reference/course.ts';

const AIR_TIME = 0.95;
const SLIDE_TIME = 1;
export const RUN_SPEED = 14;

/** Obstacle prompts use the same course positions as the rendered logs, branches, and gaps. */
export class RunnerMotion {
	distance = 0;
	waiting: Hazard | null = null;
	private airTime = AIR_TIME;
	private slideTime = SLIDE_TIME;
	private trickTime = 1;
	private passed = new Set<number>();

	get height() { return this.airTime < AIR_TIME ? Math.sin(this.airTime / AIR_TIME * Math.PI) * 2 : 0; }
	get sliding() { return this.slideTime < SLIDE_TIME; }
	get airborne() { return this.airTime < AIR_TIME; }
	get flip() { return this.trickTime < 0.7 ? this.trickTime / 0.7 : -1; }

	reset() {
		this.distance = 0;
		this.waiting = null;
		this.airTime = AIR_TIME;
		this.slideTime = SLIDE_TIME;
		this.trickTime = 1;
		this.passed.clear();
	}

	jump() {
		if (this.airborne) { this.trickTime = 0; return; }
		this.slideTime = SLIDE_TIME;
		this.airTime = 0;
	}

	slide() {
		if (!this.airborne) this.slideTime = 0;
	}

	step(dt: number, destination: number, assisted: boolean, reduced: boolean): boolean {
		this.airTime += dt;
		this.slideTime += dt;
		this.trickTime += dt;
		if (reduced) { this.distance = destination; this.waiting = null; return true; }
		const next = Math.min(destination, this.distance + dt * RUN_SPEED);
		const obstacle = HAZARDS.find(item => !this.passed.has(item.id) && item.s - 5 <= next && item.s < destination);
		if (obstacle) {
			if (assisted && (!this.waiting || (!this.airborne && !this.sliding))) {
				if (obstacle.kind === 'branch') this.slide();
				else if (!this.airborne) this.jump();
			}
			const safe = obstacle.kind === 'branch' ? this.sliding : this.height > 0.58;
			if (!safe) {
				this.distance = Math.min(next, obstacle.s - 5);
				this.waiting = obstacle;
				return false;
			}
			this.passed.add(obstacle.id);
		}
		this.waiting = null;
		this.distance = next;
		return this.distance >= destination;
	}
}
