import { NARRATION_CATALOG } from '../audio/catalog.ts';
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

/** Recording location for a narration key, e.g. "mix.result.red-yellow" → audio/bn-BD/mix-result-red-yellow.mp3 */
export function audioPathFor(key: string, locale: Locale): string {
	return `audio/${locale}/${key.replace(/\./g, '-')}.mp3`;
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
const NARRATION: AssetEntry[] = NARRATION_CATALOG.flatMap((entry) =>
	LOCALES.map(
		(locale): AssetEntry => ({
			key: `audio.${locale}.${entry.key}`,
			path: audioPathFor(entry.key, locale),
			kind: 'audio',
			status: entry.status,
			license: 'to be recorded (original)'
		})
	)
);

export const ASSET_MANIFEST: readonly AssetEntry[] = [...VISUALS, ...NARRATION];

export function placeholders(manifest: readonly AssetEntry[] = ASSET_MANIFEST): AssetEntry[] {
	return manifest.filter((a) => a.status === 'placeholder');
}
