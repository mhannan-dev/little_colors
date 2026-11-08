import { HEIGHT, key, SIZE, type Block, type Cell } from './blocks.ts';

type Vec = [number, number, number];
export type Hit = { cell: Cell; normal: Cell; floor: boolean };
/** ghost: 0 = real block, 1 = preview/idea shadow, 2 = the idea block to fill next. */
type Face = { points: Vec[]; color: string; shade: number; depth: number; layer: number; hit?: Hit; ghost: 0 | 1 | 2 };
export type Guide = { cells: Block[]; next?: Cell | null };
export type ScreenFace = { points: [number, number][]; hit: Hit };
const sides: { normal: Cell; vertices: Vec[]; shade: number }[] = [
	{ normal: {x:0,y:1,z:0}, vertices: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], shade: 1 },
	{ normal: {x:1,y:0,z:0}, vertices: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], shade: 0.81 },
	{ normal: {x:-1,y:0,z:0}, vertices: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], shade: 0.85 },
	{ normal: {x:0,y:0,z:1}, vertices: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], shade: 0.89 },
	{ normal: {x:0,y:0,z:-1}, vertices: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], shade: 0.76 }
];

/** Camera looks down at the mat from this angle, so the tops of blocks always show. */
const PITCH = 0.62;
const DISTANCE = 40;

/**
 * Orbit camera that frames the whole mat plus the building (and one empty layer above it),
 * so the top of a build never leaves the screen, however tall it gets.
 */
function makeCamera(width: number, height: number, angle: number, zoom: number, buildTop: number) {
	const sin = Math.sin(angle), cos = Math.cos(angle);
	const sp = Math.sin(PITCH), cp = Math.cos(PITCH);
	const fitTop = Math.min(HEIGHT, Math.max(3, buildTop + 1));
	const targetY = fitTop / 2;
	/** [screen-right, screen-up, depth] in world units; larger depth = farther away. */
	const view = ([x,y,z]: Vec): Vec => {
		const right = x*cos - z*sin;
		const toward = x*sin + z*cos;
		const up = y - targetY;
		return [right, up*cp - toward*sp, DISTANCE - (up*sp + toward*cp)];
	};
	// Fit the box (mat + build height) into the canvas with a little margin.
	const h = SIZE/2;
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (const x of [-h,h]) for (const y of [-0.3,fitTop]) for (const z of [-h,h]) {
		const [vx,vy,vd] = view([x,y,z]);
		const px = vx/vd, py = vy/vd;
		minX = Math.min(minX,px); maxX = Math.max(maxX,px); minY = Math.min(minY,py); maxY = Math.max(maxY,py);
	}
	const focal = Math.min((width*0.92)/(maxX-minX), (height*0.9)/(maxY-minY))*zoom;
	const cx = width/2 - ((minX+maxX)/2)*focal;
	const cy = height/2 + ((minY+maxY)/2)*focal;
	const project = (p: Vec): [number,number] => {
		const [vx,vy,vd] = view(p);
		return [cx + vx*focal/vd, cy - vy*focal/vd];
	};
	// Camera position in world space, for hiding faces that point away from it.
	const eye: Vec = [sin*DISTANCE*cp, targetY + DISTANCE*sp, cos*DISTANCE*cp];
	return { view, project, eye };
}

export function paint(ctx: CanvasRenderingContext2D, width: number, height: number, blocks: Block[], angle: number, zoom: number, preview?: Block, guide?: Guide): ScreenFace[] {
	const faces: Face[] = [];
	const buildTop = topOf(blocks, guide);
	const { view, project, eye } = makeCamera(width, height, angle, zoom, buildTop);
	ctx.clearRect(0,0,width,height);
	const sky = ctx.createLinearGradient(0,0,0,height);
	sky.addColorStop(0,'#dfedec'); sky.addColorStop(1,'#faf2dc');
	ctx.fillStyle = sky; ctx.fillRect(0,0,width,height);
	ctx.fillStyle = '#fff8d7'; ctx.beginPath(); ctx.arc(width*0.86,height*0.16,height*0.07,0,Math.PI*2); ctx.fill();
	ctx.fillStyle = '#ffffff65';
	for (const [x,y,r] of [[0.15,0.15,0.035],[0.19,0.15,0.05],[0.24,0.16,0.035],[0.72,0.12,0.025],[0.76,0.12,0.035]]) {
		ctx.beginPath(); ctx.ellipse(width*x,height*y,width*r,height*0.027,0,0,Math.PI*2); ctx.fill();
	}
	function face(points: Vec[], color: string, shade: number, layer: number, hit?: Hit, ghost: 0 | 1 | 2 = 0) {
		faces.push({ points,color,shade,layer,hit,ghost,depth: points.reduce((sum,p)=>sum+view(p)[2],0)/points.length });
	}
	const occupied = new Set(blocks.map(key));
	const h = SIZE/2;
	function cube(block: Block, ghost: 0 | 1 | 2 = 0) {
		for (const side of sides) {
			const n = side.normal;
			if (!ghost && occupied.has(key({x:block.x+n.x,y:block.y+n.y,z:block.z+n.z}))) continue;
			const mid: Vec = [block.x+0.5-h,block.y+0.5,block.z+0.5-h];
			if (n.x*(eye[0]-mid[0])+n.y*(eye[1]-mid[1])+n.z*(eye[2]-mid[2]) <= 0) continue;
			face(side.vertices.map(([x,y,z]): Vec=>[block.x+x-h,block.y+y,block.z+z-h]),block.color,side.shade,1,ghost ? undefined : {cell:block,normal:n,floor:false},ghost);
		}
	}
	// All ground faces precede the blocks, so distant tiles never cover a building.
	face([[-h,-0.3,h],[h,-0.3,h],[h,0,h],[-h,0,h]],'#9aad88',0.9,0);
	face([[h,-0.3,-h],[h,-0.3,h],[h,0,h],[h,0,-h]],'#9aad88',0.8,0);
	face([[-h,-0.3,-h],[-h,0,-h],[-h,0,h],[-h,-0.3,h]],'#9aad88',0.8,0);
	face([[-h,-0.3,-h],[h,-0.3,-h],[h,0,-h],[-h,0,-h]],'#9aad88',0.85,0);
	for (let x=0;x<SIZE;x++) for (let z=0;z<SIZE;z++) {
		face([[x-h,0,z-h],[x-h,0,z-h+1],[x-h+1,0,z-h+1],[x-h+1,0,z-h]],(x+z)%2===0 ? '#c3d5ad' : '#b9cda2',1,0,{cell:{x,y:-1,z},normal:{x:0,y:1,z:0},floor:true});
	}
	blocks.forEach(block=>cube(block));
	if (guide) for (const c of guide.cells) {
		if (occupied.has(key(c))) continue;
		const isNext = !!guide.next && key(guide.next) === key(c);
		cube(c, isNext ? 2 : 1);
	}
	if (preview) cube(preview,1);
	faces.sort((a,b)=>a.layer-b.layer || b.depth-a.depth);
	const screen: ScreenFace[] = [];
	for (const f of faces) {
		const points = f.points.map(project);
		ctx.beginPath(); points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
		const rgb = f.color.match(/[a-f\d]{2}/gi)!.map(hex=>Math.round(parseInt(hex,16)*f.shade));
		ctx.fillStyle = `rgba(${rgb.join(',')},${f.ghost === 2 ? 0.62 : f.ghost ? 0.32 : 1})`; ctx.fill();
		ctx.strokeStyle = f.ghost ? '#ffffff' : f.layer===0 ? '#6e8e6255' : '#504a3d30';
		ctx.lineWidth = f.ghost === 2 ? 3.5 : f.ghost ? 2 : 0.8;
		ctx.setLineDash(f.ghost ? [5,4] : []); ctx.stroke(); ctx.setLineDash([]);
		if (f.hit) screen.push({points,hit:f.hit});
	}
	return screen;
}

const topOf = (blocks: Block[], guide?: Guide) =>
	[...blocks, ...(guide?.cells ?? [])].reduce((top,b) => Math.max(top,b.y+1), 0);

/** Screen point (canvas CSS px) of the middle of a block's top face, e.g. for the pointing hand. */
export function cellCenter(width: number, height: number, blocks: Block[], angle: number, zoom: number, cell: Cell, guide?: Guide): [number, number] {
	const { project } = makeCamera(width, height, angle, zoom, topOf(blocks, guide));
	const h = SIZE/2;
	return project([cell.x+0.5-h, cell.y+1, cell.z+0.5-h]);
}

/** Pick the nearest visible polygon, using exactly the order used to paint the scene. */
export function pick(faces: ScreenFace[], x: number, y: number): Hit | undefined {
	for (let f=faces.length-1;f>=0;f--) {
		const points = faces[f].points;
		let inside = false;
		for (let i=0,j=points.length-1;i<points.length;j=i++) {
			const [xi,yi] = points[i], [xj,yj] = points[j];
			if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
		}
		if (inside) return faces[f].hit;
	}
	return undefined;
}
