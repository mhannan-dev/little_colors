const canvas = document.getElementById('formula-canvas');
const status = document.getElementById('status');

window.addEventListener('keydown', event => {
	if (event.code === 'Escape' && window.parent !== window) {
		event.preventDefault();
		window.parent.postMessage('formula-circuit-back', window.location.origin);
	}
}, { capture: true });

try {
	const { default: start } = await import('./generated/formula_circuit.js');
	await start();
	status.hidden = true;
	canvas.focus();
} catch (cause) {
	status.textContent = 'Formula Circuit could not start. In a source checkout, run pnpm --filter desktop build:formula and reload the game.';
	console.error(cause);
}
