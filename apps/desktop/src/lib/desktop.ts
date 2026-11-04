/**
 * Desktop-only behaviors (spec 13, OF-12 and OF-14).
 * Safe to call in a plain browser: Tauri calls are skipped when not running inside Tauri.
 */
const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function toggleFullscreen(force?: boolean) {
	if (!inTauri()) return;
	const { getCurrentWindow } = await import('@tauri-apps/api/window');
	const win = getCurrentWindow();
	const next = force ?? !(await win.isFullscreen());
	await win.setFullscreen(next);
}

export function installDesktopBehavior(): () => void {
	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'F11') {
			e.preventDefault();
			void toggleFullscreen();
		} else if (e.key === 'Escape') {
			void toggleFullscreen(false);
		} else if (!import.meta.env.DEV) {
			// Block reload / zoom / devtools shortcuts in release builds.
			const k = e.key.toLowerCase();
			if (k === 'f5' || ((e.ctrlKey || e.metaKey) && ['r', '+', '-', '=', '0', 'p', 'f'].includes(k))) {
				e.preventDefault();
			}
		}
	};
	const onContextMenu = (e: MouseEvent) => {
		if (!import.meta.env.DEV) e.preventDefault();
	};
	window.addEventListener('keydown', onKey);
	window.addEventListener('contextmenu', onContextMenu);
	return () => {
		window.removeEventListener('keydown', onKey);
		window.removeEventListener('contextmenu', onContextMenu);
	};
}
