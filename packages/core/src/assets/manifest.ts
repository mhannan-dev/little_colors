import { NARRATION_CATALOG } from '../audio/catalog.ts';
import { CLIPS } from '../audio/segments.ts';
import type { Locale } from '../types/colors.ts';

/** Spec 14 — every asset the apps use, with its status and license (AS-10..AS-12). */
export interface AssetEntry {
	key: string;
	path: string;
	kind: 'image' | 'audio' | 'animation' | 'font';
	status: 'placeholder' | 'final';
	license: string;
	note?: string;
}

const LOCALES: Locale[] = ['bn-BD', 'en-US'];

/**
 * Recording location for a narration key, e.g. "mix.result.red-yellow" →
 * audio/bn-BD/mix-result-red-yellow.mp3 (neutral variant: …-neutral.mp3).
 */
export function audioPathFor(key: string, locale: Locale, neutral = false): string {
	return `audio/${locale}/${key.replace(/\./g, '-')}${neutral ? '-neutral' : ''}.mp3`;
}

const VISUALS: AssetEntry[] = [
	{
		key: 'mascot.rumi',
		path: 'apps/desktop/src/lib/components/mascot/Mascot.svelte',
		kind: 'animation',
		status: 'placeholder',
		license: 'original',
		note: 'Code-drawn SVG tiger cub with 7 animation states (AS-20). Replace with final art.'
	},
	{
		key: 'image.football',
		path: 'apps/desktop/src/lib/components/football/Football.svelte',
		kind: 'image',
		status: 'placeholder',
		license: 'original'
	},
	{
		key: 'image.paint-container',
		path: 'apps/desktop/src/lib/components/paint/PaintContainer.svelte',
		kind: 'image',
		status: 'placeholder',
		license: 'original'
	},
	{
		key: 'image.goal',
		path: 'apps/desktop/src/lib/features/color-mixing/MixingScene.svelte',
		kind: 'image',
		status: 'placeholder',
		license: 'original'
	},
	{
		key: 'image.app-icon',
		path: 'apps/desktop/src-tauri/icons/',
		kind: 'image',
		status: 'placeholder',
		license: 'Tauri default icon (MIT/Apache-2.0)',
		note: 'Replace with a Little Colors icon before release.'
	},
	{
		key: 'font.hind-siliguri',
		path: '@fontsource/hind-siliguri',
		kind: 'font',
		status: 'final',
		license: 'OFL-1.1',
		note: 'Bundled locally via Fontsource (AS-51).'
	}
];

/** Narration recordings: none exist yet, so every line is a placeholder (Speech Synthesis / captions). */
const audio = (key: string, path: string, status: AssetEntry['status'] = 'placeholder'): AssetEntry => ({
	key,
	path,
	kind: 'audio',
	status,
	license: 'to be recorded (original)'
});

const NARRATION: AssetEntry[] = NARRATION_CATALOG.flatMap((entry) =>
	LOCALES.flatMap((locale) => [
		audio(`audio.${locale}.${entry.key}`, audioPathFor(entry.key, locale), entry.status),
		// Neutral variants play when Islamic expressions are off (AU-30), so they are assets too.
		...(entry.islamic
			? [audio(`audio.${locale}.${entry.key}.neutral`, audioPathFor(entry.key, locale, true), entry.status)]
			: [])
	])
);

/** Short Bengali clips that compose templated lines (segments.ts); number.N is already a line. */
const CLIP_AUDIO: AssetEntry[] = CLIPS.filter((c) => !NARRATION_CATALOG.some((e) => e.key === c.key)).map((c) =>
	audio(`audio.bn-BD.${c.key}`, audioPathFor(c.key, 'bn-BD'))
);

export const ASSET_MANIFEST: readonly AssetEntry[] = [...VISUALS, ...NARRATION, ...CLIP_AUDIO];

export function placeholders(manifest: readonly AssetEntry[] = ASSET_MANIFEST): AssetEntry[] {
	return manifest.filter((a) => a.status === 'placeholder');
}
