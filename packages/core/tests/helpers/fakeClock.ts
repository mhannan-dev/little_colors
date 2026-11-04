import type { Clock } from '../../src/session/Clock.ts';

/** Manual clock: no real timers, DOM APIs, or wall-clock waits. */
export function createFakeClock(startAt = 0) {
	if (!Number.isFinite(startAt)) throw new RangeError('Clock start must be finite.');
	let time = startAt;
	let nextId = 0;
	const pending = new Map<number, { at: number; run: () => void }>();
	const clock: Clock = {
		now: () => time,
		setTimeout(run, ms) {
			if (!Number.isFinite(ms) || ms < 0 || !Number.isFinite(time + ms)) {
				throw new RangeError('Timer delay must be finite and non-negative.');
			}
			const id = nextId++;
			pending.set(id, { at: time + ms, run });
			return () => { pending.delete(id); };
		}
	};
	return {
		...clock,
		advanceBy(ms: number) {
			const end = time + ms;
			if (!Number.isFinite(ms) || ms < 0 || !Number.isFinite(end)) {
				throw new RangeError('Advance must be finite and non-negative.');
			}
			// Map iteration preserves insertion order for timers with equal deadlines.
			let executions = 0;
			while (true) {
				let next: [number, { at: number; run: () => void }] | undefined;
				for (const entry of pending) {
					if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
				}
				if (!next) break;
				if (++executions > 10_000) throw new Error('Fake clock exceeded 10,000 callbacks in one advance.');
				time = next[1].at;
				pending.delete(next[0]);
				next[1].run();
			}
			time = end;
		}
	};
}
