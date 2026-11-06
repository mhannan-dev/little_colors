import type { AudioPlayer, Locale, PlaybackResult, SpeechFallback } from '@little-colors/core';

/**
 * Desktop platform adapters for the core AudioManager (spec 04, AR-08).
 * Files in src/lib/assets/audio/<locale>/<name>.{wav,mp3} are bundled automatically:
 * .wav = human recordings (from /record), .mp3 = TTS placeholders (pnpm tts:generate).
 */
const FILES = import.meta.glob('../assets/audio/**/*.{wav,mp3}', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

/**
 * core path "audio/bn-BD/x.mp3" → bundled URL, or null when not recorded yet.
 * A human recording (.wav) always wins over a TTS placeholder (.mp3).
 */
export function bundledAudioUrl(corePath: string, only?: 'wav' | 'mp3'): string | null {
	const base = `../assets/${corePath.replace(/\.mp3$/, '')}`;
	if (only) return FILES[`${base}.${only}`] ?? null;
	return FILES[`${base}.wav`] ?? FILES[`${base}.mp3`] ?? null;
}

/** True when a human recording (.wav) exists for this core path. */
export function hasRecording(corePath: string): boolean {
	return `../assets/${corePath.replace(/\.mp3$/, '')}.wav` in FILES;
}

export function createHtmlAudioPlayer(): AudioPlayer {
	const playing = new Set<{ el: HTMLAudioElement; finish: (r: PlaybackResult) => void }>();
	let muted = false;
	return {
		play(src, opts) {
			return new Promise<PlaybackResult>((resolve) => {
				const el = new Audio(src);
				el.volume = opts?.volume ?? 1;
				el.muted = muted;
				const entry = {
					el,
					finish: (r: PlaybackResult) => {
						playing.delete(entry);
						resolve(r);
					}
				};
				playing.add(entry);
				el.onended = () => entry.finish('ended');
				el.onerror = () => entry.finish('failed');
				el.play().catch(() => entry.finish('failed'));
			});
		},
		stopAll() {
			for (const p of [...playing]) {
				p.el.pause();
				p.finish('stopped');
			}
		},
		setMuted(m) {
			muted = m;
			for (const p of playing) p.el.muted = m;
		}
	};
}

const LANGS: Record<Locale, string[]> = {
	'bn-BD': ['bn-bd', 'bn-in', 'bn'],
	'en-US': ['en-us', 'en-gb', 'en']
};

function pickVoice(locale: Locale): SpeechSynthesisVoice | null {
	if (typeof speechSynthesis === 'undefined') return null;
	const voices = speechSynthesis.getVoices();
	for (const lang of LANGS[locale]) {
		const v = voices.find((x) => x.lang.toLowerCase().startsWith(lang));
		if (v) return v;
	}
	return null;
}

/** PLACEHOLDER voice (AS-30): Windows speech voices until recordings exist. */
export function createSpeechFallback(): SpeechFallback {
	let active: ((r: PlaybackResult) => void) | null = null;
	return {
		async isAvailable(locale) {
			return pickVoice(locale) !== null;
		},
		speak(text, locale) {
			return new Promise<PlaybackResult>((resolve) => {
				const voice = pickVoice(locale);
				if (!voice) return resolve('failed');
				const u = new SpeechSynthesisUtterance(text);
				u.voice = voice;
				u.lang = voice.lang;
				u.rate = 0.9;
				u.pitch = 1.1;
				active = resolve;
				u.onend = () => {
					active = null;
					resolve('ended');
				};
				u.onerror = () => {
					active = null;
					resolve('failed');
				};
				speechSynthesis.speak(u);
			});
		},
		stop() {
			try {
				speechSynthesis.cancel();
			} catch {
				/* ignore */
			}
			active?.('stopped');
			active = null;
		}
	};
}
