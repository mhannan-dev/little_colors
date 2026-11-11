import { get } from 'svelte/store';
import { settings } from '#lib/stores/settings.ts';

/**
 * Small synthesized sounds for the tooth-brushing game (no audio files, works offline):
 * a soft "shh-shh" scrub, a balloon "pop", germ giggles and a gentle brushing tune that loops.
 * Everything respects the sound setting and volume and is silent when muted.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; vol: number } | null {
	const s = get(settings);
	const vol = s.soundEnabled ? s.volume : 0;
	if (!(vol > 0) || typeof window === 'undefined') return null;
	try {
		ctx ??= new AudioContext();
		void ctx.resume();
		if (!noise) {
			noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
			const d = noise.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		}
		return { ctx, vol };
	} catch {
		return null;
	}
}

function burst(a: { ctx: AudioContext; vol: number }, freq: number, q: number, len: number, gain: number) {
	const src = a.ctx.createBufferSource();
	src.buffer = noise;
	const f = a.ctx.createBiquadFilter();
	f.type = 'bandpass';
	f.frequency.value = freq;
	f.Q.value = q;
	const g = a.ctx.createGain();
	const t = a.ctx.currentTime;
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain * a.vol, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.0001, t + len);
	src.connect(f).connect(g).connect(a.ctx.destination);
	src.start(t);
	src.stop(t + len + 0.05);
}

let lastScrub = 0;
/** "Shh" — throttled so fast swipes stay soft. */
export function scrubSound(): void {
	const now = performance.now();
	if (now - lastScrub < 140) return;
	lastScrub = now;
	const a = audio();
	if (a) burst(a, 3200 + Math.random() * 1400, 0.9, 0.12, 0.11);
}

export function popSound(): void {
	const a = audio();
	if (!a) return;
	burst(a, 900, 0.7, 0.08, 0.5);
	const o = a.ctx.createOscillator();
	const g = a.ctx.createGain();
	const t = a.ctx.currentTime;
	o.frequency.setValueAtTime(520, t);
	o.frequency.exponentialRampToValueAtTime(160, t + 0.1);
	g.gain.setValueAtTime(0.18 * a.vol, t);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
	o.connect(g).connect(a.ctx.destination);
	o.start(t);
	o.stop(t + 0.16);
}

/** A tiny "hee-hee" from a germ running away. */
export function giggle(): void {
	const a = audio();
	if (!a) return;
	const t0 = a.ctx.currentTime;
	[0, 0.13, 0.26].forEach((dt, i) => {
		const o = a.ctx.createOscillator();
		const g = a.ctx.createGain();
		o.type = 'triangle';
		const at = t0 + dt;
		o.frequency.setValueAtTime(900 + i * 120, at);
		o.frequency.exponentialRampToValueAtTime(1300 + i * 120, at + 0.08);
		g.gain.setValueAtTime(0, at);
		g.gain.linearRampToValueAtTime(0.08 * a.vol, at + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
		o.connect(g).connect(a.ctx.destination);
		o.start(at);
		o.stop(at + 0.12);
	});
}

export function swishSound(): void {
	const a = audio();
	if (!a) return;
	for (let i = 0; i < 4; i++) {
		const at = i * 0.22;
		setTimeout(() => {
			const b = audio();
			if (b) burst(b, 700 + i * 80, 0.6, 0.2, 0.22);
		}, at * 1000);
	}
}

// A cheerful, simple tune (C major, gentle sine + soft bass). Loops until stopped.
const TUNE: [number, number][] = [
	[523, 1], [659, 1], [784, 1], [659, 1], [698, 1], [880, 1], [784, 2],
	[659, 1], [784, 1], [880, 1], [784, 1], [698, 1], [587, 1], [523, 2]
];
const BEAT = 0.3;
let tuneTimer: ReturnType<typeof setTimeout> | null = null;
let tuneBus: GainNode | null = null;

export function startTune(): void {
	stopTune();
	const play = () => {
		const a = audio();
		if (a) {
			tuneBus?.disconnect();
			tuneBus = a.ctx.createGain();
			tuneBus.connect(a.ctx.destination);
			let t = a.ctx.currentTime + 0.05;
			for (const [f, beats] of TUNE) {
				for (const [freq, gain, type] of [[f, 0.06, 'sine'], [f / 2, 0.03, 'triangle']] as const) {
					const o = a.ctx.createOscillator();
					const g = a.ctx.createGain();
					o.type = type;
					o.frequency.value = freq;
					g.gain.setValueAtTime(0, t);
					g.gain.linearRampToValueAtTime(gain * a.vol, t + 0.02);
					g.gain.exponentialRampToValueAtTime(0.0001, t + beats * BEAT * 0.95);
					o.connect(g).connect(tuneBus);
					o.start(t);
					o.stop(t + beats * BEAT);
				}
				t += beats * BEAT;
			}
		}
		const total = TUNE.reduce((n, [, b]) => n + b, 0) * BEAT;
		// A short breath between loops so it never feels rushed.
		tuneTimer = setTimeout(play, (total + 1.2) * 1000);
	};
	play();
}

export function stopTune(): void {
	if (tuneTimer) clearTimeout(tuneTimer);
	tuneTimer = null;
	// Silence notes already scheduled for this loop.
	tuneBus?.disconnect();
	tuneBus = null;
}
