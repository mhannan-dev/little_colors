import { invoke } from '@tauri-apps/api/core';
import { derived, get, writable } from 'svelte/store';

export const LEVEL_COUNT = 60;
export type Point = { x: number; z: number };
export type Indicator = 'off' | 'left' | 'right';
export type RouteNode = { position: Point; name: string; kind: 'waypoint' | 'stop' | 'terminal'; waiting: number };
export type LevelConfig = {
	id: number;
	depot: Point;
	heading: number;
	timeLimitMs: number;
	roadSpacing: number;
	roadHalfWidth: number;
	gridRadius: number;
	nodes: RouteNode[];
};
export type DriverControls = {
	throttle: boolean;
	brake: boolean;
	steering: number;
	toggleDoors: boolean;
	indicator: Indicator;
};
export type VehicleState = {
	runId: number;
	phase: 'driving' | 'paused' | 'completed' | 'timedOut';
	bus: { position: Point; heading: number; speedMps: number; doorsOpen: boolean; indicator: Indicator };
	remainingMs: number;
	nodeIndex: number;
	passengers: { id: number; boardedAtStop: number }[];
	delivered: number;
	collisions: number;
	harshBrakes: number;
	doorProgress: number;
	stopServiced: boolean;
	traffic: { position: Point; heading: number }[];
	score: { punctuality: number; safety: number; comfort: number; total: number } | null;
};
type PlayerProgress = { unlockedLevel: number; bestScores: (number | null)[] };

/** One store instance per route. At most one physics IPC call is in flight. */
export function createBusGame() {
	const level = writable<LevelConfig | null>(null);
	const vehicle = writable<VehicleState | null>(null);
	const progress = writable<PlayerProgress>({ unlockedLevel: 1, bestScores: Array(LEVEL_COUNT).fill(null) });
	const error = writable('');
	const busy = writable(false);
	const saved = writable(false);
	const speed = derived(vehicle, state => Math.round(Math.abs(state?.bus.speedMps ?? 0) * 3.6));
	const countdown = derived(vehicle, state => {
		const seconds = Math.ceil((state?.remainingMs ?? 0) / 1000);
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	});
	const target = derived([level, vehicle], ([$level, $vehicle]) =>
		$vehicle ? $level?.nodes[$vehicle.nodeIndex] : undefined);
	const metrics = derived(vehicle, state => ({
		onboard: state?.passengers.length ?? 0,
		delivered: state?.delivered ?? 0,
		collisions: state?.collisions ?? 0,
		harshBrakes: state?.harshBrakes ?? 0
	}));

	let generation = 0;
	let inflight: Promise<void> | undefined;

	async function loadProgress() {
		try {
			progress.set(await invoke<PlayerProgress>('get_player_progress'));
		} catch (cause) {
			error.set(String(cause));
		}
	}

	async function start(levelId: number) {
		if (get(busy)) return;
		busy.set(true);
		error.set('');
		const token = ++generation;
		try {
			await inflight;
			const config = await invoke<LevelConfig>('get_level_config', { levelId });
			const state = await invoke<VehicleState>('start_city_bus_level', { levelId });
			if (token !== generation) return;
			saved.set(false);
			level.set(config);
			vehicle.set(state);
		} catch (cause) {
			if (token === generation) error.set(String(cause));
		} finally {
			if (token === generation) busy.set(false);
		}
	}

	function tick(controls: () => DriverControls) {
		const state = get(vehicle);
		if (inflight || get(busy) || state?.phase !== 'driving') return;
		const token = generation;
		inflight = invoke<VehicleState>('update_vehicle_physics', { input: { runId: state.runId, ...controls() } })
			.then(snapshot => {
				if (token === generation) vehicle.set(snapshot);
			})
			.catch(cause => {
				if (token === generation) error.set(String(cause));
			})
			.finally(() => { inflight = undefined; });
	}

	async function pause(paused: boolean) {
		const state = get(vehicle);
		if (!state || get(busy) || state.phase !== (paused ? 'driving' : 'paused')) return;
		const token = generation;
		busy.set(true);
		try {
			await inflight;
			const next = await invoke<VehicleState>('set_city_bus_paused', { runId: state.runId, paused });
			if (token === generation) vehicle.set(next);
		} catch (cause) {
			if (token === generation) error.set(String(cause));
		} finally {
			if (token === generation) busy.set(false);
		}
	}

	async function saveScore() {
		const state = get(vehicle);
		if (state?.phase !== 'completed' || get(saved) || get(busy)) return;
		const token = generation;
		busy.set(true);
		error.set('');
		try {
			const result = await invoke<PlayerProgress>('submit_level_score', { scoreData: { runId: state.runId } });
			if (token !== generation) return;
			progress.set(result);
			saved.set(true);
		} catch (cause) {
			if (token === generation) error.set(String(cause));
		} finally {
			if (token === generation) busy.set(false);
		}
	}

	function leave() {
		generation++;
		vehicle.set(null);
		level.set(null);
		busy.set(false);
		error.set('');
	}

	return { level, vehicle, progress, speed, countdown, target, metrics, error, busy, saved, loadProgress, start, tick, pause, saveScore, leave };
}
