import * as THREE from 'three';
import { createConfetti } from '#lib/three3d/toyKit.ts';
import { drawToken, type Lesson } from './lessons.ts';
import { buildCharacter, type Mood } from './reference/character.ts';
import { buildWorld } from './reference/world.ts';
import { facing, place } from './reference/terrain.ts';
import { groundHeight, type CourseId } from './reference/course.ts';

export type TrailFrame = {
	distance: number; lane: number; moving: boolean; jump: number; sliding: boolean;
	flip: number; reduced: boolean; celebrate: boolean; preview: boolean;
};
export type TrailScene = {
	lesson(lesson: Lesson | null, distance: number, numeral: (n: number) => string): void;
	character(index: number): void;
	theme(id: CourseId): void;
	celebrate(): void;
	setPaused(value: boolean): void;
	dispose(): void;
};

export function createTrailScene(canvas: HTMLCanvasElement, update: (dt: number) => TrailFrame): TrailScene {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1400);
	const sunlight = new THREE.DirectionalLight(0xfff1d0, 2);
	const hemisphere = new THREE.HemisphereLight(0xf2fbff, 0xb9d6a0, 1.9);
	sunlight.castShadow = true;
	sunlight.shadow.mapSize.set(1024, 1024);
	Object.assign(sunlight.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 160 });
	sunlight.shadow.bias = -0.0015;
	scene.add(sunlight, sunlight.target, hemisphere);
	let world = buildWorld('meadow');
	let hero = buildCharacter(0);
	scene.add(world.group, hero.root);
	const effects = createConfetti(scene, false);
	const gates = new THREE.Group();
	scene.add(gates);
	const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d3a2b, transparent: true, opacity: 0.28, depthWrite: false }));
	scene.add(shadow);
	const cameraPosition = new THREE.Vector3(), cameraLook = new THREE.Vector3();
	const desiredPosition = new THREE.Vector3(), desiredLook = new THREE.Vector3();
	const sunOffset = new THREE.Vector3(-8, 46, 32);
	let cameraReady = false;
	let previousPreview = true;
	let paused = false;
	let frameId = 0;
	let last = performance.now();
	let time = 0;
	let smoothLane = 0;
	let previousJump = 0;
	let course: CourseId = 'meadow';

	function applyTheme() {
		const theme = world.theme;
		scene.background = new THREE.Color(theme.fog);
		scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
		hemisphere.color.set(theme.hemiSky);
		hemisphere.groundColor.set(theme.hemiGround);
		hemisphere.intensity = theme.hemi;
		sunlight.color.set(theme.sun);
		sunlight.intensity = theme.sunPower;
	}
	applyTheme();
	function resize() {
		const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.fov = camera.aspect < 0.85 ? 70 : 58;
		camera.updateProjectionMatrix();
		cameraReady = false;
	}
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();
	function clearGates() {
		gates.traverse(object => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				for (const material of materials) { (material as THREE.MeshBasicMaterial).map?.dispose(); material.dispose(); }
			}
		});
		gates.clear();
	}
	function frame(now: number) {
		frameId = requestAnimationFrame(frame);
		const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
		last = now;
		if (paused) return;
		time += dt;
		const state = update(dt);
		const s = state.distance, ground = groundHeight(s);
		smoothLane += (state.lane - smoothLane) * (1 - Math.exp(-8 * dt));
		place(s, smoothLane, ground + state.jump, hero.root.position);
		hero.root.rotation.y = facing(s);
		let mood: Mood = 'idle';
		if (state.celebrate) mood = 'victory';
		else if (state.flip >= 0) mood = 'flip';
		else if (state.sliding) mood = 'slide';
		else if (state.jump > 0.03) mood = state.jump >= previousJump ? 'rise' : 'fall';
		else if (state.moving) mood = 'run';
		hero.update({ mood, dt, time, distance: s, flip: state.flip, trick: 0, cheer: 0, calm: state.reduced });
		previousJump = state.jump;
		place(s, smoothLane, ground + 0.025, shadow.position);
		shadow.material.opacity = 0.28 / (1 + state.jump * 0.5);
		shadow.scale.setScalar(1 + state.jump * 0.12);
		const portrait = camera.aspect < 0.85;
		const front = state.preview || state.celebrate;
		if (front) {
			place(s + (portrait ? 7.4 : 4.3), portrait ? 0.3 : 0.4, ground + (portrait ? 2 : 1.55), desiredPosition);
			place(s, portrait ? 0 : 1.75, ground + (portrait ? -1.1 : 1.1), desiredLook);
		} else {
			place(s - (portrait ? 8.6 : 6.6), portrait ? -0.7 : -1.05, ground + (portrait ? 5 : 3.8) + state.jump * 0.28, desiredPosition);
			place(s + 6.5, 0.25, (ground + groundHeight(s + 6.5)) / 2 + 1.1 + state.jump * 0.18, desiredLook);
		}
		if (!cameraReady || state.preview !== previousPreview || state.reduced) {
			cameraPosition.copy(desiredPosition); cameraLook.copy(desiredLook); cameraReady = true;
		} else {
			const blend = 1 - Math.exp(-(front ? 2.6 : 7.5) * dt);
			cameraPosition.lerp(desiredPosition, blend); cameraLook.lerp(desiredLook, blend);
		}
		previousPreview = state.preview;
		camera.position.copy(cameraPosition); camera.lookAt(cameraLook);
		world.sky.position.copy(cameraPosition);
		world.update(time, state.reduced);
		sunlight.target.position.copy(hero.root.position);
		sunlight.position.copy(hero.root.position).add(sunOffset);
		effects.update(dt);
		renderer.render(scene, camera);
	}
	frameId = requestAnimationFrame(frame);
	return {
		setPaused(value) { paused = value; last = performance.now(); },
		character(index) {
			scene.remove(hero.root); hero.dispose(); hero = buildCharacter(index); scene.add(hero.root);
		},
		theme(id) {
			if (course === id) return;
			course = id;
			scene.remove(world.group); world.dispose(); world = buildWorld(id); scene.add(world.group); applyTheme(); cameraReady = false;
		},
		lesson(lesson, distance, numeral) {
			clearGates();
			if (!lesson) return;
			gates.position.copy(place(distance, 0, groundHeight(distance), new THREE.Vector3()));
			gates.rotation.y = facing(distance);
			for (const side of [-1, 1]) {
				const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.5, 8), new THREE.MeshLambertMaterial({ color: 0x9a6b43 }));
				post.position.set(side * 2.7, 1.75, 0); gates.add(post);
			}
			const banner = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 0.12), new THREE.MeshLambertMaterial({ color: 0xff8fb0 }));
			banner.position.y = 3.3; gates.add(banner);
			lesson.options.forEach((token, i) => {
				const image = document.createElement('canvas'); image.width = image.height = 256;
				drawToken(image.getContext('2d')!, token, numeral(token.value ?? 0));
				const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
				// A gate's local +X points opposite to the course's positive lateral offset.
				sign.position.set(-(i - (lesson.options.length - 1) / 2) * 1.8, 2.3, -0.1);
				sign.rotation.y = Math.PI;
				gates.add(sign);
			});
		},
		celebrate() { effects.burst(hero.root.position.clone().add(new THREE.Vector3(0, 2, 0)), 36); },
		dispose() {
			cancelAnimationFrame(frameId); observer.disconnect(); clearGates(); effects.dispose();
			hero.dispose(); world.dispose(); shadow.geometry.dispose(); shadow.material.dispose(); sunlight.shadow.dispose();
			renderer.dispose(); renderer.forceContextLoss();
		}
	};
}
