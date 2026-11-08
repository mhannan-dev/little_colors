import { writable } from 'svelte/store';

/**
 * In-app updates (docs/decisions/0001-in-app-updates.md).
 * - Only inside the installed desktop app (Tauri); never in the dev browser.
 * - Checks quietly at most once a day. With no internet, nothing happens and nothing is
 *   shown: no "you are offline" message (OF-06), no retry loop.
 * - Nothing is downloaded until a grown-up confirms (press and hold).
 */
export const LAST_CHECK_KEY = 'lc.update.lastCheck';
export const CHECK_EVERY_MS = 20 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 8000;

export interface AvailableUpdate {
	version: string;
	notes: string;
	install: (onProgress: (fraction: number) => void) => Promise<void>;
}

export const availableUpdate = writable<AvailableUpdate | null>(null);

export const isDesktopApp = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Pure rule: check when online and the last check is old enough (or never happened / clock went back). */
export function dueForCheck(lastCheck: number | null, now: number, online: boolean): boolean {
	if (!online) return false;
	if (lastCheck === null || !Number.isFinite(lastCheck) || lastCheck > now) return true;
	return now - lastCheck >= CHECK_EVERY_MS;
}

function readLast(): number | null {
	try {
		const raw = localStorage.getItem(LAST_CHECK_KEY);
		return raw === null ? null : Number(raw);
	} catch {
		return null;
	}
}

let started = false;

/** Call once when the app starts. Never throws, never shows anything unless an update exists. */
export async function checkForUpdateQuietly(now = Date.now()): Promise<void> {
	if (started || !isDesktopApp()) return;
	started = true;
	if (!dueForCheck(readLast(), now, navigator.onLine)) return;
	try {
		const { check } = await import('@tauri-apps/plugin-updater');
		const update = await check({ timeout: CHECK_TIMEOUT_MS });
		try {
			localStorage.setItem(LAST_CHECK_KEY, String(now));
		} catch {
			/* storage unavailable: we may simply check again next time */
		}
		if (!update) return;
		availableUpdate.set({
			version: update.version,
			notes: update.body ?? '',
			install: async (onProgress) => {
				let total = 0;
				let done = 0;
				await update.downloadAndInstall((event) => {
					if (event.event === 'Started') total = event.data.contentLength ?? 0;
					else if (event.event === 'Progress') {
						done += event.data.chunkLength;
						if (total > 0) onProgress(Math.min(1, done / total));
					} else if (event.event === 'Finished') onProgress(1);
				});
				const { relaunch } = await import('@tauri-apps/plugin-process');
				await relaunch();
			}
		});
	} catch {
		// Offline, server down, bad signature… the child just keeps playing (OF-06).
	}
}
