<script lang="ts">
	import type { LevelConfig, VehicleState } from '../stores/gameStore';
	let { level, state }: { level: LevelConfig; state: VehicleState | null } = $props();
	const extent = $derived(level.roadSpacing * level.gridRadius + level.roadHalfWidth + 1);
	const roads = $derived(Array.from({ length: level.gridRadius * 2 + 1 }, (_, i) => (i - level.gridRadius) * level.roadSpacing));
	const route = $derived([level.depot, ...level.nodes.map(node => node.position)].map(p => `${p.x},${p.z}`).join(' '));
	const bus = $derived(state?.bus.position ?? level.depot);
	const target = $derived(level.nodes[state?.nodeIndex ?? 0]);
</script>

<svg viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`} role="img" aria-label="City route map">
	<rect x={-extent} y={-extent} width={extent * 2} height={extent * 2} fill="#233c45" />
	{#each roads as road (road)}
		<path d={`M ${road} ${-extent} V ${extent} M ${-extent} ${road} H ${extent}`}
			stroke="#577078" stroke-width={level.roadHalfWidth * 2} />
	{/each}
	<polyline points={route} fill="none" stroke="#75e4dc" stroke-width="1.7" stroke-linejoin="round" />
	{#each level.nodes as node, index (index)}
		{#if node.kind !== 'waypoint'}<circle cx={node.position.x} cy={node.position.z} r="2.3" fill="#ffe493" />{/if}
	{/each}
	{#each state?.traffic ?? [] as car, index (index)}
		<circle cx={car.position.x} cy={car.position.z} r="1.3" fill="#efb6a7" />
	{/each}
	{#if target}<circle cx={target.position.x} cy={target.position.z} r="5" fill="none" stroke="#fff2b0" stroke-width="1.6" />{/if}
	<path d="M0 -4.2 3.2 3 -3.2 3Z" fill="#ffb643" stroke="#142630" stroke-width=".8"
		transform={`translate(${bus.x} ${bus.z}) rotate(${(state?.bus.heading ?? level.heading) * 180 / Math.PI})`} />
</svg>

<style>
	svg { display: block; width: 100%; height: 100%; }
</style>
