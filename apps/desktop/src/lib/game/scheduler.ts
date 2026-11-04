/** Pausable, cancellable timers for game sequences (CM-13, CM-16). */
export interface Scheduler {
	after(ms: number, fn: () => void): () => void;
	pause(): void;
	resume(): void;
	cancelAll(): void;
}

interface Timer {
	fn: () => void;
	remaining: number;
	startedAt: number;
	handle: ReturnType<typeof setTimeout> | null;
}

export function createScheduler(): Scheduler {
	const timers = new Set<Timer>();
	let paused = false;

	const start = (timer: Timer) => {
		timer.startedAt = performance.now();
		timer.handle = setTimeout(() => {
			timers.delete(timer);
			timer.fn();
		}, timer.remaining);
	};

	return {
		after(ms, fn) {
			const timer: Timer = { fn, remaining: ms, startedAt: 0, handle: null };
			timers.add(timer);
			if (!paused) start(timer);
			return () => {
				if (timer.handle) clearTimeout(timer.handle);
				timers.delete(timer);
			};
		},
		pause() {
			if (paused) return;
			paused = true;
			for (const t of timers) {
				if (t.handle) clearTimeout(t.handle);
				t.handle = null;
				t.remaining = Math.max(0, t.remaining - (performance.now() - t.startedAt));
			}
		},
		resume() {
			if (!paused) return;
			paused = false;
			for (const t of timers) start(t);
		},
		cancelAll() {
			for (const t of timers) if (t.handle) clearTimeout(t.handle);
			timers.clear();
		}
	};
}

/** Animation durations; shortened to fades when the OS asks for reduced motion (CM-15). */
export function durations() {
	const reduced =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	return {
		reduced,
		pour: reduced ? 300 : 900,
		mix: reduced ? 300 : 1200,
		resultMin: 1500,
		celebrate: reduced ? 300 : 1900,
		wrongResult: 1800,
		wiggle: 600
	};
}
