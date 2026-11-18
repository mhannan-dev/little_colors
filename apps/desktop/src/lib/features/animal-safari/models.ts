import { THREE } from '#lib/three3d/toyKit.ts';
import { toyAnimal } from '#lib/three3d/animals.ts';
import type { AnimalId } from './lessons.ts';

const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
function sphere(parent: THREE.Object3D, color: string, position: number[], scale: number[]) {
	const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material(color));
	mesh.position.set(position[0], position[1], position[2]); mesh.scale.set(scale[0], scale[1], scale[2]); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: THREE.Object3D, color: string, x: number, y: number, z: number, radius: number, height: number) {
	const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, height, 10), material(color));
	mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function eyes(head: THREE.Object3D, spread: number, y: number, z: number, radius = 0.085) {
	for (const side of [-1, 1]) {
		sphere(head, '#25383b', [side * spread, y, z], [radius, radius * 1.15, radius * 0.65]);
		sphere(head, '#ffffff', [side * spread + radius * 0.2, y + radius * 0.35, z + radius * 0.6], [radius * 0.3, radius * 0.3, radius * 0.3]);
	}
}
export function safariAnimal(kind: AnimalId) {
	if (kind === 'rabbit') {
		const rabbit = toyAnimal('rabbit'); rabbit.scale.setScalar(1.35);
		return { group: rabbit as THREE.Group, head: rabbit.userData.parts.head, height: rabbit.userData.height * 1.35 };
	}
	const group = new THREE.Group(), head = new THREE.Group(); group.add(head);
	if (kind === 'elephant') {
		for (const x of [-0.57, 0.57]) for (const z of [-0.65, 0.65]) {
			cylinder(group, '#9caeb6', x, 0.5, z, 0.26, 1);
			sphere(group, '#e1e8e5', [x, 0.12, z + 0.12], [0.27, 0.13, 0.26]);
		}
		sphere(group, '#aabcc3', [0, 1.3, -0.1], [0.9, 0.8, 1.22]);
		head.position.set(0, 1.9, 0.9);
		for (const side of [-1, 1]) {
			sphere(head, '#aabcc3', [side * 0.68, 0, -0.16], [0.53, 0.66, 0.19]);
			sphere(head, '#d4bdc0', [side * 0.71, 0, 0], [0.32, 0.47, 0.07]);
		}
		sphere(head, '#b6c7cc', [0, 0, 0], [0.63, 0.65, 0.58]); eyes(head, 0.28, 0.12, 0.53);
		const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.15, 0.48), new THREE.Vector3(0, -0.55, 0.8), new THREE.Vector3(0, -1.15, 0.98), new THREE.Vector3(0.23, -1.08, 1.16)]);
		const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.16, 10, false), material('#aabcc3')); trunk.castShadow = true; head.add(trunk);
		sphere(group, '#92a4ac', [0, 1.15, -1.4], [0.08, 0.26, 0.1]);
		return { group, head, height: 2.65 };
	}
	if (kind === 'lion') {
		for (const x of [-0.4, 0.4]) for (const z of [-0.55, 0.55]) {
			cylinder(group, '#e7ae57', x, 0.4, z, 0.19, 0.8); sphere(group, '#f4c77a', [x, 0.14, z + 0.12], [0.24, 0.15, 0.3]);
		}
		sphere(group, '#e7ae57', [0, 0.95, -0.15], [0.68, 0.56, 0.98]);
		head.position.set(0, 1.45, 0.7);
		for (let i = 0; i < 13; i++) {
			const angle = i / 13 * Math.PI * 2;
			sphere(head, i % 2 ? '#a86b3d' : '#bb7c42', [Math.cos(angle) * 0.53, Math.sin(angle) * 0.53, -0.03], [0.26, 0.29, 0.26]);
		}
		sphere(head, '#f1bd67', [0, 0, 0.12], [0.54, 0.55, 0.46]);
		for (const side of [-1, 1]) sphere(head, '#f7dba7', [side * 0.17, -0.2, 0.51], [0.22, 0.18, 0.16]);
		sphere(head, '#70452e', [0, -0.12, 0.66], [0.11, 0.08, 0.08]); eyes(head, 0.23, 0.1, 0.54);
		const tail = cylinder(group, '#df9d48', 0.4, 1.05, -1.2, 0.055, 0.7); tail.rotation.x = 1.4;
		sphere(group, '#925a35', [0.4, 1.1, -1.55], [0.15, 0.14, 0.18]);
		return { group, head, height: 2.3 };
	}
	for (const x of [-0.38, 0.38]) for (const z of [-0.55, 0.55]) {
		cylinder(group, '#e6b65a', x, 0.7, z, 0.13, 1.4); cylinder(group, '#73553c', x, 0.1, z, 0.14, 0.2);
	}
	sphere(group, '#e9be68', [0, 1.65, -0.1], [0.65, 0.55, 1]);
	const neck = cylinder(group, '#e9be68', 0, 2.55, 0.53, 0.25, 1.9); neck.rotation.x = 0.12;
	for (let i = 0; i < 6; i++) for (const side of [-1, 1]) sphere(group, '#b97b3e', [side * 0.6, 1.48 + (i % 2) * 0.3, -0.75 + i * 0.26], [0.055, 0.12, 0.14]);
	for (let i = 0; i < 4; i++) sphere(group, '#b97b3e', [0.23, 2.08 + i * 0.3, 0.55], [0.06, 0.1, 0.12]);
	head.position.set(0, 3.55, 0.62);
	sphere(head, '#edc776', [0, 0, 0.13], [0.37, 0.37, 0.55]); sphere(head, '#f2ddb2', [0, -0.1, 0.5], [0.31, 0.22, 0.23]);
	for (const side of [-1, 1]) {
		sphere(head, '#edc776', [side * 0.4, 0.17, 0], [0.23, 0.12, 0.1]);
		cylinder(head, '#9f713c', side * 0.18, 0.43, 0, 0.045, 0.26); sphere(head, '#73553c', [side * 0.18, 0.58, 0], [0.08, 0.08, 0.08]);
	}
	eyes(head, 0.2, 0.09, 0.51, 0.065);
	return { group, head, height: 4.2 };
}

export function safariJeep() {
	const group = new THREE.Group();
	const box = (color: string, size: number[], position: number[]) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(color)); mesh.position.set(position[0], position[1], position[2]); mesh.castShadow = true; group.add(mesh); return mesh;
	};
	box('#6ca388', [2.2, 0.65, 3.2], [0, 0.8, 0]); box('#f4d27a', [2.05, 0.52, 1.2], [0, 1.25, -0.95]);
	box('#e7bf70', [2.25, 0.18, 1.7], [0, 2.35, 0.35]);
	for (const x of [-0.95, 0.95]) for (const z of [-0.35, 1.05]) cylinder(group, '#496b5b', x, 1.85, z, 0.05, 1);
	for (const x of [-1.1, 1.1]) for (const z of [-1, 1]) {
		const wheel = cylinder(group, '#34433d', x, 0.5, z, 0.46, 0.26); wheel.rotation.z = Math.PI / 2;
		const hub = cylinder(group, '#c8d2c3', x * 1.11, 0.5, z, 0.21, 0.05); hub.rotation.z = Math.PI / 2;
	}
	box('#f8edce', [1.95, 0.14, 0.2], [0, 0.65, 1.67]);
	// A tiny Rumi guide rides in the open jeep.
	sphere(group, '#deae79', [0, 1.77, 0.65], [0.36, 0.37, 0.31]);
	for (const x of [-0.3, 0.3]) sphere(group, '#deae79', [x, 2.02, 0.65], [0.14, 0.14, 0.1]);
	sphere(group, '#f5dcc0', [0, 1.68, 0.9], [0.23, 0.17, 0.08]);
	for (const x of [-0.12, 0.12]) sphere(group, '#293e38', [x, 1.84, 0.93], [0.035, 0.045, 0.025]);
	box('#f8e3a4', [0.7, 0.12, 0.55], [0, 1.48, 0.68]);
	return group;
}
