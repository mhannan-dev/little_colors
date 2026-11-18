import { get } from 'svelte/store';
import { settings } from '#lib/stores/settings.ts';
import { caption, stopNarration } from '#lib/audio/narrator.ts';

/** Local speech when a matching voice is installed; picture prompts always remain available. */
export function createSafariAudio() {
	let context: AudioContext | null = null;
	let utterance: SpeechSynthesisUtterance | null = null;
	const oscillators = new Set<OscillatorNode>();
	function stop() {
		if (utterance && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
		utterance = null;
		for (const oscillator of oscillators) { try { oscillator.stop(); } catch { /* already ended */ } }
		oscillators.clear();
	}
	function speak(text: string) {
		stop(); stopNarration(); caption.set(text);
		const s = get(settings);
		if (!s.soundEnabled || s.volume <= 0 || typeof speechSynthesis === 'undefined') return;
		const prefix = s.language === 'bn-BD' ? 'bn' : 'en';
		const voice = speechSynthesis.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith(prefix));
		if (!voice) return;
		utterance = new SpeechSynthesisUtterance(text);
		utterance.voice = voice; utterance.lang = s.language; utterance.rate = 0.85; utterance.pitch = 1.05; utterance.volume = s.volume;
		speechSynthesis.speak(utterance);
	}
	/** Gentle synthesized toy calls, intentionally kept short and quiet. */
	function call(animal: string) {
		stop();
		const s = get(settings);
		if (!s.soundEnabled || s.volume <= 0) return;
		try {
			context ??= new AudioContext(); void context.resume();
			const c = context, at = c.currentTime + 0.02;
			const notes = animal === 'elephant' ? [310, 490, 370] : animal === 'lion' ? [110, 85, 105] : [540, 670, 580];
			for (let i = 0; i < notes.length; i++) {
				const oscillator = c.createOscillator(), gain = c.createGain(), filter = c.createBiquadFilter();
				oscillator.type = animal === 'lion' ? 'sawtooth' : 'triangle';
				oscillator.frequency.setValueAtTime(notes[i], at + i * 0.18);
				oscillator.frequency.linearRampToValueAtTime(notes[i] * 0.75, at + i * 0.18 + 0.3);
				filter.type = 'lowpass'; filter.frequency.value = animal === 'lion' ? 440 : 1400;
				gain.gain.setValueAtTime(0, at + i * 0.18);
				gain.gain.linearRampToValueAtTime(s.volume * 0.09, at + i * 0.18 + 0.05);
				gain.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.18 + 0.4);
				oscillator.connect(filter).connect(gain).connect(c.destination);
				oscillators.add(oscillator); oscillator.onended = () => { oscillators.delete(oscillator); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
				oscillator.start(at + i * 0.18); oscillator.stop(at + i * 0.18 + 0.45);
			}
		} catch { /* Sound is optional; all tasks have pictures and captions. */ }
	}
	return { speak, call, stop, dispose() { stop(); if (context) void context.close(); context = null; } };
}
