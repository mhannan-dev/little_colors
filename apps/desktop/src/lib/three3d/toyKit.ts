/**
 * Shared toy-style 3D kit for the ABC & 123 blocks and the toy car (three.js, lazy-loaded).
 * Everything is built from simple shapes in code: no downloaded models, no licences,
 * small bundle. Calm and soft: no flashing, gentle motion (PR-06), reduced motion respected.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CameraFeedback } from '#lib/components/visuals/CameraFeedback.ts';
import { ShaderEffectManager } from '#lib/components/visuals/ShaderEffectManager.ts';
import { createSurfaceMaps, type Surface } from '#lib/components/visuals/surfaceMaps.ts';

export { THREE };

export const TOY_COLORS = ['#E5484D', '#F2C94C', '#3478D4', '#F28C28', '#35A66A', '#8A5AC2'] as const;

export interface Stage {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	/** Called every frame with seconds since the previous frame (not called while paused). */
	onFrame(fn: (dt: number, t: number) => void): void;
	setPaused(paused: boolean): void;
	feedback(allowMotion: boolean): void;
	surface(kind: Surface): ReturnType<typeof createSurfaceMaps>;
	contactShadow(size: number): { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; dispose(): void };
	/** Screen position (CSS px, relative to the canvas) of a world point. */
	toScreen(v: THREE.Vector3): { x: number; y: number };
	dispose(): void;
}

/** A vertical sky gradient (top colour → horizon colour) used as a screen-space background. */
function skyTexture(top: string, horizon: string): THREE.CanvasTexture {
	const c = document.createElement('canvas');
	c.width = 2;
	c.height = 256;
	const g = c.getContext('2d')!;
	const grad = g.createLinearGradient(0, 0, 0, 256);
	grad.addColorStop(0, top);
	grad.addColorStop(0.75, horizon);
	grad.addColorStop(1, horizon);
	g.fillStyle = grad;
	g.fillRect(0, 0, 2, 256);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

export function createStage(
	canvas: HTMLCanvasElement,
	opts: { fov?: number; background?: string; skyTop?: string; bloom?: boolean } = {}
): Stage {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.95;
	renderer.shadowMap.enabled = true;
	// PCFShadowMap is the soft filter supported by this Three.js version.
	renderer.shadowMap.type = THREE.PCFShadowMap;

	const scene = new THREE.Scene();
	const background = opts.background ?? '#FFF9F0';
	const sky = opts.skyTop ? skyTexture(opts.skyTop, background) : null;
	scene.background = sky ?? new THREE.Color(background);
	const camera = new THREE.PerspectiveCamera(opts.fov ?? 45, 1, 0.1, 200);
	const effects = new ShaderEffectManager(renderer, scene, camera, opts.bloom ?? false);
	const cameraFeedback = new CameraFeedback();
	const surfaces = new Map<Surface, ReturnType<typeof createSurfaceMaps>>();
	const softShadowGeometry = new THREE.PlaneGeometry(1, 1);
	const shadowMaterials = new Set<THREE.MeshBasicMaterial>();
	let shadowTexture: THREE.CanvasTexture | undefined;

	// Soft studio reflections: plastic toys pick up gentle highlights instead of looking flat.
	const pmrem = new THREE.PMREMGenerator(renderer);
	const envScene = new RoomEnvironment();
	const environment = pmrem.fromScene(envScene, 0.04);
	const envMap = environment.texture;
	envScene.dispose();
	pmrem.dispose();
	scene.environment = envMap;
	scene.environmentIntensity = 0.42;

	scene.add(new THREE.HemisphereLight('#ffffff', '#d9cbb3', 0.8));
	const sun = new THREE.DirectionalLight('#fff6e8', 2.0);
	sun.position.set(6, 12, 8);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.bias = -0.0004;
	sun.shadow.normalBias = 0.02;
	sun.shadow.radius = 3; // soft shadow edges (PCF filter radius)
	Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
	scene.add(sun);

	const frames: ((dt: number, t: number) => void)[] = [];
	let paused = false;
	let raf = 0;
	let last = performance.now();
	let elapsed = 0;

	const resize = () => {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		renderer.setSize(w, h, false);
		effects.resize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	};
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();

	const loop = (now: number) => {
		raf = requestAnimationFrame(loop);
		const frameTime = Math.max(0, (now - last) / 1000);
		const dt = Math.min(0.05, frameTime);
		last = now;
		if (paused) return;
		elapsed += dt;
		for (const f of frames) f(dt, elapsed);
		effects.prepare();
		const offset = cameraFeedback.update(dt);
		const originalY = camera.position.y;
		camera.position.y += offset;
		try { effects.render(frameTime); }
		finally {
			camera.position.y = originalY;
			if (offset) camera.updateMatrixWorld();
		}
	};
	raf = requestAnimationFrame(loop);

	return {
		scene,
		camera,
		renderer,
		onFrame: (fn) => void frames.push(fn),
		setPaused: (p) => {
			paused = p;
			last = performance.now();
			if (p) { cameraFeedback.clear(); effects.clear(); }
		},
		feedback(allowMotion) {
			if (paused || !allowMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			cameraFeedback.bump();
			effects.pulse();
		},
		surface(kind) {
			let maps = surfaces.get(kind);
			if (!maps) { maps = createSurfaceMaps(kind); surfaces.set(kind, maps); }
			return maps;
		},
		contactShadow(size) {
			if (!shadowTexture) {
				const image = document.createElement('canvas');
				image.width = image.height = 64;
				const context = image.getContext('2d')!;
				const gradient = context.createRadialGradient(32, 32, 6, 32, 32, 32);
				gradient.addColorStop(0, 'rgba(30, 23, 15, .72)');
				gradient.addColorStop(0.55, 'rgba(30, 23, 15, .32)');
				gradient.addColorStop(1, 'rgba(30, 23, 15, 0)');
				context.fillStyle = gradient;
				context.fillRect(0, 0, 64, 64);
				shadowTexture = new THREE.CanvasTexture(image);
				shadowTexture.colorSpace = THREE.SRGBColorSpace;
			}
			const material = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.34 });
			shadowMaterials.add(material);
			const mesh = new THREE.Mesh(softShadowGeometry, material);
			mesh.rotation.x = -Math.PI / 2;
			mesh.scale.setScalar(size);
			mesh.position.y = 0.007;
			scene.add(mesh);
			return { mesh, dispose() { scene.remove(mesh); shadowMaterials.delete(material); material.dispose(); } };
		},
		toScreen(v) {
			const p = v.clone().project(camera);
			return { x: ((p.x + 1) / 2) * canvas.clientWidth, y: ((1 - p.y) / 2) * canvas.clientHeight };
		},
		dispose() {
			cancelAnimationFrame(raf);
			observer.disconnect();
			effects.dispose();
			scene.traverse((o) => {
				const mesh = o as THREE.Mesh;
				if (mesh.geometry === softShadowGeometry) return;
				mesh.geometry?.dispose();
				const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
				for (const m of mats) {
					(m as THREE.MeshStandardMaterial).map?.dispose();
					m.dispose();
				}
			});
			for (const maps of surfaces.values()) { maps.normalMap.dispose(); maps.roughnessMap.dispose(); }
			for (const material of shadowMaterials) material.dispose();
			shadowTexture?.dispose();
			softShadowGeometry.dispose();
			sun.shadow.dispose();
			environment.dispose();
			sky?.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}

/** Make sure the Bengali font is ready before drawing glyphs into textures. */
export async function fontsReady(): Promise<void> {
	try {
		await Promise.all([
			document.fonts.load('700 120px "Hind Siliguri"', 'অআ১২'),
			document.fonts.load('700 120px "Hind Siliguri"', 'AB12')
		]);
	} catch {
		/* fall back to system font */
	}
}

/** A square texture with a big glyph on a coloured face, like a printed toy block. */
export function glyphTexture(glyph: string, face: string, ink = '#263238'): THREE.CanvasTexture {
	const size = 256;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const g = c.getContext('2d')!;
	g.fillStyle = face;
	g.fillRect(0, 0, size, size);
	g.fillStyle = '#ffffff';
	g.beginPath();
	g.roundRect(22, 22, size - 44, size - 44, 34);
	g.fill();
	g.fillStyle = ink;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	const px = glyph.length > 1 ? 120 : 160;
	g.font = `700 ${px}px "Hind Siliguri", system-ui, sans-serif`;
	g.fillText(glyph, size / 2, size / 2 + 12);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

/** A soft rounded toy block with the glyph on every face. */
export function toyBlock(glyph: string, color: string, size = 1.6): THREE.Mesh {
	const tex = glyphTexture(glyph, color);
	const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
	const mesh = new THREE.Mesh(new RoundedBoxGeometry(size, size, size, 4, size * 0.14), mat);
	mesh.castShadow = true;
	return mesh;
}

/** Rumi's toy car: chunky body, cabin, four wheels, and a little tiger head peeking out. */
export function toyCar(color = '#3478D4', furColor = '#E3B48A', surface?: ReturnType<typeof createSurfaceMaps>): THREE.Group {
	const car = new THREE.Group();
	// Glossy toy paint: a clear-coat layer catches the environment like shiny plastic.
	const paint = new THREE.MeshPhysicalMaterial({ ...surface, color, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });
	const dark = new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.8 });
	const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8f7', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
	const fur = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.8 });

	const body = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.55, 2.6, 4, 0.2), paint);
	body.position.y = 0.55;
	const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.55, 1.2, 4, 0.18), glass);
	cabin.position.set(0, 1.05, 0.15);
	car.add(body, cabin);

	const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 20);
	for (const [x, z] of [[-0.82, 0.85], [0.82, 0.85], [-0.82, -0.85], [0.82, -0.85]] as const) {
		const w = new THREE.Mesh(wheelGeo, dark);
		w.rotation.z = Math.PI / 2;
		w.position.set(x, 0.34, z);
		w.name = 'wheel';
		car.add(w);
	}

	const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), fur);
	head.position.set(0, 1.55, 0.25);
	for (const x of [-0.22, 0.22]) {
		const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), fur);
		ear.position.set(x, 1.82, 0.25);
		car.add(ear);
	}
	car.add(head);
	car.traverse((o) => ((o as THREE.Mesh).castShadow = true));
	return car;
}

/** A simple low-poly tree. */
export function toyTree(): THREE.Group {
	const tree = new THREE.Group();
	const trunk = new THREE.Mesh(
		new THREE.CylinderGeometry(0.15, 0.2, 0.9, 8),
		new THREE.MeshStandardMaterial({ color: '#8A6A52' })
	);
	trunk.position.y = 0.45;
	const top = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#4E9F68' }));
	top.position.y = 1.6;
	tree.add(trunk, top);
	tree.traverse((o) => ((o as THREE.Mesh).castShadow = true));
	return tree;
}

export interface Confetti {
	/** Throw `count` pieces up and out from `at`. Does nothing when reduced motion is on. */
	burst(at: THREE.Vector3, count: number, colors?: readonly string[], opts?: { speed?: number; up?: number; size?: number }): void;
	/** Step the pieces; `driftZ` moves them with a scrolling world (the race road). */
	update(dt: number, driftZ?: number): void;
	clear(): void;
	dispose(): void;
}

/**
 * Celebration confetti: flat paper squares that flutter down slowly and little gems that
 * fall faster. Pieces settle on the ground and shrink away softly (no popping, no flashing).
 */
export function createConfetti(scene: THREE.Scene, reduced: boolean): Confetti {
	const capacity = 96;
	const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
	const papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.16), material, capacity);
	const gems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.13), material, capacity);
	const meshes = [papers, gems];
	for (const mesh of meshes) {
		mesh.count = 0;
		mesh.frustumCulled = false;
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		mesh.setColorAt(0, new THREE.Color());
		mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
		mesh.visible = false;
		scene.add(mesh);
	}
	const transform = new THREE.Object3D();
	const pieces = Array.from({ length: capacity }, () => ({
		position: new THREE.Vector3(), rotation: new THREE.Euler(), color: new THREE.Color(),
		velocity: new THREE.Vector3(), spin: new THREE.Vector3(), paper: true,
		phase: 0, life: 0, duration: 0, size: 1
	}));
	let active = 0;
	function clear() {
		active = papers.count = gems.count = 0;
		papers.visible = gems.visible = false;
	}
	return {
		burst(at, count, colors = TOY_COLORS, opts = {}) {
			if (reduced) return;
			for (let i = 0; i < count && active < capacity; i++) {
				const piece = pieces[active++];
				piece.paper = i % 3 !== 0;
				piece.color.set(colors[i % colors.length] ?? TOY_COLORS[0]).multiplyScalar(1.25);
				piece.position.copy(at);
				piece.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
				const angle = Math.random() * Math.PI * 2;
				const speed = (1.5 + Math.random() * 3.5) * (opts.speed ?? 1);
				piece.velocity.set(Math.cos(angle) * speed, (4 + Math.random() * 4) * (opts.up ?? 1), Math.sin(angle) * speed);
				piece.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 4 - 2);
				piece.phase = Math.random() * 6;
				piece.life = piece.duration = 1.8 + Math.random();
				piece.size = opts.size ?? 1;
			}
		},
		update(dt, driftZ = 0) {
			if (!active) return;
			papers.count = gems.count = 0;
			for (let i = active - 1; i >= 0; i--) {
				const piece = pieces[i];
				piece.life -= dt;
				if (piece.life <= 0) {
					pieces[i] = pieces[--active];
					pieces[active] = piece;
					continue;
				}
				if (piece.position.y > 0.06) {
					piece.velocity.y -= 9 * dt;
					if (piece.paper) {
						const drag = Math.max(0, 1 - 1.6 * dt);
						piece.velocity.x *= drag;
						piece.velocity.z *= drag;
						piece.velocity.y = Math.max(-1.8, piece.velocity.y);
						piece.position.x += Math.sin((piece.duration - piece.life) * 7 + piece.phase) * 0.9 * dt;
					}
					piece.position.addScaledVector(piece.velocity, dt);
					piece.position.y = Math.max(0.05, piece.position.y);
					piece.rotation.x += piece.spin.x * dt;
					piece.rotation.y += piece.spin.y * dt;
					piece.rotation.z += piece.spin.z * dt;
				}
				piece.position.z += driftZ;
				transform.position.copy(piece.position);
				transform.rotation.copy(piece.rotation);
				transform.scale.setScalar(piece.size * Math.min(1, piece.life / 0.4));
				transform.updateMatrix();
				const mesh = piece.paper ? papers : gems;
				const index = mesh.count++;
				mesh.setMatrixAt(index, transform.matrix);
				mesh.setColorAt(index, piece.color);
			}
			for (const mesh of meshes) {
				mesh.visible = mesh.count > 0;
				if (mesh.visible) {
					mesh.instanceMatrix.needsUpdate = true;
					mesh.instanceColor!.needsUpdate = true;
				}
			}
		},
		clear,
		dispose() {
			clear();
			for (const mesh of meshes) {
				scene.remove(mesh);
				mesh.dispose();
				mesh.geometry.dispose();
			}
			material.dispose();
		}
	};
}

/** Squash & stretch keyframes for a happy hop: [time s, vertical scale]. */
const HOP_KEYS: [number, number][] = [
	[0, 1],
	[0.12, 0.78], // crouch
	[0.2, 1.18], // spring up, stretched
	[0.46, 1], // round at the top
	[0.7, 1.12], // stretch while falling
	[0.78, 0.8], // squash on landing
	[0.9, 1.06], // little rebound
	[1.0, 1]
];
const AIR_FROM = 0.16;
const AIR_TO = 0.76;

/**
 * A cartoon hop at time `t` (seconds). `y` is the lift of the object's bottom; `sy`/`sxz`
 * scale it (volume-preserving). Callers keep the bottom on the ground with
 * `position.y = rest + y - (1 - sy) * height / 2`.
 */
export function squashHop(t: number, lift = 1.6): { y: number; sy: number; sxz: number; done: boolean } {
	const end = HOP_KEYS[HOP_KEYS.length - 1]![0];
	if (t >= end) return { y: 0, sy: 1, sxz: 1, done: true };
	let sy = 1;
	for (let i = 1; i < HOP_KEYS.length; i++) {
		const [t1, v1] = HOP_KEYS[i]!;
		if (t <= t1) {
			const [t0, v0] = HOP_KEYS[i - 1]!;
			const k = (t - t0) / (t1 - t0);
			sy = v0 + (v1 - v0) * k * k * (3 - 2 * k);
			break;
		}
	}
	const air = (t - AIR_FROM) / (AIR_TO - AIR_FROM);
	const y = air > 0 && air < 1 ? Math.sin(air * Math.PI) * lift : 0;
	return { y, sy, sxz: 1 / Math.sqrt(sy), done: false };
}

export const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

/**
 * Realistic sky lighting from an HDR photo of the sky (CC0, Poly Haven): image-based lighting and
 * reflections for every material, and optionally the sky itself as the background.
 * Returns a disposer; call it before stage.dispose().
 */
export async function useHdriSky(stage: Stage, url: string, opts: { background?: boolean; intensity?: number } = {}): Promise<() => void> {
	const { HDRLoader } = await import('three/addons/loaders/HDRLoader.js');
	const tex = await new HDRLoader().loadAsync(url);
	tex.mapping = THREE.EquirectangularReflectionMapping;
	const pmrem = new THREE.PMREMGenerator(stage.renderer);
	const env = pmrem.fromEquirectangular(tex).texture;
	pmrem.dispose();
	const before = stage.scene.environment;
	stage.scene.environment = env;
	stage.scene.environmentIntensity = opts.intensity ?? 0.85;
	if (opts.background) {
		stage.scene.background = tex;
		stage.scene.backgroundIntensity = 0.9;
	}
	return () => {
		if (stage.scene.environment === env) stage.scene.environment = before;
		env.dispose();
		tex.dispose();
	};
}

/** A tiled PBR material from colour / normal / roughness maps (CC0, ambientCG), with a scroll helper. */
export function pbrMaterial(base: string, repeat: [number, number], tint?: string): { material: THREE.MeshStandardMaterial; scroll(v: number): void; dispose(): void } {
	const loader = new THREE.TextureLoader();
	const load = (suffix: string, srgb: boolean) => {
		const t = loader.load(`${base}_${suffix}.jpg`);
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(repeat[0], repeat[1]);
		t.anisotropy = 8;
		if (srgb) t.colorSpace = THREE.SRGBColorSpace;
		return t;
	};
	const map = load('color', true);
	const normalMap = load('normal', false);
	const roughnessMap = load('rough', false);
	const material = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1, color: tint ?? '#ffffff' });
	return {
		material,
		scroll(v) {
			for (const t of [map, normalMap, roughnessMap]) t.offset.y = v % 1;
		},
		dispose() {
			for (const t of [map, normalMap, roughnessMap]) t.dispose();
			material.dispose();
		}
	};
}

/** Car paint that picks up sky reflections (clear coat), for the realistic scenes. */
export function carPaint(color: string): THREE.MeshPhysicalMaterial {
	return new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
}
