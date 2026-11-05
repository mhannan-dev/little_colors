import { createRng, shuffle } from '@little-colors/core';
import data from './countries.json';

export interface FlagCountry { id: string; label: { bn: string; en: string }; continent: string }
export const FLAG_COUNTRIES: readonly FlagCountry[] = data;
export const FLAG_REGIONS = [...new Set(FLAG_COUNTRIES.map(country => country.continent).filter(Boolean))].sort();
export const flagCountry = (id: string) => FLAG_COUNTRIES.find(country => country.id === id)!;

// Avoid asking children to distinguish identical or nearly identical flags.
const SIMILAR_FLAGS = [
	['fr', 'bl', 'gf', 'gp', 'mf', 'mq', 'pm', 're', 'yt'],
	['no', 'bv', 'sj'], ['us', 'um'], ['nl', 'bq'], ['ro', 'td'], ['id', 'mc']
];
export const flagFamily = (id: string) => SIMILAR_FLAGS.find(group => group.includes(id))?.[0] ?? id;
export interface FlagQuizState {
	seed: number; region: string; deck: string[]; index: number;
	phase: 'play' | 'correct' | 'finished'; attempts: number; hint: boolean; recognized: string[];
}
export type FlagQuizAction = { type: 'ANSWER'; id: string } | { type: 'HINT' } | { type: 'NEXT' } | { type: 'SKIP' };

export function createFlagQuiz(seed: number, region = 'all', firstId?: string, recognized: readonly string[] = []): FlagQuizState {
	const pool = FLAG_COUNTRIES.filter(country => region === 'all' || country.continent === region);
	if (!pool.length) throw new Error(`Unknown or empty flag region: ${region}`);
	let deck = shuffle(pool.map(country => country.id), createRng(seed));
	const first = firstId ?? (region === 'all' ? 'bd' : undefined);
	if (first && deck.includes(first)) deck = [first, ...deck.filter(id => id !== first)];
	return { seed, region, deck, index: 0, phase: 'play', attempts: 0, hint: false,
		recognized: [...new Set(recognized.filter(id => FLAG_COUNTRIES.some(country => country.id === id)))] };
}

export function flagChoices(state: FlagQuizState): FlagCountry[] {
	const current = state.deck[state.index]!;
	const rng = createRng((state.seed + state.index * 2654435761) >>> 0);
	const others = shuffle(FLAG_COUNTRIES.filter(country => flagFamily(country.id) !== flagFamily(current)), rng).slice(0, 3);
	return shuffle([flagCountry(current), ...others], rng);
}

export function flagQuizReducer(state: FlagQuizState, action: FlagQuizAction): FlagQuizState {
	if (state.phase === 'finished') return state;
	if (action.type === 'HINT') return state.phase === 'play' && !state.hint ? { ...state, hint: true } : state;
	if (action.type === 'ANSWER') {
		if (state.phase !== 'play' || !flagChoices(state).some(country => country.id === action.id)) return state;
		const current = state.deck[state.index]!;
		if (action.id !== current) {
			const attempts = state.attempts + 1;
			return { ...state, attempts, hint: state.hint || attempts >= 2 };
		}
		return { ...state, phase: 'correct', hint: false,
			recognized: state.recognized.includes(current) ? state.recognized : [...state.recognized, current] };
	}
	if ((action.type === 'NEXT' && state.phase !== 'correct') || (action.type === 'SKIP' && state.phase !== 'play')) return state;
	return state.index + 1 === state.deck.length ? { ...state, phase: 'finished', hint: false }
		: { ...state, index: state.index + 1, phase: 'play', attempts: 0, hint: false };
}

export function searchFlags(query: string, region = 'all'): FlagCountry[] {
	const needle = query.trim().toLocaleLowerCase();
	return FLAG_COUNTRIES.filter(country => (region === 'all' || country.continent === region) &&
		(!needle || [country.id, country.label.en, country.label.bn].some(value => value.toLocaleLowerCase().includes(needle))));
}
