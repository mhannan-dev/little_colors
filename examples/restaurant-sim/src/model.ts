export type StationId = 'grill' | 'drinkMachine';
export type RecipeId = 'burger' | 'lemonade';

export interface Recipe {
	id: RecipeId;
	name: string;
	stationId: StationId;
	cookMs: number;
	coins: number;
}

export interface Station {
	id: StationId;
	item: { recipeId: RecipeId; startedAtMs: number; readyAtMs: number } | null;
}

export interface Customer {
	id: number;
	name: string;
	arrivedAtMs: number;
	leavesAtMs: number;
	order: { lines: { recipeId: RecipeId; served: boolean }[]; reward: number };
}

export interface Snapshot {
	revision: number;
	nowMs: number;
	phase: 'idle' | 'running' | 'finished';
	stations: Station[];
	recipes: Recipe[];
	customers: Customer[];
	coins: number;
	served: number;
	walkedOut: number;
}

export const recipeIcon: Record<RecipeId, string> = { burger: '🍔', lemonade: '🍋' };
