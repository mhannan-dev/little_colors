<script lang="ts">
	let { reducedMotion }: { reducedMotion: boolean } = $props();
	let canvas = $state<HTMLCanvasElement>();
	let ready = $state(false);

	$effect(() => {
		if (!canvas || reducedMotion) return;
		const surface = canvas;
		const gl = surface.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
		if (!gl) return;

		let active = true;
		let frame = 0;
		let dispose: (() => void) | undefined;
		function hideBadge() {
			active = false;
			cancelAnimationFrame(frame);
			ready = false;
		}
		surface.addEventListener('webglcontextlost', hideBadge);

		void import('three').then(THREE => {
			if (!active) return;
			const renderer = new THREE.WebGLRenderer({ canvas: surface, context: gl });
			const scene = new THREE.Scene();
			const camera = new THREE.OrthographicCamera(-1.45, 1.45, 1.45, -1.45, 0.1, 20);
			camera.position.z = 5;
			const medal = new THREE.Group();
			scene.add(medal, new THREE.HemisphereLight(0xfff8dd, 0x846445, 2));
			const light = new THREE.DirectionalLight(0xffffff, 3);
			light.position.set(-2, 3, 4);
			scene.add(light);

			const gold = new THREE.MeshStandardMaterial({ color: 0xf9ae2b, roughness: 0.4, metalness: 0.3 });
			const dark = new THREE.MeshStandardMaterial({ color: 0x885321, roughness: 0.55 });
			const cream = new THREE.MeshStandardMaterial({ color: 0xffe898, roughness: 0.5 });
			const rim = new THREE.CylinderGeometry(1.12, 1.12, 0.22, 64);
			const inset = new THREE.CylinderGeometry(0.91, 0.91, 0.06, 64);
			const shape = new THREE.Shape();
			for (let i = 0; i < 10; i++) {
				const angle = Math.PI / 2 + i * Math.PI / 5;
				const radius = i % 2 === 0 ? 0.65 : 0.32;
				const x = Math.cos(angle) * radius;
				const y = Math.sin(angle) * radius;
				if (i === 0) shape.moveTo(x, y);
				else shape.lineTo(x, y);
			}
			shape.closePath();
			const star = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelSize: 0.035, bevelThickness: 0.025 });
			for (const [geometry, material, z] of [[rim, gold, 0], [inset, dark, 0.11]] as const) {
				const disc = new THREE.Mesh(geometry, material);
				disc.rotation.x = Math.PI / 2;
				disc.position.z = z;
				medal.add(disc);
			}
			const emblem = new THREE.Mesh(star, cream);
			emblem.position.z = 0.17;
			medal.add(emblem);

			dispose = () => {
				for (const resource of [rim, inset, star, gold, dark, cream]) resource.dispose();
				renderer.dispose();
				renderer.forceContextLoss();
			};
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
			renderer.setSize(192, 192, false);

			const start = performance.now();
			function draw(now: number) {
				const progress = Math.min((now - start) / 850, 1);
				const turn = (1 - progress) ** 3;
				medal.rotation.set(turn * 0.35, turn * -1.1, turn * 0.22);
				medal.scale.setScalar(1 - turn * 0.25);
				renderer.render(scene, camera);
				ready = true;
				if (progress < 1 && active) frame = requestAnimationFrame(draw);
			}
			draw(start);
		}).catch(hideBadge);

		return () => {
			hideBadge();
			surface.removeEventListener('webglcontextlost', hideBadge);
			dispose?.();
		};
	});
</script>

<div class="medal" aria-hidden="true">
	<svg class:hidden={ready} viewBox="0 0 120 120" width="192" height="192">
		<circle cx="60" cy="60" r="46" fill="#f9ae2b" stroke="#885321" stroke-width="3" />
		<circle cx="60" cy="60" r="37" fill="#885321" stroke="#ffcf68" stroke-width="2" />
		<path d="M60 33 67 51 87 52 72 65 76 85 60 74 44 85 48 65 33 52 53 51Z" fill="#ffe898" />
	</svg>
	{#if !reducedMotion}<canvas bind:this={canvas} class:hidden={!ready}></canvas>{/if}
</div>

<style>
	.medal { position: relative; width: 192px; height: 192px; }
	svg, canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
	.hidden { visibility: hidden; }
</style>
