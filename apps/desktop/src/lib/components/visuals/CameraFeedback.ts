/** A small, damped offset around the caller's current camera position. */
export class CameraFeedback {
	private age = 1;
	private strength = 0;

	bump(strength = 0.045) {
		this.age = 0;
		this.strength = Math.min(0.09, Math.max(0, strength));
	}

	update(dt: number) {
		this.age += dt;
		if (this.age >= 0.32) return 0;
		return Math.sin(this.age * 33) * (1 - this.age / 0.32) ** 2 * this.strength;
	}

	clear() { this.age = 1; }
}
