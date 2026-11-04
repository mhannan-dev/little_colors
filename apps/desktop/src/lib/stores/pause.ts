import { readable } from 'svelte/store';

/**
 * True while the window is hidden, minimized, or not focused (OF-11).
 * Games pause their timers, animations, and narration while this is true.
 */
export const paused = readable(false, (set) => {
	if (typeof window === 'undefined') return;
	const update = () => set(document.hidden || !document.hasFocus());
	window.addEventListener('blur', update);
	window.addEventListener('focus', update);
	document.addEventListener('visibilitychange', update);
	update();
	return () => {
		window.removeEventListener('blur', update);
		window.removeEventListener('focus', update);
		document.removeEventListener('visibilitychange', update);
	};
});
