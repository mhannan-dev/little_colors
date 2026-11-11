import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const formula = resolve(here, '../../../examples/formula-circuit');
const target = join(formula, 'target');
const generated = resolve(here, '../static/formula-circuit-web/generated');
const version = readFileSync(join(formula, 'Cargo.lock'), 'utf8')
	.match(/^name = "wasm-bindgen"\r?\nversion = "([^"]+)"/m)?.[1];
if (!version) throw new Error('Formula Circuit Cargo.lock has no wasm-bindgen version.');

const bindgen = process.env.WASM_BINDGEN || 'wasm-bindgen';
const check = spawnSync(bindgen, ['--version'], { encoding: 'utf8', windowsHide: true });
if (check.status !== 0 || check.stdout.trim() !== `wasm-bindgen ${version}`) {
	throw new Error(`Install the matching CLI with cargo install wasm-bindgen-cli --locked --version ${version}, or set WASM_BINDGEN to its path.`);
}

function run(program, args) {
	const result = spawnSync(program, args, {
		cwd: formula, env: { ...process.env, CARGO_TARGET_DIR: target }, stdio: 'inherit', windowsHide: true
	});
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${program} exited with status ${result.status}`);
}

run('cargo', ['build', '--locked', '--target', 'wasm32-unknown-unknown', '--profile', 'wasm']);
mkdirSync(generated, { recursive: true });
run(bindgen, [
	join(target, 'wasm32-unknown-unknown', 'wasm', 'formula-circuit.wasm'),
	'--target', 'web', '--out-dir', generated, '--out-name', 'formula_circuit',
	'--no-typescript', '--remove-name-section'
]);
