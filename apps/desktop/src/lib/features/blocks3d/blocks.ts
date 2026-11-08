export const SIZE = 10;
export const HEIGHT = 8;
export const SAVE_KEY = 'lc.blocks3d.v1';
export const PALETTE = [
	{ hex: '#e58c81', bn: 'প্রবাল লাল', en: 'Coral' },
	{ hex: '#edb75f', bn: 'কমলা', en: 'Orange' },
	{ hex: '#f2d877', bn: 'হলুদ', en: 'Yellow' },
	{ hex: '#8dbb8d', bn: 'সবুজ', en: 'Green' },
	{ hex: '#80b9ce', bn: 'নীল', en: 'Blue' },
	{ hex: '#a598ca', bn: 'বেগুনি', en: 'Purple' },
	{ hex: '#faf0dc', bn: 'ক্রিম', en: 'Cream' },
	{ hex: '#a78169', bn: 'বাদামি', en: 'Brown' }
] as const;
export type Cell = { x: number; y: number; z: number };
export type Block = Cell & { color: string };
export type Template = 'house' | 'tower' | 'rainbow';
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
		}).map(({x,y,z,color}) => ({x,y,z,color}));
	} catch { return []; }
}
export function columnTop(blocks: Block[], x: number, z: number): number {
	return blocks.filter(b => b.x === x && b.z === z).reduce((top,b) => Math.max(top,b.y+1),0);
}
export function template(kind: Template): Block[] {
	const blocks: Block[] = [];
	const add = (x: number,y: number,z: number,color: string) => blocks.push({x,y,z,color});
	if (kind === 'house') {
		for (let x=2;x<=7;x++) for (let z=2;z<=7;z++) {
			add(x,0,z,PALETTE[7].hex);
			for (let y=1;y<=3;y++) {
				if (x!==2 && x!==7 && z!==2 && z!==7) continue;
				if (z===7 && (x===4 || x===5) && y<=2) continue;
				const window = y===2 && ((z===2 && (x===3 || x===6)) || ((x===2 || x===7) && (z===4 || z===5)));
				add(x,y,z,window ? PALETTE[4].hex : PALETTE[6].hex);
			}
		}
		for (let tier=0;tier<3;tier++) for (let x=1+tier;x<=8-tier;x++) for (let z=1;z<=8;z++) add(x,4+tier,z,PALETTE[0].hex);
	} else if (kind === 'tower') {
		for (let y=0;y<6;y++) for (let x=3;x<=6;x++) for (let z=3;z<=6;z++) {
			if (x===3 || x===6 || z===3 || z===6) add(x,y,z,PALETTE[y%6].hex);
		}
		for (let x=2;x<=7;x++) for (let z=2;z<=7;z++) if ((x+z)%2===0 || (x>2 && x<7 && z>2 && z<7)) add(x,6,z,PALETTE[6].hex);
	} else {
		for (let x=1;x<=8;x++) for (let z=3;z<=6;z++) {
			const top = Math.min(x,9-x);
			for (let y=0;y<top;y++) add(x,y,z,PALETTE[(x-1)%6].hex);
		}
	}
	return blocks;
}
