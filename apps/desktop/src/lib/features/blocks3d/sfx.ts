/**
 * Gentle Web Audio sound effects for 3D block building.
 * Generates soft, musical, playful tones (xylophone / marimba style)
 * without external audio files, completely offline-safe and latency-free.
 */

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return null;
	if (!ctx) {
		ctx = new AudioCtx();
	}
	if (ctx.state === 'suspended') {
		ctx.resume().catch(() => {});
	}
	return ctx;
}

/** Musical frequencies for the palette colors (peaceful pentatonic notes). */
const COLOR_FREQUENCIES: Record<string, number> = {
	'#e58c81': 261.63, // Coral -> C4
	'#edb75f': 293.66, // Orange -> D4
	'#f2d877': 329.63, // Yellow -> E4
	'#8dbb8d': 392.0,  // Green -> G4
	'#80b9ce': 440.0,  // Blue -> A4
	'#a598ca': 523.25, // Purple -> C5
	'#faf0dc': 587.33, // Cream -> D5
	'#a78169': 220.0,  // Brown -> A3
	'#ffffff': 659.25, // White -> E5
	'#2f3437': 196.0,  // Black -> G3
	'#c9a227': 783.99  // Gold -> G5
};

/** Plays a soft, bell-like / marimba note when a block is placed. */
export function playPlaceSound(colorHex: string, masterVolume = 1): void {
	try {
		const audioCtx = getAudioContext();
		if (!audioCtx) return;

		const freq = COLOR_FREQUENCIES[colorHex] ?? 392.0;
		const now = audioCtx.currentTime;

		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();

		osc.type = 'sine';
		osc.frequency.setValueAtTime(freq, now);

		const peakGain = 0.22 * Math.max(0, Math.min(1, masterVolume));
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(peakGain, now + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

		osc.connect(gain);
		gain.connect(audioCtx.destination);

		osc.start(now);
		osc.stop(now + 0.3);
	} catch {
		// Ignore any audio device errors silently
	}
}

/** Plays a gentle bubble-pop sound when a block is removed. */
export function playRemoveSound(masterVolume = 1): void {
	try {
		const audioCtx = getAudioContext();
		if (!audioCtx) return;

		const now = audioCtx.currentTime;
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();

		osc.type = 'sine';
		osc.frequency.setValueAtTime(280, now);
		osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

		const peakGain = 0.18 * Math.max(0, Math.min(1, masterVolume));
		gain.gain.setValueAtTime(peakGain, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

		osc.connect(gain);
		gain.connect(audioCtx.destination);

		osc.start(now);
		osc.stop(now + 0.13);
	} catch {
		// Silently ignore
	}
}

/** Plays a cheerful celebration fanfare arpeggio when a mission is finished. */
export function playCelebrationSound(masterVolume = 1): void {
	try {
		const audioCtx = getAudioContext();
		if (!audioCtx) return;

		const now = audioCtx.currentTime;
		// C5, E5, G5, C6 joyful chords
		const notes = [523.25, 659.25, 783.99, 1046.5];
		const noteDuration = 0.11;

		notes.forEach((freq, idx) => {
			const start = now + idx * noteDuration;
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			osc.type = 'triangle';
			osc.frequency.setValueAtTime(freq, start);

			const peakGain = (idx === notes.length - 1 ? 0.3 : 0.2) * Math.max(0, Math.min(1, masterVolume));
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + (idx === notes.length - 1 ? 0.45 : 0.22));

			osc.connect(gain);
			gain.connect(audioCtx.destination);

			osc.start(start);
			osc.stop(start + (idx === notes.length - 1 ? 0.5 : 0.25));
		});
	} catch {
		// Silently ignore
	}
}

