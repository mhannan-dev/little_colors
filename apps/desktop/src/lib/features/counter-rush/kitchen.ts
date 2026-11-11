import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { RecipeId, Snapshot, StationId } from './model';

export const subscribeToKitchen = (apply: (snapshot: Snapshot) => void) =>
	listen<Snapshot>('game-state', ({ payload }) => apply(payload));

let visibility = Promise.resolve();

/** Serialize opening and closing so quick navigation cannot pause a newly opened shift. */
export function setKitchenVisible(visible: boolean) {
	const next = visibility.then(() => invoke<Snapshot>('set_counter_rush_visible', { visible }));
	visibility = next.then(() => {}, () => {});
	return next;
}

export const kitchen = {
	snapshot: () => invoke<Snapshot>('get_game_state'),
	startShift: () => invoke<Snapshot>('start_shift'),
	cook: (stationId: StationId, recipeId: RecipeId) =>
		invoke<Snapshot>('start_cooking', { stationId, recipeId }),
	serve: (customerId: number, stationId: StationId) =>
		invoke<Snapshot>('serve_order', { customerId, stationId }),
	discard: (stationId: StationId) => invoke<Snapshot>('discard_item', { stationId })
};
