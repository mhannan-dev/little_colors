import * as THREE from 'three';
import type { LevelConfig, VehicleState } from '../stores/gameStore';

export type CameraMode = 'chase' | 'cockpit';
type Box = { x: number; y: number; z: number; w: number; h: number; l: number; color: string };

export function createCityScene(canvas: HTMLCanvasElement, level: LevelConfig) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#acd9ea');
	scene.fog = new THREE.Fog('#acd9ea', 85, 230);
	const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 260);
	const sun = new THREE.DirectionalLight('#fff4db', 2.1);
	sun.position.set(28, 45, 19);
	scene.add(sun, new THREE.HemisphereLight('#edfaff', '#a19a8c', 1.55));

	const cube = new THREE.BoxGeometry();
	const material = new THREE.MeshStandardMaterial({ roughness: 0.86 });
	const box = (parent: THREE.Object3D, spec: Box) => {
		const mesh = new THREE.Mesh(cube, new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.72 }));
		mesh.position.set(spec.x, spec.y, spec.z);
		mesh.scale.set(spec.w, spec.h, spec.l);
		parent.add(mesh);
		return mesh;
	};
	const span = level.roadSpacing * level.gridRadius * 2 + level.roadHalfWidth * 2;
	box(scene, { x: 0, y: -.22, z: 0, w: span, h: .4, l: span, color: '#37444c' });
	box(scene, { x: 0, y: -.63, z: 0, w: 460, h: .4, l: 460, color: '#87a78b' });

	// Procedural city uses a single instanced batch for the repeated cubes.
	const city: Box[] = [];
	const colors = ['#d8a683', '#a1b9bf', '#e2c18c', '#bfafb8', '#b0bd9a'];
	const street = level.roadSpacing;
	const width = street - level.roadHalfWidth * 2;
	for (let x = -level.gridRadius; x < level.gridRadius; x++) {
		for (let z = -level.gridRadius; z < level.gridRadius; z++) {
			const cx = (x + .5) * street;
			const cz = (z + .5) * street;
			city.push({ x: cx, y: .06, z: cz, w: width, h: .16, l: width, color: '#b8b7ac' });
			for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]] as const) {
				const seed = Math.abs(x * 19 + z * 31 + dx * 11 + dz * 7 + level.id);
				const h = 4 + seed % 10;
				city.push({ x: cx + dx, y: h / 2, z: cz + dz, w: 6.5, h, l: 6.5, color: colors[seed % colors.length]! });
				city.push({ x: cx + dx, y: h + .18, z: cz + dz, w: 6.8, h: .38, l: 6.8, color: '#5f7076' });
			}
		}
	}
	for (let line = -level.gridRadius; line <= level.gridRadius; line++) {
		const lineAt = line * street;
		for (let segment = -level.gridRadius; segment < level.gridRadius; segment++) {
			for (const offset of [-5, 0, 5]) {
				const along = (segment + .5) * street + offset;
				city.push({ x: lineAt, y: .01, z: along, w: .15, h: .045, l: 2.3, color: '#d6d4b7' });
				city.push({ x: along, y: .01, z: lineAt, w: 2.3, h: .045, l: .15, color: '#d6d4b7' });
			}
		}
	}
	const buildings = new THREE.InstancedMesh(cube, material, city.length);
	const pose = new THREE.Object3D();
	city.forEach((item, i) => {
		pose.position.set(item.x, item.y, item.z);
		pose.scale.set(item.w, item.h, item.l);
		pose.updateMatrix();
		buildings.setMatrixAt(i, pose.matrix);
		buildings.setColorAt(i, new THREE.Color(item.color));
	});
	scene.add(buildings);

	const route = new THREE.BufferGeometry().setFromPoints(
		[level.depot, ...level.nodes.map(node => node.position)].map(p => new THREE.Vector3(p.x, .06, p.z))
	);
	scene.add(new THREE.Line(route, new THREE.LineBasicMaterial({ color: '#63e3d4' })));
	const target = new THREE.Group();
	const ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.35, 40),
		new THREE.MeshBasicMaterial({ color: '#ffe176', side: THREE.DoubleSide }));
	ring.rotation.x = -Math.PI / 2;
	ring.position.y = .10;
	target.add(ring);
	scene.add(target);
	for (const node of level.nodes) {
		if (node.kind === 'waypoint') continue;
		box(scene, { x: node.position.x, y: .035, z: node.position.z, w: 2, h: .07, l: 2,
			color: node.kind === 'terminal' ? '#ed9550' : '#42c9b8' });
	}

	const bus = new THREE.Group();
	const body = new THREE.Group();
	bus.add(body);
	scene.add(bus);
	box(body, { x: 0, y: 1.18, z: 0, w: 2.42, h: 1.68, l: 5.9, color: '#f6ba43' });
	box(body, { x: 0, y: 2.02, z: 0, w: 2.29, h: .35, l: 5.76, color: '#fff2c4' });
	box(body, { x: 0, y: 1.62, z: -2.97, w: 2.14, h: .55, l: .045, color: '#214956' });
	for (const side of [-1, 1]) {
		box(body, { x: side * 1.22, y: 1.62, z: .27, w: .05, h: .51, l: 4.75, color: '#345865' });
		for (const z of [-1.77, 1.76]) {
			box(body, { x: side * 1.07, y: .37, z, w: .38, h: .69, l: .77, color: '#19282e' });
		}
	}
	const door = box(body, { x: 1.256, y: 1.24, z: -1.65, w: .07, h: 1.4, l: .83, color: '#31566a' });
	const left = box(body, { x: -.93, y: .95, z: 3.0, w: .28, h: .2, l: .09, color: '#de553c' });
	const right = box(body, { x: .93, y: .95, z: 3.0, w: .28, h: .2, l: .09, color: '#de553c' });

	const trafficColors = ['#db665b', '#5991d4', '#ecede1', '#68ad98'];
	const cars = Array.from({ length: 7 }, (_, i) => {
		const car = new THREE.Group();
		box(car, { x: 0, y: .47, z: 0, w: 1.78, h: .75, l: 3.45, color: trafficColors[i % trafficColors.length]! });
		box(car, { x: 0, y: .98, z: .17, w: 1.53, h: .44, l: 1.7, color: '#41606c' });
		car.visible = false;
		scene.add(car);
		return car;
	});

	const resize = () => {
		const width = canvas.clientWidth || 1;
		const height = canvas.clientHeight || 1;
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	};
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();

	const destination = new THREE.Vector3();
	const eye = new THREE.Vector3();
	const look = new THREE.Vector3();
	const yaw = new THREE.Quaternion();
	const axis = new THREE.Vector3(0, 1, 0);
	let lastMode: CameraMode | undefined;
	let shownHeading = level.heading;

	function draw(state: VehicleState | null, mode: CameraMode, dt: number, reduced: boolean) {
		const info = state?.bus;
		const point = info?.position ?? level.depot;
		const heading = info?.heading ?? level.heading;
		const blend = lastMode === undefined || reduced ? 1 : 1 - Math.exp(-dt * 18);
		destination.set(point.x, 0, point.z);
		bus.position.lerp(destination, blend);
		shownHeading += Math.atan2(Math.sin(heading - shownHeading), Math.cos(heading - shownHeading)) * blend;
		bus.rotation.y = -shownHeading;
		body.visible = mode === 'chase';
		door.position.z = THREE.MathUtils.lerp(door.position.z, info?.doorsOpen ? -.83 : -1.65, blend);
		const blink = reduced || (state?.remainingMs ?? 0) % 680 < 340;
		left.material.color.set(info?.indicator === 'left' && blink ? '#fff0a4' : '#b45b46');
		right.material.color.set(info?.indicator === 'right' && blink ? '#fff0a4' : '#b45b46');
		cars.forEach((car, i) => {
			const stateCar = state?.traffic[i];
			car.visible = !!stateCar;
			if (stateCar) {
				car.position.set(stateCar.position.x, 0, stateCar.position.z);
				car.rotation.y = -stateCar.heading;
			}
		});
		const node = level.nodes[state?.nodeIndex ?? 0];
		target.visible = !!node;
		if (node) {
			target.position.set(node.position.x, 0, node.position.z);
			ring.material.color.set(node.kind === 'waypoint' ? '#72e7dd' : '#ffe176');
		}

		yaw.setFromAxisAngle(axis, -shownHeading);
		eye.set(0, mode === 'chase' ? 6.2 : 1.9, mode === 'chase' ? 10.5 : -2.66)
			.applyQuaternion(yaw).add(bus.position);
		look.set(0, mode === 'chase' ? 1.2 : 1.75, mode === 'chase' ? -4.3 : -20)
			.applyQuaternion(yaw).add(bus.position);
		camera.position.lerp(eye, mode !== lastMode || reduced ? 1 : 1 - Math.exp(-dt * 7));
		camera.lookAt(look);
		lastMode = mode;
		renderer.render(scene, camera);
	}

	function dispose() {
		observer.disconnect();
		const materials = new Set<THREE.Material>();
		const geometries = new Set<THREE.BufferGeometry>();
		scene.traverse(object => {
			if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
				geometries.add(object.geometry);
				const items = Array.isArray(object.material) ? object.material : [object.material];
				for (const item of items) materials.add(item);
			}
			if (object instanceof THREE.InstancedMesh) object.dispose();
		});
		for (const item of materials) item.dispose();
		for (const item of geometries) item.dispose();
		renderer.dispose();
	}

	return { draw, dispose };
}
