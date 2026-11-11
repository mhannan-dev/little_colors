import { expect, test } from '@playwright/test';
import type { DriverControls, VehicleState } from '../../src/lib/games/city-bus-driver/stores/gameStore';

test.use({ storageState: { cookies: [], origins: [] } });

test('opens City Bus Driver and drives the bus UI through its IPC contract', async ({ page }) => {
	await page.addInitScript(() => {
		const level = {
			id: 1, depot: { x: 0, z: 0 }, heading: 0, timeLimitMs: 90000,
			roadSpacing: 32, roadHalfWidth: 7, gridRadius: 2,
			nodes: [{ name: 'Central Terminal', kind: 'terminal', waiting: 0, position: { x: 0, z: -23 } }]
		};
		const vehicle: VehicleState = {
			runId: 1, phase: 'driving', remainingMs: 89000, nodeIndex: 0,
			bus: { position: level.depot, heading: 0, speedMps: 0, doorsOpen: false, indicator: 'off' },
			passengers: [], delivered: 0, collisions: 0, harshBrakes: 0, doorProgress: 0,
			stopServiced: false, traffic: [], score: null
		};
		Object.assign(window, {
			isTauri: true,
			__TAURI_INTERNALS__: {
				async invoke(command: string, args: Record<string, unknown>) {
					switch (command) {
						case 'get_player_progress':
							return { unlockedLevel: 1, bestScores: Array(60).fill(null) };
						case 'get_level_config':
							return level;
						case 'start_city_bus_level':
							return structuredClone(vehicle);
						case 'set_city_bus_paused':
							vehicle.phase = args.paused ? 'paused' : 'driving';
							return structuredClone(vehicle);
						case 'update_vehicle_physics': {
							const input = args.input as DriverControls;
							if (input.throttle) vehicle.bus.speedMps = 5;
							if (input.toggleDoors && !vehicle.bus.doorsOpen) {
								vehicle.bus.doorsOpen = true;
								vehicle.stopServiced = true;
								vehicle.doorProgress = 1;
							} else if (input.toggleDoors) {
								vehicle.bus.doorsOpen = false;
								vehicle.phase = 'completed';
								vehicle.score = { punctuality: 200, safety: 350, comfort: 300, total: 850 };
							}
							return structuredClone(vehicle);
						}
						case 'submit_level_score':
							return { unlockedLevel: 2, bestScores: [850, ...Array(59).fill(null)] };
						default:
							return null;
					}
				}
			}
		});
		// Exercise the renderer's supported map fallback on machines without WebGL.
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, options?: unknown) {
			if (type === 'webgl2') return null;
			return Reflect.apply(getContext, this, [type, options]);
		} as typeof getContext;
	});

	await page.goto('/play');
	await page.getByRole('button', { name: 'City Bus Driver', exact: true }).click();
	await expect(page.getByRole('group', { name: '60 routes' }).getByRole('button')).toHaveCount(60);
	await expect(page.getByRole('button', { name: 'Route 2 (locked)' })).toBeDisabled();
	await page.getByRole('button', { name: 'Start route' }).click();
	await expect(page.getByText('Map view')).toBeVisible();
	await page.keyboard.down('w');
	await expect(page.getByText('18 km/h')).toBeVisible();
	await page.keyboard.up('w');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('heading', { name: 'Route paused' })).toBeVisible();
	await page.getByRole('button', { name: 'Continue route' }).click();
	await page.getByRole('button', { name: /Cockpit/ }).click();
	await expect(page.getByRole('button', { name: /Chase/ })).toBeVisible();
	await page.getByRole('button', { name: /Open doors/ }).click();
	await expect(page.getByText('Close the doors to continue.')).toBeVisible();
	await page.getByRole('button', { name: /Close doors/ }).click();
	await expect(page.getByRole('heading', { name: 'Route complete' })).toBeVisible();
	await expect(page.getByText('Progress saved on this device.')).toBeVisible();
	await page.getByRole('button', { name: 'Choose a route' }).click();
	await expect(page.getByRole('button', { name: 'Route 2', exact: true })).toBeEnabled();
});
