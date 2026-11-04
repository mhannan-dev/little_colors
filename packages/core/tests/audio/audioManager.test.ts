import { describe, expect, it } from 'vitest';
import { createAudioManager, type AudioSettings } from '../../src/audio/audioManager.ts';
import type { AudioPlayer, PlaybackResult, SpeechFallback } from '../../src/audio/types.ts';

/** Controllable fakes: each play/speak call waits until the test ends it. */
function setup(over: Partial<AudioSettings> = {}, opts: { files?: boolean; voice?: boolean } = {}) {
	const log: string[] = [];
	const pending: ((r: PlaybackResult) => void)[] = [];
	const settings: AudioSettings = {
		locale: 'bn-BD',
		soundEnabled: true,
		islamicExpressionsEnabled: true,
		volume: 0.8,
		...over
	};
	const player: AudioPlayer & { muted: boolean } = {
		muted: false,
		play(src) {
			log.push(`play:${src}`);
			return new Promise((r) => pending.push(r));
		},
		stopAll() {
			log.push('player.stopAll');
			for (const r of pending.splice(0)) r('stopped');
		},
		setMuted(m) {
			this.muted = m;
		}
	};
	const speech: SpeechFallback = {
		isAvailable: async () => opts.voice ?? true,
		speak(text) {
			log.push(`speak:${text}`);
			return new Promise((r) => pending.push(r));
		},
		stop() {
			log.push('speech.stop');
			for (const r of pending.splice(0)) r('stopped');
		}
	};
	const captions: string[] = [];
	const manager = createAudioManager({
		player,
		speech,
		resolveFile: (key) => (opts.files ? `audio/${key}.mp3` : null),
		getSettings: () => settings,
		onCaption: (t) => captions.push(t)
	});
	const finish = async (r: PlaybackResult = 'ended') => {
		await flush();
		pending.shift()?.(r);
		await flush();
	};
	return { manager, log, captions, settings, player, finish };
}

/** Drain pending microtasks (core has no DOM/Node timer typings by design). */
const flush = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('audio manager (spec 08)', () => {
	it('plays queued lines one at a time, in order (AU-01, AU-02)', async () => {
		const { manager, log, finish } = setup({}, { files: true });
		const a = manager.narrate('color.red');
		const b = manager.narrate('color.yellow');
		await flush();
		expect(log).toEqual(['play:audio/color.red.mp3']);
		await finish();
		await a;
		expect(log).toEqual(['play:audio/color.red.mp3', 'play:audio/color.yellow.mp3']);
		await finish();
		await b;
	});

	it('interrupt cancels the current line and the queue (AU-03)', async () => {
		const { manager, log, finish } = setup({}, { files: true });
		const a = manager.narrate('color.red');
		const b = manager.narrate('color.yellow');
		await flush();
		const c = manager.narrate('color.blue', { mode: 'interrupt' });
		await a;
		await b;
		await flush();
		expect(log).toContain('player.stopAll');
		expect(log).not.toContain('play:audio/color.yellow.mp3');
		expect(log.at(-1)).toBe('play:audio/color.blue.mp3');
		await finish();
		await c;
	});

	it('always publishes the caption, even when muted (AU-10)', async () => {
		const { manager, log, captions } = setup({ soundEnabled: false }, { files: true });
		await manager.narrate('color.red');
		expect(captions).toEqual(['এটা লাল রং!']);
		expect(log).toEqual([]);
	});

	it('falls back from a failed file to speech (AU-08)', async () => {
		const { manager, log, finish } = setup({}, { files: true });
		const p = manager.narrate('color.red');
		await finish('failed');
		expect(log).toEqual(['play:audio/color.red.mp3', 'speak:এটা লাল রং!']);
		await finish();
		await p;
	});

	it('uses speech when no recording exists, and is silent without a voice', async () => {
		const withVoice = setup();
		const p = withVoice.manager.narrate('color.red');
		await flush();
		expect(withVoice.log).toEqual(['speak:এটা লাল রং!']);
		await withVoice.finish();
		await p;

		const noVoice = setup({}, { voice: false });
		await noVoice.manager.narrate('color.red');
		expect(noVoice.log).toEqual([]);
		expect(noVoice.captions).toEqual(['এটা লাল রং!']);
	});

	it('uses neutral variants when Islamic expressions are off (AU-30)', async () => {
		const { manager, captions } = setup({ soundEnabled: false, islamicExpressionsEnabled: false });
		await manager.narrate('feedback.celebrate');
		expect(captions).toEqual(['খুব সুন্দর!']);
	});

	it('replays the last instruction (AU-07)', async () => {
		const { manager, captions } = setup({ soundEnabled: false });
		await manager.instruct('mix.intro.red-yellow');
		await manager.narrate('color.red');
		await manager.replayInstruction();
		expect(captions).toEqual([
			'লাল আর হলুদ রং মেশাই!',
			'এটা লাল রং!',
			'লাল আর হলুদ রং মেশাই!'
		]);
	});

	it('stopAll resolves every pending promise and plays nothing more (AU-06)', async () => {
		const { manager, log } = setup({}, { files: true });
		const all = [manager.narrate('color.red'), manager.narrate('color.yellow')];
		await flush();
		manager.stopAll();
		await Promise.all(all);
		await flush();
		expect(log.filter((l) => l.startsWith('play:'))).toEqual(['play:audio/color.red.mp3']);
	});

	it('ignores unknown keys without throwing', async () => {
		const { manager, captions } = setup();
		await manager.narrate('does.not.exist');
		expect(captions).toEqual([]);
	});

	it('mute is forwarded to the player and stops speech (AU-04)', () => {
		const { manager, player, log } = setup();
		manager.setMuted(true);
		expect(player.muted).toBe(true);
		expect(log).toContain('speech.stop');
	});
});
