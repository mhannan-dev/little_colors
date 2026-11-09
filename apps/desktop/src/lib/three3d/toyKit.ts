/**
 * Shared toy-style 3D kit for the ABC & 123 blocks and the toy car (three.js, lazy-loaded).
 * Everything is built from simple shapes in code: no downloaded models, no licences,
 * small bundle. Calm and soft: no flashing, gentle motion (PR-06), reduced motion respected.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };

export const TOY_COLORS = ['#E5484D', '#F2C94C', '#3478D4', '#F28C28', '#35A66A', '#8A5AC2'] as const;

export interface Stage {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	/** Called every frame with seconds since the previous frame (not called while paused). */
	onFrame(fn: (dt: number, t: number) => void): void;
	setPaused(paused: boolean): void;
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
	opts: { fov?: number; background?: string; /** Gradient sky colour at the top; the horizon is `background`. */ skyTop?: string } = {}
): Stage {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	// Neutral tone mapping keeps the bright toy colours saturated (AgX/ACES wash them out)
	// while still rolling off highlights softly instead of clipping to flat white.
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.toneMappingExposure = 0.9;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;

	const scene = new THREE.Scene();
	const background = opts.background ?? '#FFF9F0';
	const sky = opts.skyTop ? skyTexture(opts.skyTop, background) : null;
	scene.background = sky ?? new THREE.Color(background);
	const camera = new THREE.PerspectiveCamera(opts.fov ?? 45, 1, 0.1, 200);

	// Soft studio reflections: plastic toys pick up gentle highlights instead of looking flat.
	const pmrem = new THREE.PMREMGenerator(renderer);
	const envScene = new RoomEnvironment();
	const envMap = pmrem.fromScene(envScene, 0.04).texture;
	envScene.dispose();
	pmrem.dispose();
	scene.environment = envMap;
	scene.environmentIntensity = 0.35;

	scene.add(new THREE.HemisphereLight('#ffffff', '#d9cbb3', 0.8));
	const sun = new THREE.DirectionalLight('#fff6e8', 2.0);
	sun.position.set(6, 12, 8);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
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
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	};
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();

	const loop = (now: number) => {
		raf = requestAnimationFrame(loop);
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		if (paused) return;
		elapsed += dt;
		for (const f of frames) f(dt, elapsed);
		renderer.render(scene, camera);
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
		},
		toScreen(v) {
			const p = v.clone().project(camera);
			return { x: ((p.x + 1) / 2) * canvas.clientWidth, y: ((1 - p.y) / 2) * canvas.clientHeight };
		},
		dispose() {
			cancelAnimationFrame(raf);
			observer.disconnect();
			scene.traverse((o) => {
				const mesh = o as THREE.Mesh;
				mesh.geometry?.dispose();
				const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
				for (const m of mats) {
					(m as THREE.MeshStandardMaterial).map?.dispose();
					m.dispose();
				}
			});
			envMap.dispose();
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
export function toyCar(color = '#3478D4', furColor = '#E3B48A'): THREE.Group {
	const car = new THREE.Group();
	// Glossy toy paint: a clear-coat layer catches the environment like shiny plastic.
	const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });
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
	const paperGeo = new THREE.PlaneGeometry(0.24, 0.16);
	const gemGeo = new THREE.OctahedronGeometry(0.13);
	const mats = new Map<string, THREE.MeshStandardMaterial>();
	const matFor = (color: string) => {
		let m = mats.get(color);
		if (!m) {
			m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.5, side: THREE.DoubleSide });
			mats.set(color, m);
		}
		return m;
	};
	interface Piece {
		mesh: THREE.Mesh;
		paper: boolean;
		v: THREE.Vector3;
		spin: THREE.Vector3;
		phase: number;
		life: number;
		max: number;
		size: number;
	}
	let pieces: Piece[] = [];
	const remove = (p: Piece) => scene.remove(p.mesh);

	return {
		burst(at, count, colors = TOY_COLORS, opts = {}) {
			if (reduced) return;
			const speed = opts.speed ?? 1;
			const up = opts.up ?? 1;
			const size = opts.size ?? 1;
			for (let i = 0; i < count; i++) {
				const paper = i % 3 !== 0;
				const mesh = new THREE.Mesh(paper ? paperGeo : gemGeo, matFor(colors[i % colors.length]!));
				mesh.position.copy(at);
				mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
				scene.add(mesh);
				const ang = Math.random() * Math.PI * 2;
				const sp = (1.5 + Math.random() * 3.5) * speed;
				const max = 1.8 + Math.random() * 1;
				pieces.push({
					mesh,
					paper,
					v: new THREE.Vector3(Math.cos(ang) * sp, (4 + Math.random() * 4) * up, Math.sin(ang) * sp),
					spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 4 - 2),
					phase: Math.random() * 6,
					life: max,
					max,
					size
				});
			}
		},
		update(dt, driftZ = 0) {
			for (const p of pieces) {
				p.life -= dt;
				const m = p.mesh;
				const grounded = m.position.y <= 0.06;
				if (!grounded) {
					p.v.y -= 9 * dt;
					// Paper has air drag: it slows sideways and drifts down gently, swaying.
					if (p.paper) {
						const drag = Math.max(0, 1 - 1.6 * dt);
						p.v.x *= drag;
						p.v.z *= drag;
						if (p.v.y < -1.8) p.v.y = -1.8;
						m.position.x += Math.sin((p.max - p.life) * 7 + p.phase) * 0.9 * dt;
					}
					m.position.addScaledVector(p.v, dt);
					m.rotation.x += p.spin.x * dt;
					m.rotation.y += p.spin.y * dt;
					m.rotation.z += p.spin.z * dt;
					if (m.position.y < 0.05) m.position.y = 0.05;
				}
				m.position.z += driftZ;
				// Shrink away during the last 0.4 s.
				m.scale.setScalar(p.size * Math.min(1, Math.max(0, p.life / 0.4)));
			}
			if (pieces.some((p) => p.life <= 0)) {
				for (const p of pieces) if (p.life <= 0) remove(p);
				pieces = pieces.filter((p) => p.life > 0);
			}
		},
		clear() {
			for (const p of pieces) remove(p);
			pieces = [];
		},
		dispose() {
			this.clear();
			paperGeo.dispose();
			gemGeo.dispose();
			for (const m of mats.values()) m.dispose();
			mats.clear();
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
