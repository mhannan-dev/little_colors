import { writable } from 'svelte/store';

/**
 * Ghost hand (PR-25): shows a non-reading child what to do by pointing, tapping,
 * or dragging between on-screen elements. Rendered once by GhostHand in the layout.
 */
export interface HandPath {
	id: number;
	/** Viewport coordinates (px) of each stop; one stop = tap, two+ = drag/move. */
	points: { x: number; y: number }[];
	drag: boolean;
}

export const hand = writable<HandPath | null>(null);

let nextId = 1;

function centre(selector: string): { x: number; y: number } | null {
	const el = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(selector);
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Point at elements in order. `drag: true` moves from the first to the last while "holding";
 * otherwise the hand taps each one. Missing elements are skipped.
 */
export function showHand(selectors: string[], opts: { drag?: boolean } = {}): void {
	const points = selectors.map(centre).filter((p): p is { x: number; y: number } => p !== null);
	if (points.length === 0) return;
	hand.set({ id: nextId++, points, drag: opts.drag ?? false });
}

export function hideHand(): void {
	hand.set(null);
}

/** First visit per game shows a one-time demonstration. Storage failures just skip it. */
export function firstTime(game: string): boolean {
	try {
		const key = `lc.tutorial.seen.${game}`;
		if (localStorage.getItem(key)) return false;
		localStorage.setItem(key, '1');
		return true;
	} catch {
		return false;
	}
}
