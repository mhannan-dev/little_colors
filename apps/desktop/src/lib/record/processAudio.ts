/**
 * Turn a raw microphone take into a clean, small clip for the app:
 * mono → trim leading/trailing silence → normalize loudness → 22.05 kHz 16-bit WAV.
 * Pure browser APIs, no extra dependencies.
 */
export const SAMPLE_RATE = 22_050;
const PAD_S = 0.12; // keep a little breath before/after speech
const FADE_S = 0.01;
const TARGET_PEAK = 0.89;

export interface ProcessedTake {
	wav: Blob;
	seconds: number;
	/** Peak level of the raw take, 0..1: low means too quiet, ~1 means clipping. */
	rawPeak: number;
	tooQuiet: boolean;
	clipped: boolean;
}

function mixToMono(buf: AudioBuffer): Float32Array {
	const out = new Float32Array(buf.length);
	for (let ch = 0; ch < buf.numberOfChannels; ch++) {
		const data = buf.getChannelData(ch);
		for (let i = 0; i < data.length; i++) out[i]! += data[i]! / buf.numberOfChannels;
	}
	return out;
}

/** First/last sample index whose short-window RMS exceeds the speech threshold. */
function speechBounds(x: Float32Array, rate: number, peak: number): [number, number] {
	const win = Math.max(1, Math.round(rate * 0.02));
	const threshold = Math.max(0.01, peak * 0.08);
	const loud = (start: number) => {
		let sum = 0;
		const end = Math.min(x.length, start + win);
		for (let i = start; i < end; i++) sum += x[i]! * x[i]!;
		return Math.sqrt(sum / Math.max(1, end - start)) > threshold;
	};
	let first = 0;
	while (first < x.length && !loud(first)) first += win;
	let last = x.length - win;
	while (last > first && !loud(last)) last -= win;
	if (first >= x.length) return [0, x.length]; // all quiet: keep everything
	const pad = Math.round(rate * PAD_S);
	return [Math.max(0, first - pad), Math.min(x.length, last + win + pad)];
}

async function resample(x: Float32Array, fromRate: number): Promise<Float32Array> {
	if (fromRate === SAMPLE_RATE) return x;
	const length = Math.max(1, Math.round((x.length * SAMPLE_RATE) / fromRate));
	const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE);
	const src = ctx.createBuffer(1, x.length, fromRate);
	src.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
	const node = ctx.createBufferSource();
	node.buffer = src;
	node.connect(ctx.destination);
	node.start();
	return (await ctx.startRendering()).getChannelData(0);
}

export function encodeWav(samples: Float32Array, rate = SAMPLE_RATE): Blob {
	const bytes = new ArrayBuffer(44 + samples.length * 2);
	const v = new DataView(bytes);
	const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
	str(0, 'RIFF');
	v.setUint32(4, 36 + samples.length * 2, true);
	str(8, 'WAVE');
	str(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); // PCM
	v.setUint16(22, 1, true); // mono
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	str(36, 'data');
	v.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]!));
		v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
	}
	return new Blob([bytes], { type: 'audio/wav' });
}

export async function processTake(raw: Blob): Promise<ProcessedTake> {
	const ctx = new AudioContext();
	try {
		const decoded = await ctx.decodeAudioData(await raw.arrayBuffer());
		const mono = mixToMono(decoded);
		let rawPeak = 0;
		for (const s of mono) rawPeak = Math.max(rawPeak, Math.abs(s));

		const [a, b] = speechBounds(mono, decoded.sampleRate, rawPeak);
		const trimmed = await resample(mono.slice(a, b), decoded.sampleRate);

		let peak = 0;
		for (const s of trimmed) peak = Math.max(peak, Math.abs(s));
		const gain = peak > 0 ? Math.min(TARGET_PEAK / peak, 8) : 1;
		const fade = Math.round(SAMPLE_RATE * FADE_S);
		for (let i = 0; i < trimmed.length; i++) {
			const edge = Math.min(1, i / fade, (trimmed.length - 1 - i) / fade);
			trimmed[i] = trimmed[i]! * gain * Math.max(0, edge);
		}
		return {
			wav: encodeWav(trimmed),
			seconds: trimmed.length / SAMPLE_RATE,
			rawPeak,
			tooQuiet: rawPeak < 0.08,
			clipped: rawPeak > 0.99
		};
	} finally {
		void ctx.close();
	}
}
