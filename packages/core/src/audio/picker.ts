import type { NarrationEntry } from './voiceManifest.ts';

/** Game-picker groups (pictures + spoken names, PR-26). */
const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const PICKER_GROUPS = [
	{ id: 'learn', icon: '📚' },
	{ id: 'play', icon: '🎈' },
	{ id: 'drive', icon: '🚗' },
	{ id: 'older', icon: '🧒' }
] as const;
export type PickerGroup = (typeof PICKER_GROUPS)[number]['id'];

export const PICKER_NARRATION: NarrationEntry[] = [
	line('picker.group.learn', 'শিখি', "Let's learn"),
	line('picker.group.play', 'খেলি', "Let's play"),
	line('picker.group.drive', 'গাড়ি চালাই', "Let's drive"),
	line('picker.group.older', 'বড় ভাইবোনদের জন্য', 'For big brothers and sisters')
];
