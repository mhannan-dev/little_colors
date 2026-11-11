import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, Vector2 } from 'three';

export type Surface = 'wood' | 'plastic';

/** Tiny, seamless material maps generated once per stage and shared by its meshes. */
export function createSurfaceMaps(surface: Surface) {
	const size = 64;
	const normal = new Uint8Array(size * size * 4);
	const roughness = new Uint8Array(normal.length);
	function height(x: number, y: number) {
		const u = x / size * 2 * Math.PI;
		const v = y / size * 2 * Math.PI;
		return surface === 'wood'
			? Math.sin(v * 11 + 0.65 * Math.sin(u * 2)) * 0.23 + Math.sin(v * 23 + u) * 0.08
			: Math.sin(u * 17 + v * 9) * Math.cos(v * 15 - u * 12) * 0.045;
	}
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const offset = (y * size + x) * 4;
		const dx = height(x - 1, y) - height(x + 1, y);
		const dy = height(x, y - 1) - height(x, y + 1);
		const length = Math.hypot(dx, dy, 1);
		normal.set([(dx / length + 1) * 127.5, (dy / length + 1) * 127.5, (1 / length + 1) * 127.5, 255], offset);
		const grain = 217 + 95 * height(x, y);
		roughness.set([grain, grain, grain, 255], offset);
	}
	function texture(data: Uint8Array<ArrayBuffer>) {
		const map = new DataTexture(data, size, size, RGBAFormat);
		map.wrapS = map.wrapT = RepeatWrapping;
		map.generateMipmaps = true;
		map.minFilter = LinearMipmapLinearFilter;
		map.magFilter = LinearFilter;
		map.needsUpdate = true;
		return map;
	}
	return { normalMap: texture(normal), roughnessMap: texture(roughness), normalScale: new Vector2(0.36, 0.36) };
}
