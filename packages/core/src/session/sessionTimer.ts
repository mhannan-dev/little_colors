import type { Clock } from './Clock.ts';

export interface SessionTimer {
	start(): void;
	pause(): void;
	resume(): void;
	/** Resets and stops; the app explicitly starts a new gameplay session. */
	reset(): void;
	dispose(): void;
	setThresholdMinutes(minutes: number): void;
	readonly activeMs: number;
	onThreshold(listener: () => void): () => void;
}

export function createSessionTimer(clock: Clock, restReminderMinutes = 20): SessionTimer {
	let accumulated = 0, startedAt: number | null = null;
	let minutes = restReminderMinutes, fired = false, generation = 0;
	let cancel: (() => void) | null = null;
	const listeners = new Set<{ fn: () => void }>();
	const validate = (value: number) => {
		if (value !== 0 && (!Number.isInteger(value) || value < 10 || value > 60 || value % 5 !== 0)) throw new RangeError('Rest reminder must be off or 10–60 minutes in steps of five.');
	};
	validate(minutes);
	const active = () => accumulated + (startedAt === null ? 0 : Math.max(0, clock.now() - startedAt));
	const cancelTimer = () => { generation++; cancel?.(); cancel = null; };
	const schedule = () => {
		cancelTimer();
		if (startedAt === null || minutes === 0 || fired) return;
		const remaining = Math.max(0, minutes * 60_000 - active());
		const ticket = generation;
		cancel = clock.setTimeout(() => {
			if (ticket !== generation || startedAt === null || fired) return;
			cancel = null;
			if (active() < minutes * 60_000) { schedule(); return; }
			fired = true;
			for (const listener of [...listeners]) listener.fn();
		}, remaining);
	};
	const pause = () => {
		if (startedAt !== null) { accumulated = active(); startedAt = null; }
		cancelTimer();
	};
	const start = () => { if (startedAt === null) { startedAt = clock.now(); schedule(); } };
	return {
		get activeMs() { return active(); }, start, resume: start, pause,
		reset() { pause(); accumulated = 0; fired = false; },
		dispose() { pause(); listeners.clear(); },
		setThresholdMinutes(value) { validate(value); if (value !== minutes) { minutes = value; schedule(); } },
		onThreshold(fn) { const entry = { fn }; listeners.add(entry); return () => { listeners.delete(entry); }; }
	};
}
