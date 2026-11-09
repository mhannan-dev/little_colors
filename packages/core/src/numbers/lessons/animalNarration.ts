import type { NarrationEntry } from '../../audio/voiceManifest.ts';

/** Photo file names (without .webp) in apps/desktop/static/images/. */
export const DETECTIVE_ANIMALS = [
	{ id: 'cat', bn: 'বিড়াল', en: 'Cat', plural: 'cats', photos: ['pexels-724211268-33585487', 'pexels-724211268-34345889'] },
	{ id: 'pigeon', bn: 'কবুতর', en: 'Pigeon', plural: 'pigeons', photos: ['pexels-altaf-shah-3143825-6438048'] },
	{ id: 'cow', bn: 'গরু', en: 'Cow', plural: 'cows', photos: ['pexels-christina99999-27009654'] },
	{ id: 'buffalo', bn: 'মহিষ', en: 'Buffalo', plural: 'buffaloes', photos: ['mohish-20211115090834'] },
	{ id: 'goat', bn: 'ছাগল', en: 'Goat', plural: 'goats', photos: ['pexels-christina99999-28607441'] },
	{ id: 'deer', bn: 'হরিণ', en: 'Deer', plural: 'deer', photos: ['pexels-gabriele-brancati-32566116-14138716', 'pexels-miguel-cuenca-67882473-18291217'] },
	{ id: 'lion', bn: 'সিংহ', en: 'Lion', plural: 'lions', photos: ['pexels-jay-brand-1763356224-32196368'] },
	{ id: 'tiger', bn: 'বাঘ', en: 'Tiger', plural: 'tigers', photos: ['pexels-raghavendra-narayan-2160151307-36530920', 'pexels-sunny67-38146597'] }
] as const;

export const ANIMAL_NARRATION: NarrationEntry[] = [
	{ key: 'mode.animals', bn: 'প্রাণী গোয়েন্দা', en: 'Animal Detective' },
	{ key: 'animals.name', bn: 'প্রাণী চিনি', en: 'Find the animal' },
	{ key: 'animals.intro', bn: 'রুমির সঙ্গে ছবির সূত্র খুঁজে প্রাণী চিনি আর গুনি।', en: 'Follow the photo clues with Rumi to find and count animals.' },
	{ key: 'animals.count', bn: 'প্রাণী গুনি', en: 'Count the animals' },
	// No scores or star counts (PR-07): praise the finding, not a tally.
	{ key: 'animals.correct', bn: 'বাহ, গোয়েন্দা! ঠিক খুঁজে পেয়েছ!', en: 'Well spotted, Detective! You found it!' },
	{ key: 'animals.retry', bn: 'আরেকবার ভালো করে দেখে চেষ্টা করি।', en: 'Take another look and try again.' },
	{ key: 'animals.hint', bn: 'চলো একসাথে দেখি! দাগ দেওয়া ছবিগুলো দেখো।', en: "Let's look together! Look at the marked pictures." },
	{ key: 'animals.next', bn: 'পরের প্রশ্ন', en: 'Next question' },
	{ key: 'animals.done', bn: 'অভিনন্দন! তুমি প্রাণী গোয়েন্দার ব্যাজ পেয়েছ!', en: 'Congratulations! You earned your Animal Detective badge!' },
	{ key: 'animals.again', bn: 'আবার খেলি', en: 'Play again' },
	...DETECTIVE_ANIMALS.flatMap(({ id, bn, en, plural }) => [
		{ key: `animals.find.${id}`, bn: `${bn} কোথায়? ছবিটি খুঁজে বের করো।`, en: `Where is the ${en.toLowerCase()}? Find its picture.` },
		{ key: `animals.count.${id}`, bn: `কয়টি ছবিতে ${bn} আছে? গুনে দেখো।`, en: `How many pictures show ${plural}? Count them.` }
	])
].map(entry => ({ ...entry, islamic: false, status: 'placeholder' }));
