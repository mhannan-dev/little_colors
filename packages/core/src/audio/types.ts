import type { Locale } from '../types/colors.ts';

export type PlaybackResult = 'ended' | 'stopped' | 'failed';

export interface AudioPlayer {
	play(src: string, opts?: { volume?: number }): Promise<PlaybackResult>;
	stopAll(): void;
	setMuted(muted: boolean): void;
}

export interface SpeechFallback {
	isAvailable(locale: Locale): Promise<boolean>;
	speak(text: string, locale: Locale): Promise<PlaybackResult>;
	stop(): void;
}
