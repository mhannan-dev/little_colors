import { createRng, shuffle } from '../../learning/rng.ts';
import type { PicnicPicture, ThinkingAgeBand } from './thinkingLessons.ts';

export const SHOP_STAGES = ['list', 'shelves', 'count', 'compare', 'silly'] as const;
export const SHOP_ITEMS: readonly PicnicPicture[] = ['apple', 'sandwich', 'bottle', 'napkin', 'sock'];
export type ShopShelf = 'food' | 'supplies';
export const shopShelf = (item: PicnicPicture): ShopShelf => item === 'apple' || item === 'sandwich' ? 'food' : 'supplies';
export interface ShopOrder { item: PicnicPicture; quantity: number }
export interface SillyShopPlan {
	ageBand: ThinkingAgeBand; seed: number; order: ShopOrder[]; shelves: PicnicPicture[];
	countGroups: number[]; countOptions: number[];
	left: number; right: number; comparison: 'more' | 'fewer'; lunch: PicnicPicture[];
}
export interface SillyShopProgress {
	stage: number; phase: 'intro' | 'observe' | 'play' | 'complete' | 'finished';
	basket: Partial<Record<PicnicPicture, number>>; sorted: PicnicPicture[];
	completed: number; hint: boolean; feedbackKey: string;
}
export type SillyShopAction = { type: 'BEGIN' } | { type: 'HIDE' } | { type: 'PEEK' } |
	{ type: 'ADD'; item: PicnicPicture } | { type: 'SHELVE'; shelf: ShopShelf } |
	{ type: 'COUNT'; value: number } | { type: 'COMPARE'; side: 'left' | 'right' } |
	{ type: 'FIX'; item: PicnicPicture } | { type: 'NEXT' } | { type: 'RESET' } | { type: 'HINT' };

export function createSillyShop(ageBand: ThinkingAgeBand, seed: number): SillyShopPlan {
	const rng = createRng(seed), older = ageBand === '8-10';
	const order = shuffle(['apple', 'sandwich', 'bottle', 'napkin'] as const, rng).slice(0, older ? 3 : 2)
		.map((item) => ({ item, quantity: older ? 1 + Math.floor(rng() * 2) : 1 }));
	const countGroups = older ? [2 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 4)] : [2 + Math.floor(rng() * 4)];
	const total = countGroups.reduce((sum, n) => sum + n, 0);
	const smaller = 1 + Math.floor(rng() * (older ? 5 : 3));
	const larger = smaller + 1 + Math.floor(rng() * (older ? 3 : 2));
	const swap = rng() < .5;
	return { ageBand, seed, order, shelves: shuffle(SHOP_ITEMS, rng).slice(0, older ? 5 : 4), countGroups,
		countOptions: shuffle([total - 1, total, total + 1], rng), left: swap ? smaller : larger, right: swap ? larger : smaller,
		comparison: rng() < .5 ? 'more' : 'fewer', lunch: shuffle(['apple', 'sock', 'sandwich'] as const, rng) };
}
export function initialSillyShopProgress(): SillyShopProgress {
	return { stage: 0, phase: 'intro', basket: {}, sorted: [], completed: 0, hint: false, feedbackKey: 'shop.story.list' };
}
const complete = (state: SillyShopProgress): SillyShopProgress => ({ ...state, phase: 'complete', completed: state.completed + 1, hint: false, feedbackKey: 'shop.complete' });
export function sillyShopReducer(plan: SillyShopPlan, state: SillyShopProgress, action: SillyShopAction): SillyShopProgress {
	if (action.type === 'BEGIN') return state.phase === 'intro' ? { ...state, phase: state.stage === 0 ? 'observe' : 'play', feedbackKey: `shop.instruction.${SHOP_STAGES[state.stage]}` } : state;
	if (action.type === 'NEXT') return state.phase !== 'complete' ? state : state.stage === SHOP_STAGES.length - 1
		? { ...state, phase: 'finished', feedbackKey: 'shop.done' }
		: { ...state, stage: state.stage + 1, phase: 'intro', hint: false, feedbackKey: `shop.story.${SHOP_STAGES[state.stage + 1]}` };
	if (action.type === 'RESET') return state.phase === 'play' || state.phase === 'observe'
		? { ...state, phase: state.stage === 0 ? 'observe' : 'play', basket: state.stage === 0 ? {} : state.basket, sorted: state.stage === 1 ? [] : state.sorted, hint: false, feedbackKey: `shop.instruction.${SHOP_STAGES[state.stage]}` } : state;
	if (action.type === 'HIDE') return state.stage === 0 && state.phase === 'observe' ? { ...state, phase: 'play', feedbackKey: 'shop.list.recall' } : state;
	if (action.type === 'PEEK') return state.stage === 0 && state.phase === 'play' ? { ...state, phase: 'observe', hint: false, feedbackKey: 'shop.instruction.list' } : state;
	if (state.phase !== 'play') return state;
	if (action.type === 'HINT') return { ...state, hint: true, feedbackKey: `shop.hint.${SHOP_STAGES[state.stage]}` };
	if (action.type === 'ADD' && state.stage === 0) {
		const requested = plan.order.find((entry) => entry.item === action.item);
		if (!requested || (state.basket[action.item] ?? 0) >= requested.quantity) return { ...state, feedbackKey: 'shop.retry' };
		const basket = { ...state.basket, [action.item]: (state.basket[action.item] ?? 0) + 1 };
		const next = { ...state, basket, feedbackKey: 'shop.added', hint: false };
		return plan.order.every((entry) => basket[entry.item] === entry.quantity) ? complete(next) : next;
	}
	if (action.type === 'SHELVE' && state.stage === 1) {
		const item = plan.shelves[state.sorted.length];
		if (!item || action.shelf !== shopShelf(item)) return { ...state, feedbackKey: 'shop.retry' };
		const next = { ...state, sorted: [...state.sorted, item], hint: false, feedbackKey: 'shop.sorted' };
		return next.sorted.length === plan.shelves.length ? complete(next) : next;
	}
	let correct: boolean;
	if (action.type === 'COUNT' && state.stage === 2) correct = action.value === plan.countGroups.reduce((sum, n) => sum + n, 0);
	else if (action.type === 'COMPARE' && state.stage === 3) {
		const side = plan.comparison === 'more' ? plan.left > plan.right ? 'left' : 'right' : plan.left < plan.right ? 'left' : 'right';
		correct = action.side === side;
	} else if (action.type === 'FIX' && state.stage === 4) correct = action.item === 'sock';
	else return state;
	return correct ? complete(state) : { ...state, feedbackKey: 'shop.retry' };
}
