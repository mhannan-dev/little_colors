import { describe, expect, it } from 'vitest';
import { createMemoryStorageAdapter } from '../src/storage/memoryStorageAdapter.ts';

describe('memory storage (AR-07, AR-08)', () => {
	it('returns null for missing or removed values, and removal is idempotent', async () => {
		const storage = createMemoryStorageAdapter();
		expect(await storage.get('missing')).toBeNull();
		await storage.set('progress', { count: 2 });
		await storage.remove('progress');
		await storage.remove('progress');
		expect(await storage.get('progress')).toBeNull();
	});

	it('round trips nested JSON data, overwrites keys, and preserves other keys', async () => {
		const storage = createMemoryStorageAdapter();
		await storage.set('language', 'bn-BD');
		await storage.set('progress', { completed: ['mixing'], nested: { count: 1 } });
		expect(await storage.get('progress')).toEqual({ completed: ['mixing'], nested: { count: 1 } });
		await storage.set('progress', { completed: [] });
		expect(await storage.get('progress')).toEqual({ completed: [] });
		expect(await storage.get('language')).toBe('bn-BD');
	});

	it('isolates persisted data from caller and reader mutations', async () => {
		const storage = createMemoryStorageAdapter();
		const value = { completed: ['mixing'] };
		await storage.set('progress', value);
		value.completed.push('matching');
		const restored = await storage.get<typeof value>('progress');
		expect(restored).toEqual({ completed: ['mixing'] });
		restored!.completed.push('numbers');
		expect(await storage.get('progress')).toEqual({ completed: ['mixing'] });
	});

	it('keeps adapters isolated and handles falsy JSON values', async () => {
		const first = createMemoryStorageAdapter();
		const second = createMemoryStorageAdapter();
		for (const value of [false, 0, '', null]) {
			await first.set('value', value);
			expect(await first.get('value')).toBe(value);
		}
		expect(await second.get('value')).toBeNull();
	});

	it('rejects unserializable writes without replacing the saved value', async () => {
		const storage = createMemoryStorageAdapter();
		await storage.set('value', 1);
		await expect(storage.set('value', undefined)).rejects.toThrow(TypeError);
		const circular: { self?: unknown } = {};
		circular.self = circular;
		await expect(storage.set('value', circular)).rejects.toThrow(TypeError);
		expect(await storage.get('value')).toBe(1);
	});
});
