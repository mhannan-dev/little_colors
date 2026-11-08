/** An 8×8 mat, up to ten blocks high (the camera fits any height). */
export const SIZE = 8;
export const HEIGHT = 10;
export const SAVE_KEY = 'lc.blocks3d.v1';
export const PALETTE = [
	{ hex: '#e58c81', bn: 'প্রবাল লাল', en: 'Coral' },
	{ hex: '#edb75f', bn: 'কমলা', en: 'Orange' },
	{ hex: '#f2d877', bn: 'হলুদ', en: 'Yellow' },
	{ hex: '#8dbb8d', bn: 'সবুজ', en: 'Green' },
	{ hex: '#80b9ce', bn: 'নীল', en: 'Blue' },
	{ hex: '#a598ca', bn: 'বেগুনি', en: 'Purple' },
	{ hex: '#faf0dc', bn: 'ক্রিম', en: 'Cream' },
	{ hex: '#a78169', bn: 'বাদামি', en: 'Brown' },
	{ hex: '#ffffff', bn: 'সাদা', en: 'White' },
	{ hex: '#2f3437', bn: 'কালো', en: 'Black' },
	{ hex: '#c9a227', bn: 'সোনালি', en: 'Gold' }
] as const;
export type Cell = { x: number; y: number; z: number };
/** `locked` blocks belong to a sacred model (the Kaaba): they are never taken away or built on (PR-13). */
export type Block = Cell & { color: string; locked?: true };
export type Template = 'house' | 'tower' | 'rainbow' | 'kaaba';
export const key = ({x,y,z}: Cell) => `${x},${y},${z}`;
export const inside = ({x,y,z}: Cell) => Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < HEIGHT;
export function readBuild(raw: string | null): Block[] {
	if (!raw) return [];
	try {
		const data: unknown = JSON.parse(raw);
		if (!Array.isArray(data) || data.length > SIZE*SIZE*HEIGHT) return [];
		const seen = new Set<string>();
		return data.filter((b): b is Block => {
			if (!b || typeof b !== 'object' || !inside(b) || !PALETTE.some(c => c.hex === b.color) || seen.has(key(b))) return false;
			seen.add(key(b)); return true;
		}).map(({x,y,z,color,locked}) => (locked === true ? {x,y,z,color,locked} : {x,y,z,color}));
	} catch { return []; }
}
/** A column that holds part of the Kaaba model cannot be changed. */
export const isLockedColumn = (blocks: Block[], x: number, z: number) => blocks.some(b => b.locked && b.x === x && b.z === z);
export function columnTop(blocks: Block[], x: number, z: number): number {
	return blocks.filter(b => b.x === x && b.z === z).reduce((top,b) => Math.max(top,b.y+1),0);
}
export function template(kind: Template): Block[] {
	const blocks: Block[] = [];
	const add = (x: number,y: number,z: number,color: string) => blocks.push({x,y,z,color});
	if (kind === 'house') {
		// Floor, two storeys of walls with a door and windows, and a two-step roof.
		for (let x=1;x<=6;x++) for (let z=1;z<=6;z++) {
			add(x,0,z,PALETTE[7].hex);
			for (let y=1;y<=2;y++) {
				if (x!==1 && x!==6 && z!==1 && z!==6) continue;
				if (z===6 && (x===3 || x===4) && y===1) continue;
				const window = y===2 && ((z===1 && (x===2 || x===5)) || ((x===1 || x===6) && (z===3 || z===4)));
				add(x,y,z,window ? PALETTE[4].hex : PALETTE[6].hex);
			}
			add(x,3,z,PALETTE[0].hex);
			if (x>=2 && x<=5) add(x,4,z,PALETTE[0].hex);
		}
	} else if (kind === 'tower') {
		for (let y=0;y<4;y++) for (let x=2;x<=5;x++) for (let z=2;z<=5;z++) {
			if (x===2 || x===5 || z===2 || z===5) add(x,y,z,PALETTE[y%6].hex);
		}
		for (let x=1;x<=6;x++) for (let z=1;z<=6;z++) if ((x+z)%2===0 || (x>1 && x<6 && z>1 && z<6)) add(x,4,z,PALETTE[6].hex);
	} else if (kind === 'kaaba') {
		// White courtyard (mataf) all around; the child may build and decorate here.
		for (let x=0;x<SIZE;x++) for (let z=0;z<SIZE;z++) {
			const inKaaba = x>=2 && x<=5 && z>=2 && z<=5;
			if (inKaaba) blocks.push({x,y:0,z,color:PALETTE[9].hex,locked:true});
			else add(x,0,z,PALETTE[8].hex);
		}
		// The Kaaba: a black cube with a gold band near the top and a raised gold door. Locked (PR-13).
		for (let y=1;y<=6;y++) for (let x=2;x<=5;x++) for (let z=2;z<=5;z++) {
			const edge = x===2 || x===5 || z===2 || z===5;
			const band = y===5 && edge;
			const door = z===5 && x===4 && (y===2 || y===3);
			blocks.push({x,y,z,color:band || door ? PALETTE[10].hex : PALETTE[9].hex,locked:true});
		}
	} else {
		for (let x=0;x<SIZE;x++) for (let z=2;z<=5;z++) {
			const top = Math.min(x+1,SIZE-x,HEIGHT);
			for (let y=0;y<top;y++) add(x,y,z,PALETTE[x%6].hex);
		}
	}
	return blocks;
}
