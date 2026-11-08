/**
 * Gentle Web Audio chimes for the 3D Flower Garden game.
 * Plays sweet, harp/music-box style chords when flowers are discovered.
 */

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioCtx) return null;
	if (!ctx) ctx = new AudioCtx();
	if (ctx.state === 'suspended') ctx.resume().catch(() => {});
	return ctx;
}

/** Pentatonic chime frequencies for the 5 flowers */
const FLOWER_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5, D5, E5, G5, A5

/** Plays a sparkling flower pickup chime. */
export function playFlowerPickupChime(flowerIndex: number, masterVolume = 1): void {
	try {
		const audioCtx = getAudioContext();
		if (!audioCtx) return;

		const now = audioCtx.currentTime;
		const baseFreq = FLOWER_NOTES[flowerIndex % FLOWER_NOTES.length];
		// Double note bell chime
		const notes = [baseFreq, baseFreq * 1.5];

		notes.forEach((freq, idx) => {
			const start = now + idx * 0.08;
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, start);

			const peak = 0.22 * Math.max(0, Math.min(1, masterVolume));
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(peak, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

			osc.connect(gain);
			gain.connect(audioCtx.destination);

			osc.start(start);
			osc.stop(start + 0.38);
		});
	} catch {
		// Silently ignore audio hardware errors
	}
}

/** Plays a grand celebration harp flourish when all flowers are found. */
export function playGardenCelebrationChime(masterVolume = 1): void {
	try {
		const audioCtx = getAudioContext();
		if (!audioCtx) return;

		const now = audioCtx.currentTime;
		const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6

		arpeggio.forEach((freq, idx) => {
			const start = now + idx * 0.09;
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			osc.type = 'triangle';
			osc.frequency.setValueAtTime(freq, start);

			const peak = (idx === arpeggio.length - 1 ? 0.28 : 0.2) * Math.max(0, Math.min(1, masterVolume));
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(peak, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

			osc.connect(gain);
			gain.connect(audioCtx.destination);

			osc.start(start);
			osc.stop(start + 0.52);
		});
	} catch {
		// Silently ignore
	}
}

