/**
 * Cute low-poly farm animals built from simple shapes (no downloaded models, no licences).
 * Shared by Rumi's Train (passengers) and Rumi's Farm. Each animal stands on y = 0, faces +z,
 * and is about one unit tall (the cow a bit bigger). `userData.parts` exposes pieces callers
 * animate (head nod, tail wag, legs).
 */
import type * as ThreeNS from 'three';
import { THREE } from './toyKit.ts';

export type ToyAnimalKind = 'cat' | 'dog' | 'duck' | 'goat' | 'rabbit' | 'cow' | 'hen' | 'sheep';

export interface ToyAnimal extends ThreeNS.Group {
	userData: { kind: ToyAnimalKind; height: number; parts: { head: ThreeNS.Object3D; tail?: ThreeNS.Object3D } };
}

const mat = (color: string, roughness = 0.62) => new THREE.MeshStandardMaterial({ color, roughness });

function ball(color: string | ThreeNS.Material, r: number, sx = 1, sy = 1, sz = 1): ThreeNS.Mesh {
	const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), typeof color === 'string' ? mat(color) : color);
	m.scale.set(sx, sy, sz);
	return m;
}

function eyes(head: ThreeNS.Object3D, r: number, spread: number, y: number, z: number) {
	for (const s of [-1, 1]) {
		const white = ball('#ffffff', r * 1.25, 1, 1, 0.6);
		white.position.set(s * spread, y, z);
		const pupil = ball('#1E1E28', r * 0.8, 1, 1, 0.6);
		pupil.position.set(s * spread, y, z + r * 0.45);
		const glint = ball('#ffffff', r * 0.25);
		glint.position.set(s * spread + r * 0.25, y + r * 0.3, z + r * 0.85);
		head.add(white, pupil, glint);
	}
}

function legs(g: ThreeNS.Group, color: string, w: number, d: number, h: number, r = 0.08) {
	const geo = new THREE.CylinderGeometry(r, r * 0.9, h, 10);
	const m = mat(color);
	for (const [x, z] of [[-w, -d], [w, -d], [-w, d], [w, d]] as const) {
		const leg = new THREE.Mesh(geo, m);
		leg.position.set(x, h / 2, z);
		g.add(leg);
	}
}

const FUR: Record<ToyAnimalKind, string> = {
	cat: '#F2A65A',
	dog: '#B9825A',
	duck: '#F7D44C',
	goat: '#E9DDC8',
	rabbit: '#F1ECEA',
	cow: '#FAFAF6',
	hen: '#F4EDE2',
	sheep: '#FFFFFF'
};

export function toyAnimal(kind: ToyAnimalKind): ToyAnimal {
	const g = new THREE.Group() as ToyAnimal;
	const fur = FUR[kind];
	const head = new THREE.Group();
	let tail: ThreeNS.Object3D | undefined;
	let height = 1;

	if (kind === 'duck' || kind === 'hen') {
		// Birds: round body, head on top, two thin legs.
		const body = ball(fur, 0.36, 1, 0.9, 1.15);
		body.position.y = 0.42;
		g.add(body);
		const legM = mat('#F28C28');
		for (const s of [-1, 1]) {
			const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), legM);
			leg.position.set(s * 0.13, 0.1, 0.02);
			const foot = ball(legM, 0.07, 1.3, 0.4, 1.6);
			foot.position.set(s * 0.13, 0.02, 0.08);
			g.add(leg, foot);
		}
		head.position.set(0, 0.82, 0.18);
		head.add(ball(fur, 0.24));
		eyes(head, 0.045, 0.1, 0.05, 0.19);
		const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 10), mat(kind === 'duck' ? '#F28C28' : '#F2C94C'));
		beak.rotation.x = Math.PI / 2;
		beak.scale.set(kind === 'duck' ? 1.4 : 1, 1, kind === 'duck' ? 0.5 : 1);
		beak.position.set(0, -0.03, 0.28);
		head.add(beak);
		if (kind === 'hen') {
			for (const [y, z] of [[0.24, 0.02], [0.27, -0.06], [0.22, 0.09]] as const) {
				const comb = ball('#E5484D', 0.07);
				comb.position.set(0, y, z);
				head.add(comb);
			}
			const wattle = ball('#E5484D', 0.05, 1, 1.5, 1);
			wattle.position.set(0, -0.15, 0.22);
			head.add(wattle);
		}
		const t = ball(fur, 0.14, 0.8, 1.2, 1);
		t.position.set(0, 0.6, -0.42);
		g.add(t);
		tail = t;
		for (const s of [-1, 1]) {
			const wing = ball(kind === 'hen' ? '#E3D3BE' : '#F0C43A', 0.2, 0.35, 0.8, 1.2);
			wing.position.set(s * 0.33, 0.45, -0.02);
			g.add(wing);
		}
		height = 1.06;
	} else {
		// Four-legged friends.
		const big = kind === 'cow' ? 1.35 : kind === 'goat' || kind === 'sheep' ? 1.1 : 1;
		const legH = 0.3 * big;
		const legColor = kind === 'sheep' ? '#4A4550' : kind === 'cow' ? '#F4F0E8' : fur;
		legs(g, legColor, 0.17 * big, 0.2 * big, legH, 0.075 * big);
		if (kind === 'sheep') {
			for (const [x, y, z] of [[0, 0, 0], [-0.17, 0.06, 0.12], [0.17, 0.06, 0.12], [-0.17, 0.05, -0.15], [0.17, 0.05, -0.15], [0, 0.17, 0], [0, 0.06, 0.24], [0, 0.06, -0.26]] as const) {
				const puff = ball('#FFFFFF', 0.22 * big);
				puff.position.set(x * big, legH + 0.2 * big + y * big, z * big);
				g.add(puff);
			}
		} else {
			const body = ball(fur, 0.3 * big, 1.05, 0.85, 1.35);
			body.position.y = legH + 0.22 * big;
			g.add(body);
			if (kind === 'cow') {
				for (const [x, y, z, r] of [[0.24, 0.1, 0.05, 0.13], [-0.25, 0.02, -0.15, 0.12], [0.05, 0.22, -0.2, 0.1], [-0.18, 0.18, 0.18, 0.08]] as const) {
					const spot = ball('#2E2E38', r * big, 0.5, 1, 1);
					spot.position.set(x * big, legH + 0.22 * big + y * big, z * big);
					spot.lookAt(spot.position.clone().multiplyScalar(2));
					g.add(spot);
				}
			}
		}
		head.position.set(0, legH + 0.48 * big, 0.36 * big);
		const headColor = kind === 'sheep' ? '#4A4550' : fur;
		head.add(ball(headColor, 0.24 * big, 1, 0.95, 0.95));
		eyes(head, 0.045 * big, 0.1 * big, 0.06 * big, 0.19 * big);
		const muzzleColor = kind === 'cow' ? '#F7B6C2' : kind === 'dog' ? '#7B5236' : kind === 'sheep' ? '#6A6470' : '#FFF6EE';
		const muzzle = ball(muzzleColor, 0.12 * big, 1.3, 0.85, 0.8);
		muzzle.position.set(0, -0.08 * big, 0.2 * big);
		head.add(muzzle);
		const nose = ball(kind === 'cow' ? '#D87A8C' : '#2E2E38', 0.035 * big, 1.4, 1, 1);
		nose.position.set(0, -0.04 * big, 0.3 * big);
		head.add(nose);
		const earM = mat(kind === 'cat' ? '#E58E3F' : kind === 'dog' ? '#7B5236' : kind === 'sheep' ? '#4A4550' : fur);
		for (const s of [-1, 1]) {
			let ear: ThreeNS.Mesh;
			if (kind === 'cat') {
				ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.17, 4), earM);
				ear.position.set(s * 0.13, 0.2, 0);
				ear.rotation.z = -s * 0.25;
			} else if (kind === 'rabbit') {
				ear = ball(earM, 0.07, 0.8, 3, 0.6);
				ear.position.set(s * 0.09, 0.36, -0.02);
				ear.rotation.z = -s * 0.12;
				const inner = ball('#F7B6CF', 0.04, 0.6, 2.6, 0.4);
				inner.position.set(s * 0.09, 0.36, 0.03);
				inner.rotation.z = -s * 0.12;
				head.add(inner);
			} else if (kind === 'dog') {
				ear = ball(earM, 0.1, 0.55, 1.5, 0.9);
				ear.position.set(s * 0.22, -0.02, -0.02);
				ear.rotation.z = s * 0.3;
			} else {
				ear = ball(earM, 0.08 * big, 1.6, 0.6, 0.8);
				ear.position.set(s * 0.25 * big, 0.06 * big, -0.04 * big);
				ear.rotation.z = -s * 0.35;
			}
			head.add(ear);
			if (kind === 'cow' || kind === 'goat') {
				const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04 * big, 0.16 * big, 8), mat('#E9D8A6'));
				horn.position.set(s * 0.12 * big, 0.22 * big, -0.04 * big);
				horn.rotation.z = -s * 0.4;
				head.add(horn);
			}
		}
		if (kind === 'goat') {
			const beard = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), mat('#D8C8AE'));
			beard.rotation.x = Math.PI;
			beard.position.set(0, -0.24, 0.16);
			head.add(beard);
		}
		const t =
			kind === 'rabbit' || kind === 'sheep'
				? ball('#FFFFFF', 0.1 * big)
				: new THREE.Mesh(new THREE.CylinderGeometry(0.035 * big, 0.05 * big, (kind === 'cat' ? 0.5 : 0.32) * big, 8), mat(kind === 'cow' ? '#2E2E38' : fur));
		t.position.set(0, legH + 0.3 * big, -0.42 * big);
		if (!(kind === 'rabbit' || kind === 'sheep')) t.rotation.x = kind === 'cat' ? -0.5 : -0.9;
		g.add(t);
		tail = t;
		height = legH + 0.75 * big;
	}

	// Rosy cheeks on everyone.
	for (const s of [-1, 1]) {
		const cheek = ball(new THREE.MeshStandardMaterial({ color: '#FF8FA3', roughness: 0.8, transparent: true, opacity: 0.55 }), 0.04, 1, 0.7, 0.4);
		cheek.position.set(s * 0.15, -0.04, 0.18);
		head.add(cheek);
	}
	g.add(head);
	g.traverse((o) => ((o as ThreeNS.Mesh).isMesh && ((o as ThreeNS.Mesh).castShadow = true)));
	g.userData = { kind, height, parts: { head, tail } };
	return g;
}
