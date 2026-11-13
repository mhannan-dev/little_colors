import type { NarrationEntry } from './voiceManifest.ts';

/**
 * Game-picker categories (pictures + spoken names, PR-26). Each game belongs to exactly one.
 * The picker shows them as headings and as tap-to-filter buttons, so a child (or a parent) can
 * see a few big choices at a time.
 */
const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const PICKER_GROUPS = [
	{ id: 'shapes', icon: '🎨' },
	{ id: 'letters', icon: '🔤' },
	{ id: 'world', icon: '🌍' },
	{ id: 'faith', icon: '🕌' },
	{ id: 'habits', icon: '🪥' },
	{ id: 'build', icon: '🧱' },
	{ id: 'fun', icon: '⚽' },
	{ id: 'drive', icon: '🚗' },
	{ id: 'older', icon: '🧒' }
] as const;
export type PickerGroup = (typeof PICKER_GROUPS)[number]['id'];

export const PICKER_NARRATION: NarrationEntry[] = [
	line('picker.all', 'সব খেলা', 'All games'),
	line('picker.group.shapes', 'রং আর আকৃতি', 'Colours and shapes'),
	line('picker.group.letters', 'অক্ষর আর সংখ্যা', 'Letters and numbers'),
	line('picker.group.world', 'চারপাশ চিনি', 'Our world'),
	line('picker.group.faith', 'ইসলামিক', 'Islamic'),
	line('picker.group.habits', 'ভালো অভ্যাস', 'Good habits'),
	line('picker.group.build', 'বানাই', "Let's build"),
	line('picker.group.fun', 'মজার খেলা', 'Fun games'),
	line('picker.group.drive', 'গাড়ি চালাই', "Let's drive"),
	line('picker.group.older', 'বড় ভাইবোনদের জন্য', 'For big brothers and sisters')
];
