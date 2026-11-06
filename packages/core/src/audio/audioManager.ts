import type { Locale } from '../types/colors.ts';
import type { AudioPlayer, PlaybackResult, SpeechFallback } from './types.ts';
import { getNarration, narrationText } from './catalog.ts';

/**
 * Spec 08 — narration manager.
 *
 * Playback order per line (AU-08): packaged file → speech fallback → silent.
 * The caption is always published first, so gameplay never depends on audio.
 */
export interface AudioSettings {
	locale: Locale;
	soundEnabled: boolean;
	islamicExpressionsEnabled: boolean;
	volume: number; // 0..1
}

export interface AudioManagerDeps {
	player: AudioPlayer;
	speech: SpeechFallback;
	/**
	 * Returns a playable file for the key, a list of clip files to play in order
	 * (a line composed from recorded clips), or null when no recording exists yet.
	 * `neutral` is true when the neutral variant of an Islamic line must play (AU-30).
	 */
	resolveFile: (key: string, locale: Locale, neutral: boolean) => string | string[] | null;
	getSettings: () => AudioSettings;
	onCaption: (text: string) => void;
}

export type NarrateMode = 'interrupt' | 'queue';

export interface AudioManager {
	/** Resolves when the line finished, was skipped, or was cancelled. */
	/** caption: false speaks without replacing the on-screen instruction (e.g. button names). */
	narrate(key: string, opts?: { mode?: NarrateMode; caption?: boolean }): Promise<void>;
	/** Narrates the key and remembers it for replayInstruction (AU-07). */
	instruct(key: string): Promise<void>;
	replayInstruction(): Promise<void>;
	stopAll(): void;
	setMuted(muted: boolean): void;
}

interface Item {
	key: string;
	caption: boolean;
	done: () => void;
}

export function createAudioManager(deps: AudioManagerDeps): AudioManager {
	const queue: Item[] = [];
	let current: Item | null = null;
	/** Incremented on every stop so stale playbacks are ignored. */
	let generation = 0;
	let lastInstruction: string | null = null;

	async function playLine(key: string, gen: number, caption = true): Promise<PlaybackResult | 'skipped'> {
		const s = deps.getSettings();
		const text = narrationText(key, s.locale, s.islamicExpressionsEnabled);
		if (!text) return 'skipped';
		if (caption) deps.onCaption(text);
		if (!s.soundEnabled) return 'skipped';

		// Audio must match the caption: neutral recording when Islamic expressions are off.
		const neutral = !s.islamicExpressionsEnabled && getNarration(key)?.islamic === true;
		const resolved = deps.resolveFile(key, s.locale, neutral);
		const files = resolved === null ? [] : Array.isArray(resolved) ? resolved : [resolved];
		if (files.length > 0) {
			try {
				let r: PlaybackResult = 'ended';
				let played = 0;
				for (const file of files) {
					r = await deps.player.play(file, { volume: s.volume });
					if (r !== 'ended' || gen !== generation) break;
					played++;
				}
				// A clip failing mid-sentence must not restart the whole line in another voice.
				if (r === 'failed' && played > 0) return 'ended';
				if (r !== 'failed' || gen !== generation) return r;
			} catch {
				/* fall through to speech */
			}
		}
		if (gen !== generation) return 'stopped';
		try {
			if (await deps.speech.isAvailable(s.locale)) {
				if (gen !== generation) return 'stopped';
				return await deps.speech.speak(text, s.locale);
			}
		} catch {
			/* silent: caption already shown */
		}
		return 'skipped';
	}

	async function pump() {
		if (current) return;
		const next = queue.shift();
		if (!next) return;
		current = next;
		const gen = generation;
		try {
			await playLine(next.key, gen, next.caption);
		} finally {
			next.done();
			if (current === next) current = null;
			if (gen === generation) void pump();
		}
	}

	function stopAll() {
		generation++;
		for (const item of queue.splice(0)) item.done();
		const playing = current;
		current = null;
		playing?.done();
		try {
			deps.player.stopAll();
		} catch {
			/* ignore */
		}
		try {
			deps.speech.stop();
		} catch {
			/* ignore */
		}
	}

	function narrate(key: string, opts: { mode?: NarrateMode; caption?: boolean } = {}): Promise<void> {
		if ((opts.mode ?? 'queue') === 'interrupt') stopAll();
		return new Promise<void>((resolve) => {
			let settled = false;
			queue.push({
				key,
				caption: opts.caption ?? true,
				done: () => {
					if (!settled) {
						settled = true;
						resolve();
					}
				}
			});
			void pump();
		});
	}

	return {
		narrate,
		instruct(key) {
			lastInstruction = key;
			return narrate(key, { mode: 'interrupt' });
		},
		replayInstruction() {
			return lastInstruction ? narrate(lastInstruction, { mode: 'interrupt' }) : Promise.resolve();
		},
		stopAll,
		setMuted(muted) {
			try {
				deps.player.setMuted(muted);
			} catch {
				/* ignore */
			}
			if (muted) {
				try {
					deps.speech.stop();
				} catch {
					/* ignore */
				}
			}
		}
	};
}
