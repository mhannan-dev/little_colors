import type { Locale } from '@little-colors/core';

/** Short UI labels (not narration). Narration lives in core's voiceManifest (AR-04). */
const UI = {
	play: { bn: 'খেলি', en: 'Play' },
	back: { bn: 'ফিরে যাই', en: 'Back' },
	replayInstruction: { bn: 'আবার শুনি', en: 'Hear again' },
	soundOn: { bn: 'শব্দ চালু', en: 'Sound on' },
	soundOff: { bn: 'শব্দ বন্ধ', en: 'Sound off' },
	next: { bn: 'পরেরটা', en: 'Next' },
	reset: { bn: 'আবার শুরু', en: 'Start over' },
	replayRound: { bn: 'আবার খেলি', en: 'Play again' },
	chooseGame: { bn: 'অন্য খেলা', en: 'Another game' },
	chooseMode: { bn: 'কোন খেলা খেলবে?', en: 'Which game?' },
	appName: { bn: 'ছোট্ট রং', en: 'Little Colors' },
	hint: { bn: 'সাহায্য', en: 'Help me' },
	place: { bn: 'জায়গা', en: 'Place' }
} as const;

export type UiKey = keyof typeof UI;

export function t(key: UiKey, locale: Locale): string {
	return locale === 'bn-BD' ? UI[key].bn : UI[key].en;
}
