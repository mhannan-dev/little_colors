import type { StorageAdapter } from './StorageAdapter.ts';

/** In-memory persistence with the same serialization boundary as saved data. */
export function createMemoryStorageAdapter(): StorageAdapter {
	const values = new Map<string, string>();
	return {
		async get<T>(key: string): Promise<T | null> {
			const serialized = values.get(key);
			return serialized === undefined ? null : JSON.parse(serialized) as T;
		},
		async set<T>(key: string, value: T): Promise<void> {
			const serialized = JSON.stringify(value);
			if (serialized === undefined) throw new TypeError('Storage values must be JSON-serializable.');
			values.set(key, serialized);
		},
		async remove(key: string): Promise<void> {
			values.delete(key);
		}
	};
}
