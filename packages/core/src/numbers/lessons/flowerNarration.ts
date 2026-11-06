import type { NarrationEntry } from '../../audio/voiceManifest.ts';

export const LEARNING_FLOWERS = [
	{ id: 'rose', bn: 'গোলাপ', en: 'Rose' },
	{ id: 'water-lily', bn: 'শাপলা', en: 'Water lily' },
	{ id: 'sunflower', bn: 'সূর্যমুখী', en: 'Sunflower' },
	{ id: 'marigold', bn: 'গাঁদা', en: 'Marigold' },
	{ id: 'jasmine', bn: 'জুঁই', en: 'Jasmine' },
	{ id: 'hibiscus', bn: 'জবা', en: 'Hibiscus' }
] as const;

export type LearningFlowerId = (typeof LEARNING_FLOWERS)[number]['id'];

export const FLOWER_NARRATION: NarrationEntry[] = [
	{ key: 'mode.flower', bn: 'ফুল চিনি ও গুনি', en: 'Flowers: Learn & Count' },
	{ key: 'flower.title', bn: 'রুমির ফুলের বাগান', en: 'Rumi’s Flower Garden' },
	{ key: 'flower.learn', bn: 'ফুল দেখি', en: 'Explore flowers' },
	{ key: 'flower.name', bn: 'ফুল চিনি', en: 'Name the flower' },
	{ key: 'flower.count', bn: 'ফুল গুনি', en: 'Count the flowers' },
	{ key: 'flower.explore', bn: 'ফুলের ছবি বেছে তার বাংলা আর ইংরেজি নাম শিখি।', en: 'Choose a flower picture to learn its Bengali and English names.' },
	{ key: 'flower.question.name', bn: 'ছবিতে কোন ফুলটি আছে? তার নাম বেছে নাও।', en: 'Which flower is in the picture? Choose its name.' },
	{ key: 'flower.question.count', bn: 'একটি করে ফুলের ছবিতে চাপ দাও। মোট কয়টি ছবি আছে?', en: 'Tap each flower picture once. How many pictures are there?' },
	{ key: 'flower.listen', bn: 'নাম শুনি', en: 'Hear the name' },
	{ key: 'flower.correct', bn: 'মিলেছে! তৈরি হলে পরের ফুলে যাই।', en: 'That matches! Continue when you’re ready.' },
	{ key: 'flower.retry', bn: 'আরেকবার দেখে চেষ্টা করি।', en: 'Take another look and try again.' },
	{ key: 'flower.hint', bn: 'দাগ দেওয়া উত্তরটি দেখে মিলিয়ে নাও।', en: 'Look at the outlined choice to help you match.' },
	{ key: 'flower.help', bn: 'একটু সাহায্য', en: 'Show a hint' },
	{ key: 'flower.next', bn: 'পরের ফুল', en: 'Next flower' },
	{ key: 'flower.done', bn: 'ছয়টি ফুলের খেলা শেষ! রুমি তোমাকে ফুল দিল।', en: 'You finished six flower puzzles! Rumi picked a flower for you.' },
	...LEARNING_FLOWERS.map(flower => ({ ...flower, key: `flower.label.${flower.id}` }))
].map(entry => ({ ...entry, islamic: false, status: 'placeholder' }));
