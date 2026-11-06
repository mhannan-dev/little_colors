import { PICTURE_FLAGS, createRng, shuffle } from '@little-colors/core';
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

export function flagQuizReducer(
	state: FlagQuizState,
	action: FlagQuizAction,
	choices: (state: FlagQuizState) => FlagCountry[] = flagChoices
): FlagQuizState {
	if (state.phase === 'finished') return state;
	if (action.type === 'HINT') return state.phase === 'play' && !state.hint ? { ...state, hint: true } : state;
	if (action.type === 'ANSWER') {
		if (state.phase !== 'play' || !choices(state).some(country => country.id === action.id)) return state;
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

// ── Picture mode (PR-27): hear a country, pick its flag from three pictures ─────────────
// Uses the short familiar list from core (PICTURE_FLAGS) so a 3–6-year-old can succeed.
export const PICTURE_ROUND_LENGTH = 8;
const PICTURE_IDS: readonly string[] = PICTURE_FLAGS.map((f) => f.id);

/** A round of familiar flags, Bangladesh first, no repeats. */
export function createPictureQuiz(seed: number, recognized: readonly string[] = []): FlagQuizState {
	const rest = shuffle(PICTURE_IDS.filter((id) => id !== 'bd'), createRng(seed));
	const deck = ['bd', ...rest].slice(0, PICTURE_ROUND_LENGTH);
	return { ...createFlagQuiz(seed, 'all', 'bd', recognized), region: 'pictures', deck };
}

/** Three flag pictures from the familiar list, never two from the same look-alike family. */
export function pictureChoices(state: FlagQuizState): FlagCountry[] {
	const current = state.deck[state.index]!;
	const rng = createRng((state.seed + state.index * 2654435761) >>> 0);
	const others = shuffle(PICTURE_IDS.filter((id) => flagFamily(id) !== flagFamily(current)), rng).slice(0, 2);
	return shuffle([current, ...others], rng).map(flagCountry);
}
