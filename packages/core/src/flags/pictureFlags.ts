import type { NarrationEntry } from '../audio/voiceManifest.ts';

/**
 * Flag game picture mode (PR-27): the child hears "Which is Bangladesh's flag?" and picks
 * one of three flag pictures — no reading needed. A short list of flags familiar to young
 * children in Bangladesh, each with a hand-written Bengali possessive (বাংলাদেশের, কানাডার …),
 * because the suffix depends on how the name ends.
 * Ids match the flag game's ISO codes (apps/desktop/src/lib/features/flag/countries.json).
 */
export const PICTURE_FLAGS = [
	{ id: 'bd', of: 'বাংলাদেশের', en: 'Bangladesh' },
	{ id: 'in', of: 'ভারতের', en: 'India' },
	{ id: 'pk', of: 'পাকিস্তানের', en: 'Pakistan' },
	{ id: 'sa', of: 'সৌদি আরবের', en: 'Saudi Arabia' },
	{ id: 'tr', of: 'তুরস্কের', en: 'Türkiye' },
	{ id: 'my', of: 'মালয়েশিয়ার', en: 'Malaysia' },
	{ id: 'jp', of: 'জাপানের', en: 'Japan' },
	{ id: 'cn', of: 'চীনের', en: 'China' },
	{ id: 'kr', of: 'দক্ষিণ কোরিয়ার', en: 'South Korea' },
	{ id: 'np', of: 'নেপালের', en: 'Nepal' },
	{ id: 'lk', of: 'শ্রীলঙ্কার', en: 'Sri Lanka' },
	{ id: 'ae', of: 'সংযুক্ত আরব আমিরাতের', en: 'the United Arab Emirates' },
	{ id: 'us', of: 'মার্কিন যুক্তরাষ্ট্রের', en: 'the United States' },
	{ id: 'ca', of: 'কানাডার', en: 'Canada' },
	{ id: 'br', of: 'ব্রাজিলের', en: 'Brazil' },
	{ id: 'ar', of: 'আর্জেন্টিনার', en: 'Argentina' },
	{ id: 'gb', of: 'যুক্তরাজ্যের', en: 'the United Kingdom' },
	{ id: 'de', of: 'জার্মানির', en: 'Germany' },
	{ id: 'fr', of: 'ফ্রান্সের', en: 'France' },
	{ id: 'au', of: 'অস্ট্রেলিয়ার', en: 'Australia' }
] as const;

export type PictureFlagId = (typeof PICTURE_FLAGS)[number]['id'];

const line = (key: string, bn: string, en: string): NarrationEntry => ({
	key,
	bn,
	en,
	islamic: false,
	status: 'placeholder'
});

export const FLAG_NARRATION: NarrationEntry[] = [
	line('flags.pictures', 'পতাকা খুঁজি', 'Find the flag'),
	line('flags.correct', 'ঠিক ধরেছ! এটাই সেই পতাকা!', "Yes! That's the flag!"),
	line('flags.done', 'দারুণ! সব পতাকা খুঁজে পেয়েছ!', 'Great! You found all the flags!'),
	...PICTURE_FLAGS.map((f) => line(`flags.find.${f.id}`, `${f.of} পতাকা কোনটা?`, `Which is the flag of ${f.en}?`))
];
