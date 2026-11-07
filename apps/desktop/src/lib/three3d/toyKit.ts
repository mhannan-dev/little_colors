/**
 * Shared toy-style 3D kit for the ABC & 123 blocks and the toy car (three.js, lazy-loaded).
 * Everything is built from simple shapes in code: no downloaded models, no licences,
 * small bundle. Calm and soft: no flashing, gentle motion (PR-06), reduced motion respected.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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

export function createStage(canvas: HTMLCanvasElement, opts: { fov?: number; background?: string } = {}): Stage {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(opts.background ?? '#FFF9F0');
	const camera = new THREE.PerspectiveCamera(opts.fov ?? 45, 1, 0.1, 200);

	scene.add(new THREE.HemisphereLight('#ffffff', '#d9cbb3', 1.6));
	const sun = new THREE.DirectionalLight('#ffffff', 1.6);
	sun.position.set(6, 12, 8);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
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
			renderer.dispose();
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
export function toyCar(color = '#3478D4'): THREE.Group {
	const car = new THREE.Group();
	const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
	const dark = new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.8 });
	const glass = new THREE.MeshStandardMaterial({ color: '#cfe8f7', roughness: 0.2 });
	const fur = new THREE.MeshStandardMaterial({ color: '#E3B48A', roughness: 0.8 });

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

export const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
