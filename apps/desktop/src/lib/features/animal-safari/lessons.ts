export type AnimalId = 'elephant' | 'lion' | 'giraffe' | 'rabbit';
export type FoodId = 'carrot' | 'grass' | 'leaves';
export type SafariMode = 'adventure' | 'animals' | 'count' | 'food';
export const ANIMALS = {
	elephant: { en: 'Elephant', bn: 'হাতি', icon: '🐘' },
	lion: { en: 'Lion', bn: 'সিংহ', icon: '🦁' },
	giraffe: { en: 'Giraffe', bn: 'জিরাফ', icon: '🦒' },
	rabbit: { en: 'Rabbit', bn: 'খরগোশ', icon: '🐰' }
} as const;
export const FOODS = {
	carrot: { en: 'Carrot', bn: 'গাজর', icon: '🥕' },
	grass: { en: 'Grass', bn: 'ঘাস', icon: '🌱' },
	leaves: { en: 'Leaves', bn: 'পাতা', icon: '🍃' }
} as const;
export const MODES = [
	{ id: 'adventure', en: 'Little safari', bn: 'ছোট্ট সাফারি', icon: '🚙', detail: 'Explore, listen, count and feed', detailBn: 'খুঁজি, শুনি, গুনি আর খাবার দিই' },
	{ id: 'animals', en: 'Animal explorer', bn: 'প্রাণী খুঁজি', icon: '🐘', detail: 'Meet our animal friends', detailBn: 'প্রাণী বন্ধুদের সঙ্গে দেখা করি' },
	{ id: 'count', en: 'Count together', bn: 'একসঙ্গে গুনি', icon: '🐰', detail: 'One little rabbit at a time', detailBn: 'একটি একটি করে খরগোশ গুনি' },
	{ id: 'food', en: 'Snack time', bn: 'খাবারের সময়', icon: '🥕', detail: 'Find the snack in the picture', detailBn: 'ছবির খাবারটি খুঁজে দিই' }
] as const;
export type SafariLesson = {
	kind: 'find' | 'listen' | 'count' | 'food';
	animal: AnimalId;
	options: AnimalId[];
	count?: number;
	food?: FoodId;
};
const find = (animal: AnimalId, listen = false): SafariLesson => ({
	kind: listen ? 'listen' : 'find', animal,
	options: animal === 'rabbit' ? ['lion', 'rabbit', 'giraffe']
		: animal === 'giraffe' ? ['elephant', 'giraffe', 'lion'] : ['rabbit', animal, animal === 'lion' ? 'elephant' : 'lion']
});
const count = (n: number): SafariLesson => ({ kind: 'count', animal: 'rabbit', count: n, options: Array.from({ length: n }, () => 'rabbit') });
const food = (animal: AnimalId, snack: FoodId): SafariLesson => ({ kind: 'food', animal, food: snack, options: [animal] });
export function createSafari(mode: SafariMode): SafariLesson[] {
	if (mode === 'count') return [1, 2, 3, 4, 5].map(count);
	if (mode === 'food') return [food('rabbit', 'carrot'), food('elephant', 'grass'), food('giraffe', 'leaves'), food('rabbit', 'carrot'), food('elephant', 'leaves')];
	if (mode === 'animals') return [find('elephant'), find('lion', true), find('rabbit'), find('giraffe'), find('elephant', true)];
	return [find('elephant'), find('lion', true), count(3), food('rabbit', 'carrot'), find('giraffe')];
}

export function animalPositions(lesson: SafariLesson): { id: number; animal: AnimalId; x: number; z: number }[] {
	return lesson.options.map((animal, id) => {
		if (lesson.options.length <= 3) return { id, animal, x: (id - (lesson.options.length - 1) / 2) * 4.5, z: -2 };
		const row = id < 2 ? 0 : 1;
		const column = row === 0 ? id : id - 2;
		const length = row === 0 ? 2 : lesson.options.length - 2;
		return { id, animal, x: (column - (length - 1) / 2) * 4.3, z: row === 0 ? -6 : 0.4 };
	});
}
