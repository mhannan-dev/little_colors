import { key, SIZE, type Block, type Cell } from './blocks.ts';

type Vec = [number, number, number];
export type Hit = { cell: Cell; normal: Cell; floor: boolean };
type Face = { points: Vec[]; color: string; shade: number; depth: number; layer: number; hit?: Hit; ghost?: boolean };
export type ScreenFace = { points: [number, number][]; hit: Hit };
const sides: { normal: Cell; vertices: Vec[]; shade: number }[] = [
	{ normal: {x:0,y:1,z:0}, vertices: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], shade: 1 },
	{ normal: {x:1,y:0,z:0}, vertices: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], shade: 0.81 },
	{ normal: {x:-1,y:0,z:0}, vertices: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], shade: 0.85 },
	{ normal: {x:0,y:0,z:1}, vertices: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], shade: 0.89 },
	{ normal: {x:0,y:0,z:-1}, vertices: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], shade: 0.76 }
];

export function paint(ctx: CanvasRenderingContext2D, width: number, height: number, blocks: Block[], angle: number, zoom: number, preview?: Block): ScreenFace[] {
	const faces: Face[] = [];
	const sin = Math.sin(angle), cos = Math.cos(angle);
	const focal = Math.min(width*1.3,height*2.05)*zoom;
	const camera = ([x,y,z]: Vec): Vec => [x*cos-z*sin, y*0.8-(x*sin+z*cos)*0.6, 25-(x*sin+z*cos)*0.8-y*0.6];
	const project = (p: Vec): [number,number] => {
		const [x,y,z] = camera(p); return [width/2+x*focal/z,height*0.67-y*focal/z];
	};
	ctx.clearRect(0,0,width,height);
	const sky = ctx.createLinearGradient(0,0,0,height);
	sky.addColorStop(0,'#dfedec'); sky.addColorStop(1,'#faf2dc');
	ctx.fillStyle = sky; ctx.fillRect(0,0,width,height);
	ctx.fillStyle = '#fff8d7'; ctx.beginPath(); ctx.arc(width*0.86,height*0.16,height*0.07,0,Math.PI*2); ctx.fill();
	ctx.fillStyle = '#ffffff65';
	for (const [x,y,r] of [[0.15,0.15,0.035],[0.19,0.15,0.05],[0.24,0.16,0.035],[0.72,0.12,0.025],[0.76,0.12,0.035]]) {
		ctx.beginPath(); ctx.ellipse(width*x,height*y,width*r,height*0.027,0,0,Math.PI*2); ctx.fill();
	}
	function face(points: Vec[], color: string, shade: number, layer: number, hit?: Hit, ghost = false) {
		faces.push({ points,color,shade,layer,hit,ghost,depth: points.reduce((sum,p)=>sum+camera(p)[2],0)/points.length });
	}
	const occupied = new Set(blocks.map(key));
	function cube(block: Block, ghost = false) {
		for (const side of sides) {
			const n = side.normal;
			if (!ghost && occupied.has(key({x:block.x+n.x,y:block.y+n.y,z:block.z+n.z}))) continue;
			const mid: Vec = [block.x+0.5-SIZE/2,block.y+0.5,block.z+0.5-SIZE/2];
			if (n.x*(sin*20-mid[0])+n.y*(15-mid[1])+n.z*(cos*20-mid[2]) <= 0) continue;
			face(side.vertices.map(([x,y,z]): Vec=>[block.x+x-SIZE/2,block.y+y,block.z+z-SIZE/2]),block.color,side.shade,1,ghost ? undefined : {cell:block,normal:n,floor:false},ghost);
		}
	}
	// All ground faces precede the blocks, so distant tiles never cover a building.
	face([[-5,-0.3,5],[5,-0.3,5],[5,0,5],[-5,0,5]],'#9aad88',0.9,0);
	face([[5,-0.3,-5],[5,-0.3,5],[5,0,5],[5,0,-5]],'#9aad88',0.8,0);
	face([[-5,-0.3,-5],[-5,0,-5],[-5,0,5],[-5,-0.3,5]],'#9aad88',0.8,0);
	face([[-5,-0.3,-5],[5,-0.3,-5],[5,0,-5],[-5,0,-5]],'#9aad88',0.85,0);
	for (let x=0;x<SIZE;x++) for (let z=0;z<SIZE;z++) {
		face([[x-5,0,z-5],[x-5,0,z-4],[x-4,0,z-4],[x-4,0,z-5]],(x+z)%2===0 ? '#c3d5ad' : '#b9cda2',1,0,{cell:{x,y:-1,z},normal:{x:0,y:1,z:0},floor:true});
	}
	blocks.forEach(block=>cube(block));
	if (preview) cube(preview,true);
	faces.sort((a,b)=>a.layer-b.layer || b.depth-a.depth);
	const screen: ScreenFace[] = [];
	for (const f of faces) {
		const points = f.points.map(project);
		ctx.beginPath(); points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
		const rgb = f.color.match(/[a-f\d]{2}/gi)!.map(hex=>Math.round(parseInt(hex,16)*f.shade));
		ctx.fillStyle = `rgba(${rgb.join(',')},${f.ghost ? 0.4 : 1})`; ctx.fill();
		ctx.strokeStyle = f.ghost ? '#ffffff' : f.layer===0 ? '#6e8e6255' : '#504a3d30';
		ctx.lineWidth = f.ghost ? 2 : 0.8;
		ctx.setLineDash(f.ghost ? [5,4] : []); ctx.stroke(); ctx.setLineDash([]);
		if (f.hit) screen.push({points,hit:f.hit});
	}
	return screen;
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
