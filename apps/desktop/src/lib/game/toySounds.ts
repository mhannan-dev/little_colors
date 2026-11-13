import { get } from 'svelte/store';
import { settings } from '#lib/stores/settings.ts';

/**
 * Tiny synthesized toy sounds (no audio files, works offline): train whistle and chug, friendly
 * animal calls, a wooden "plop" and a soft "boing". All respect the sound setting and volume.
 * Never a buzzer or a "wrong" sound (PR-08).
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): { c: AudioContext; vol: number; t: number } | null {
	const s = get(settings);
	const vol = s.soundEnabled ? s.volume : 0;
	if (!(vol > 0) || typeof window === 'undefined') return null;
	try {
		ctx ??= new AudioContext();
		void ctx.resume();
		if (!noise) {
			noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
			const d = noise.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		}
		return { c: ctx, vol, t: ctx.currentTime + 0.01 };
	} catch {
		return null;
	}
}

type Env = { at: number; attack: number; hold: number; release: number; gain: number };
function envGain(c: AudioContext, vol: number, e: Env): GainNode {
	const g = c.createGain();
	g.gain.setValueAtTime(0, e.at);
	g.gain.linearRampToValueAtTime(e.gain * vol, e.at + e.attack);
	g.gain.setValueAtTime(e.gain * vol, e.at + e.attack + e.hold);
	g.gain.exponentialRampToValueAtTime(0.0001, e.at + e.attack + e.hold + e.release);
	g.connect(c.destination);
	return g;
}

function tone(type: OscillatorType, freqs: [number, number][], e: Env, filter?: { type: BiquadFilterType; f: number; q?: number }, vibrato?: [number, number]) {
	const a = audio();
	if (!a) return;
	const at = a.t + e.at;
	const o = a.c.createOscillator();
	o.type = type;
	o.frequency.setValueAtTime(freqs[0]![1], at);
	for (const [dt, f] of freqs.slice(1)) o.frequency.linearRampToValueAtTime(f, at + dt);
	let out: AudioNode = o;
	if (filter) {
		const bf = a.c.createBiquadFilter();
		bf.type = filter.type;
		bf.frequency.value = filter.f;
		bf.Q.value = filter.q ?? 1;
		o.connect(bf);
		out = bf;
	}
	if (vibrato) {
		const lfo = a.c.createOscillator();
		const lg = a.c.createGain();
		lfo.frequency.value = vibrato[0];
		lg.gain.value = vibrato[1];
		lfo.connect(lg).connect(o.frequency);
		lfo.start(at);
		lfo.stop(at + e.attack + e.hold + e.release + 0.05);
	}
	out.connect(envGain(a.c, a.vol, { ...e, at }));
	o.start(at);
	o.stop(at + e.attack + e.hold + e.release + 0.05);
}

function hiss(at: number, len: number, freq: number, gain: number, q = 0.8) {
	const a = audio();
	if (!a || !noise) return;
	const src = a.c.createBufferSource();
	src.buffer = noise;
	const f = a.c.createBiquadFilter();
	f.type = 'bandpass';
	f.frequency.value = freq;
	f.Q.value = q;
	const start = a.t + at;
	src.connect(f).connect(envGain(a.c, a.vol, { at: start, attack: 0.02, hold: len * 0.4, release: len * 0.6, gain }));
	src.start(start);
	src.stop(start + len + 0.1);
}

/** Two-tone steam whistle: "too-toot!" */
export function whistle(): void {
	for (const [at, len] of [[0, 0.32], [0.4, 0.6]] as const) {
		tone('triangle', [[0, 660]], { at, attack: 0.04, hold: len, release: 0.15, gain: 0.12 });
		tone('triangle', [[0, 830]], { at, attack: 0.04, hold: len, release: 0.15, gain: 0.08 });
		hiss(at, len + 0.15, 2600, 0.05, 2);
	}
}
/** One soft "chuff" of the engine. */
export function chug(strength = 1): void {
	hiss(0, 0.16, 500 + Math.random() * 120, 0.14 * strength, 0.7);
}
export function moo(): void {
	tone('sawtooth', [[0, 150], [0.25, 170], [1.0, 110]], { at: 0, attack: 0.12, hold: 0.6, release: 0.35, gain: 0.16 }, { type: 'lowpass', f: 700, q: 3 });
}
export function cluck(): void {
	for (const at of [0, 0.16, 0.3]) tone('square', [[0, 700], [0.06, 420]], { at, attack: 0.005, hold: 0.03, release: 0.06, gain: 0.06 }, { type: 'bandpass', f: 1200, q: 2 });
}
export function quack(): void {
	for (const at of [0, 0.28]) tone('sawtooth', [[0, 520], [0.15, 380]], { at, attack: 0.01, hold: 0.1, release: 0.08, gain: 0.12 }, { type: 'bandpass', f: 1100, q: 4 });
}
export function baa(): void {
	tone('sawtooth', [[0, 420], [0.6, 380]], { at: 0, attack: 0.05, hold: 0.45, release: 0.2, gain: 0.1 }, { type: 'bandpass', f: 1400, q: 2.5 }, [7, 25]);
}
export function meow(): void {
	tone('triangle', [[0, 600], [0.2, 900], [0.55, 520]], { at: 0, attack: 0.04, hold: 0.35, release: 0.2, gain: 0.12 }, { type: 'bandpass', f: 1500, q: 1.5 });
}
export function woof(): void {
	for (const at of [0, 0.25]) tone('sawtooth', [[0, 300], [0.1, 160]], { at, attack: 0.01, hold: 0.06, release: 0.08, gain: 0.16 }, { type: 'lowpass', f: 900, q: 2 });
}
export function squeak(): void {
	tone('sine', [[0, 1400], [0.12, 1900]], { at: 0, attack: 0.01, hold: 0.06, release: 0.06, gain: 0.08 });
}
/** Wooden "plop" of a shape dropping into the box. */
export function plop(): void {
	tone('sine', [[0, 380], [0.12, 140]], { at: 0, attack: 0.005, hold: 0.04, release: 0.18, gain: 0.25 });
	hiss(0, 0.06, 1800, 0.06, 1);
}
/** Gentle springy "boing" (bounce back, never a buzzer). */
export function boing(): void {
	tone('sine', [[0, 260], [0.1, 420], [0.3, 300]], { at: 0, attack: 0.01, hold: 0.12, release: 0.25, gain: 0.12 }, undefined, [14, 30]);
}

/** The call each animal makes when tapped. */
export const ANIMAL_CALL: Record<string, () => void> = { cow: moo, hen: cluck, duck: quack, goat: baa, sheep: baa, cat: meow, dog: woof, rabbit: squeak };

/** One soft "whup" of the rotor; `lift` (0–1) makes it a little higher and stronger. */
export function whup(lift = 0): void {
	hiss(0, 0.09, 180 + lift * 90, 0.09 + lift * 0.05, 0.9);
}
