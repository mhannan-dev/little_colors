import type { StorageAdapter } from '../storage/StorageAdapter.ts';
import { createDefaultSettings } from './defaults.ts';
import { migrateSettings } from './migrations.ts';
import { SETTINGS_STORAGE_KEY, SETTINGS_SCHEMA_VERSION, type ParentSettings } from './schema.ts';

export interface SettingsService {
	load(): Promise<ParentSettings>;
	update(patch: Partial<ParentSettings>): Promise<ParentSettings>;
	subscribe(listener: (settings: ParentSettings) => void): () => void;
}

export function createSettingsService(storage: StorageAdapter, options: { reducedMotion?: boolean } = {}): SettingsService {
	const defaults = createDefaultSettings(options.reducedMotion ?? false);
	let settings = { ...defaults };
	let loaded: Promise<void> | undefined;
	let queue: Promise<unknown> = Promise.resolve();
	const listeners = new Set<{ fn: (settings: ParentSettings) => void }>();
	const notify = () => { for (const listener of [...listeners]) listener.fn({ ...settings }); };
	const load = () => loaded ??= (async () => {
		try { settings = migrateSettings(await storage.get<unknown>(SETTINGS_STORAGE_KEY), defaults); } catch { settings = { ...defaults }; }
		notify();
	})();
	function serial<T>(operation: () => Promise<T>): Promise<T> {
		const next = queue.then(operation); queue = next.catch(() => undefined); return next;
	}
	return {
		load: () => serial(async () => { await load(); return { ...settings }; }),
		update(patch) {
			const snapshot = { ...patch };
			return serial(async () => {
				await load();
				settings = migrateSettings({ ...settings, ...snapshot, schemaVersion: SETTINGS_SCHEMA_VERSION }, defaults);
				notify();
				try { await storage.set(SETTINGS_STORAGE_KEY, { ...settings }); } catch { /* Keep the in-memory settings usable. */ }
				return { ...settings };
			});
		},
		subscribe(fn) {
			const entry = { fn }; listeners.add(entry); fn({ ...settings });
			return () => { listeners.delete(entry); };
		}
	};
}
