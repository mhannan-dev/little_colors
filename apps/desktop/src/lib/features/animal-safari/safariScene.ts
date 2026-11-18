import { THREE, createConfetti, createStage } from '#lib/three3d/toyKit.ts';
import { safariAnimal, safariJeep } from './models.ts';
import { animalPositions, type FoodId, type SafariLesson } from './lessons.ts';

export type SafariFrame = { distance: number; reduced: boolean; moving: boolean; counted: number[] };
export type AnimalSpot = { id: number; x: number; y: number; size: number };
export type SafariScene = ReturnType<typeof createSafariScene>;

export function createSafariScene(canvas: HTMLCanvasElement, update: (dt: number) => SafariFrame, project: (spots: AnimalSpot[]) => void) {
	const stage = createStage(canvas, { skyTop: '#8acfd5', background: '#d8edcd', fov: 46 });
	const { scene, camera } = stage;
	const sunlight = scene.children.find((object): object is THREE.DirectionalLight => object instanceof THREE.DirectionalLight);
	if (sunlight) scene.add(sunlight.target);
	scene.fog = new THREE.Fog('#d8edcd', 50, 140);
	const green = new THREE.MeshStandardMaterial({ color: '#a6c978', roughness: 0.98 });
	const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 300), green); ground.rotation.x = -Math.PI / 2; ground.position.z = -100; ground.receiveShadow = true; scene.add(ground);
	const road = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 280), new THREE.MeshStandardMaterial({ color: '#e2c89b', roughness: 1 }));
	road.rotation.x = -Math.PI / 2; road.position.set(0, 0.015, -100); road.receiveShadow = true; scene.add(road);
	const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.23, 0.34, 3, 7), new THREE.MeshStandardMaterial({ color: '#9c7854', roughness: 0.9 }), 48);
	const canopy = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), new THREE.MeshStandardMaterial({ color: '#559578', roughness: 0.9 }), 48);
	const dummy = new THREE.Object3D();
	for (let i = 0; i < 48; i++) {
		const x = (i % 2 ? 1 : -1) * (10 + (i % 5) * 2.5), z = 12 - Math.floor(i / 2) * 10;
		dummy.position.set(x, 1.5, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
		dummy.position.y = 3.7; dummy.scale.set(2.8, 1.1, 2.4); dummy.updateMatrix(); canopy.setMatrixAt(i, dummy.matrix);
	}
	trunk.castShadow = canopy.castShadow = true; scene.add(trunk, canopy);
	const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#b6b59d', roughness: 1 }), 35);
	for (let i = 0; i < 35; i++) {
		dummy.position.set((i % 2 ? 1 : -1) * (7.8 + i % 4 * 2.5), 0.3, 5 - i * 6); dummy.scale.set(0.6 + i % 3 * 0.2, 0.45, 0.7); dummy.rotation.y = i; dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
	}
	rocks.castShadow = true; scene.add(rocks);
	for (const distance of [24, 58, 92, 126, 160]) {
		const pond = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshStandardMaterial({ color: '#72bfc7', roughness: 0.35 }));
		pond.rotation.x = -Math.PI / 2; pond.scale.set(1.3, 0.7, 1); pond.position.set(-9, 0.025, -distance - 5); scene.add(pond);
	}
	const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 5, 4), new THREE.MeshStandardMaterial({ color: '#f4df95', roughness: 0.8 }), 160);
	for (let i = 0; i < 160; i++) { dummy.position.set((i % 2 ? 1 : -1) * (3 + (i * 13 % 61) / 10), 0.13, 14 - i * 1.3); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix); } scene.add(flowers);
	const jeep = safariJeep(); scene.add(jeep);
	const habitat = new THREE.Group(); scene.add(habitat);
	const confetti = createConfetti(scene, false);
	let animals: { id: number; model: ReturnType<typeof safariAnimal>; x: number; z: number }[] = [];
	let stop = 24, frameNumber = 0, celebration = 0, lastSpots: AnimalSpot[] = [];
	let snack: THREE.Group | null = null, snackTime = 0;
	let jeepX = -3, jeepOffset = 7.2;
	const look = new THREE.Vector3();
	function clearHabitat() {
		const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
		habitat.traverse(object => {
			if (!(object instanceof THREE.Mesh)) return;
			geometries.add(object.geometry);
			for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
		});
		for (const geometry of geometries) geometry.dispose(); for (const mat of materials) mat.dispose();
		habitat.clear(); animals = []; snack = null; lastSpots = [];
	}
	stage.onFrame((dt, time) => {
		const state = update(dt), d = state.distance;
		// Pull over at each stop so the jeep never hides a rabbit being counted.
		const blend = state.reduced ? 1 : 1 - Math.exp(-5 * dt);
		jeepX += ((state.moving ? Math.sin(d / 15) * 0.12 : -3) - jeepX) * blend;
		jeepOffset += ((state.moving ? 5.5 : 7.2) - jeepOffset) * blend;
		jeep.position.set(jeepX, state.moving && !state.reduced ? Math.sin(time * 10) * 0.025 : 0, -d + jeepOffset);
		jeep.rotation.y = state.moving && !state.reduced ? Math.sin(d / 15) * 0.035 : 0;
		const portrait = camera.aspect < 1;
		camera.position.set(portrait ? 4 : 7, portrait ? 11 : 8, -d + (portrait ? 24 : 16));
		look.set(0, 0.8, -d - 1.5); camera.lookAt(look); camera.updateMatrixWorld();
		if (sunlight) { sunlight.position.set(6, 12, -d + 8); sunlight.target.position.set(0, 0, -d); }
		celebration = Math.max(0, celebration - dt);
		for (const animal of animals) {
			animal.model.head.rotation.y = state.reduced ? 0 : Math.sin(time * 1.3 + animal.id) * 0.09;
			animal.model.group.position.y = state.reduced ? 0 : celebration > 0 ? Math.abs(Math.sin(time * 7 + animal.id)) * 0.22 : 0;
			animal.model.group.rotation.y = 0.25 + (state.counted.includes(animal.id) ? -0.15 : 0);
		}
		if (snack) { snackTime += dt; const p = state.reduced ? 1 : Math.min(1, snackTime / 0.8); snack.position.set(0, 0.7 + Math.sin(p * Math.PI) * 2, -stop + 4 - p * 5.2); snack.visible = p < 1; }
		confetti.update(dt);
		if (++frameNumber % 3 !== 0) return;
		const spots = animals.map(({ id, model }) => {
			const p = stage.toScreen(model.group.position.clone().add(new THREE.Vector3(0, model.height * 0.55, 0)));
			const top = stage.toScreen(model.group.position.clone().add(new THREE.Vector3(0, model.height, 0)));
			return { id, x: Math.round(p.x), y: Math.round(p.y), size: Math.max(76, Math.min(160, Math.abs(p.y - top.y) * 2.3)) };
		});
		if (spots.length !== lastSpots.length || spots.some((p, i) => Math.abs(p.x - lastSpots[i].x) > 1 || Math.abs(p.y - lastSpots[i].y) > 1 || Math.abs(p.size - lastSpots[i].size) > 1)) { project(spots); lastSpots = spots; }
	});
	return {
		lesson(lesson: SafariLesson, distance: number) {
			clearHabitat(); stop = distance;
			animals = animalPositions(lesson).map(({ id, animal, x, z }) => {
				const model = safariAnimal(animal); model.group.scale.multiplyScalar(1.5); model.height *= 1.5; model.group.position.set(x, 0, -distance + z); model.group.rotation.y = 0.25; habitat.add(model.group);
				const shadow = new THREE.Mesh(new THREE.CircleGeometry(animal === 'giraffe' ? 1.2 : 1.4, 24), new THREE.MeshBasicMaterial({ color: '#496e4f', transparent: true, opacity: 0.18, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, 0.03, -distance + z); habitat.add(shadow);
				return { id, model, x, z };
			});
		},
		celebrate(reduced: boolean) { celebration = reduced ? 0 : 1.8; if (!reduced) confetti.burst(new THREE.Vector3(0, 2.8, -stop), 32); },
		feed(food: FoodId) {
			if (snack) return;
			snack = new THREE.Group(); snackTime = 0;
			const mesh = food === 'carrot' ? new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 8), new THREE.MeshStandardMaterial({ color: '#ed9345' })) : new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: '#71a758' }));
			mesh.rotation.z = food === 'carrot' ? Math.PI : 0; snack.add(mesh); habitat.add(snack);
		},
		setPaused(value: boolean) { stage.setPaused(value); },
		dispose() { clearHabitat(); confetti.dispose(); trunk.dispose(); canopy.dispose(); rocks.dispose(); flowers.dispose(); stage.dispose(); }
	};
}
