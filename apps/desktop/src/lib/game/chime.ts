import { get } from 'svelte/store';
import { settings } from '#lib/stores/settings.ts';

/**
 * A short, soft "ting" for success moments (no audio files, works offline). Respects the sound
 * setting and volume; does nothing when muted. Never a buzzer: there is no "wrong" sound (PR-08).
 */
let ctx: AudioContext | null = null;

export function chime(kind: 'success' | 'big' = 'success'): void {
	const s = get(settings);
	const vol = s.soundEnabled ? s.volume : 0;
	if (!(vol > 0) || typeof window === 'undefined') return;
	try {
		ctx ??= new AudioContext();
		void ctx.resume();
		const notes = kind === 'big' ? [659, 784, 1047, 1319] : [784, 1175];
		const step = kind === 'big' ? 0.11 : 0.09;
		const t0 = ctx.currentTime;
		notes.forEach((f, i) => {
			const o = ctx!.createOscillator();
			const g = ctx!.createGain();
			o.type = 'sine';
			o.frequency.value = f;
			const at = t0 + i * step;
			g.gain.setValueAtTime(0, at);
			g.gain.linearRampToValueAtTime(0.16 * vol, at + 0.015);
			g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
			o.connect(g).connect(ctx!.destination);
			o.start(at);
			o.stop(at + 0.5);
		});
	} catch {
		/* no audio: fine */
	}
}
