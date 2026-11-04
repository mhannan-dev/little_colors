export const SHAPES = [
	{ key: 'football', bn: 'ফুটবল', en: 'football' },
	{ key: 'circle', bn: 'গোল', en: 'circle' },
	{ key: 'star', bn: 'তারা', en: 'star' },
	{ key: 'crescent', bn: 'চাঁদ', en: 'crescent moon' },
	{ key: 'square', bn: 'চারকোনা', en: 'square' },
	{ key: 'triangle', bn: 'তিনকোনা', en: 'triangle' },
	{ key: 'leaf', bn: 'পাতা', en: 'leaf' },
	{ key: 'apple', bn: 'আপেল', en: 'apple' }
] as const;
export type ShapeKey = (typeof SHAPES)[number]['key'];
