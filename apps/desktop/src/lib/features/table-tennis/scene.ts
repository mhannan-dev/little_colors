import { createStage, THREE } from '#lib/three3d/toyKit.ts';
import { TABLE, type TableTennisGame } from './game.ts';

/** Procedural meshes keep the game offline and avoid external model downloads. */
export function createTableTennisScene(canvas: HTMLCanvasElement) {
	const stage = createStage(canvas, { background: '#e7f2f0', skyTop: '#bcd9ee', fov: 42 });
	stage.camera.position.set(0, 6.5, 7.8);
	stage.camera.lookAt(0, 0.8, 0);
	const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		stage.scene.add(mesh);
		return mesh;
	};
	box(18, 0.15, 18, '#d2c7ac', 0, -0.12, 0);
	box(4.12, 0.18, 7.12, '#123d4c', 0, 0.86, 0);
	box(4, 0.1, 7, '#237a8a', 0, 0.95, 0);
	for (const x of [-1.98, 1.98]) box(0.035, 0.012, 7, '#fff9dc', x, 1.008, 0);
	for (const z of [-3.48, 3.48]) box(4, 0.012, 0.035, '#fff9dc', 0, 1.008, z);
	box(0.025, 0.012, 7, '#fff9dc', 0, 1.008, 0);
	for (const x of [-1.5, 1.5]) {
		for (const z of [-2.6, 2.6]) box(0.16, 0.85, 0.16, '#374552', x, 0.4, z);
		box(0.06, 0.48, 0.06, '#fff9dc', x * 1.4, 1.23, 0);
	}
	// Thin bars form a see-through net without textures or transparency sorting.
	for (let x = -2.1; x <= 2.1; x += 0.15) box(0.012, 0.34, 0.012, '#d4e5e5', x, 1.19, 0);
	for (let y = 1.03; y <= 1.37; y += 0.085) box(4.2, 0.012, 0.012, '#d4e5e5', 0, y, 0);
	box(4.25, 0.035, 0.035, '#ffffff', 0, 1.39, 0);
	const paddle = (color: string, z: number) => {
		const group = new THREE.Group();
		const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 32), new THREE.MeshStandardMaterial({ color }));
		blade.rotation.x = Math.PI / 2;
		blade.castShadow = true;
		group.add(blade);
		const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.1), new THREE.MeshStandardMaterial({ color: '#d8ae78' }));
		handle.position.y = -0.58;
		group.add(handle);
		group.position.set(0, 1.35, z);
		stage.scene.add(group);
		return group;
	};
	const player = paddle('#ee654b', TABLE.paddleZ);
	const computer = paddle('#485bc2', -TABLE.paddleZ);
	const ball = new THREE.Mesh(new THREE.SphereGeometry(TABLE.ballRadius, 20, 16), new THREE.MeshStandardMaterial({ color: '#fff9d6', roughness: 0.35 }));
	ball.castShadow = true;
	stage.scene.add(ball);
	return {
		stage,
		update(game: TableTennisGame) {
			player.position.x = game.playerX;
			computer.position.x = game.computerX;
			ball.position.set(game.ball.x, game.ball.y, game.ball.z);
		}
	};
}
