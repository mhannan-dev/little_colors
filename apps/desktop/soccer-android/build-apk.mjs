import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('.', import.meta.url));
const output = fileURLToPath(new URL('../../../test-results/world-soccer-android/', import.meta.url));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const jdk = process.env.JAVA_HOME;
if (!sdk || !jdk) throw new Error('Set ANDROID_HOME to an Android SDK and JAVA_HOME to JDK 17 or newer.');

const buildTools = join(sdk, 'build-tools');
const version = readdirSync(buildTools).filter(name => /^\d+\.\d+\.\d+$/.test(name))
	.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
if (!version) throw new Error('Install Android SDK Build Tools.');
const binaries = join(buildTools, version);
const suffix = process.platform === 'win32' ? '.exe' : '';
const java = (name) => join(jdk, 'bin', name + suffix);
const android = (name) => join(binaries, name + suffix);
const platform = join(sdk, 'platforms', 'android-35', 'android.jar');
const classes = join(output, 'classes');
const classesJar = join(output, 'classes.jar');
const resources = join(output, 'resources.zip');
const unsigned = join(output, 'unsigned.apk');
const aligned = join(output, 'aligned.apk');
const apk = join(output, 'World-Soccer-Cup.apk');
const debugKey = join(output, 'debug.keystore');

function run(command, args, cwd = output) {
	const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

if (!existsSync(platform)) throw new Error('Install the Android 35 SDK platform.');
mkdirSync(classes, { recursive: true });
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'soccer-android/vite.config.ts'], join(source, '..'));
run(java('javac'), ['--release', '8', '-classpath', platform, '-d', classes, join(source, 'MainActivity.java')]);
run(java('jar'), ['cf', classesJar, '-C', classes, '.']);
run(java('java'), ['-cp', join(binaries, 'lib', 'd8.jar'), 'com.android.tools.r8.D8', '--lib', platform, '--min-api', '26', '--output', output, classesJar]);
run(android('aapt2'), ['compile', '--dir', join(source, 'res'), '-o', resources]);
run(android('aapt2'), ['link', '-I', platform, '--manifest', join(source, 'AndroidManifest.xml'), '-A', join(output, 'web'), '-o', unsigned, resources]);
run(java('jar'), ['uf', unsigned, 'classes.dex']);
run(android('zipalign'), ['-f', '4', unsigned, aligned]);
if (!existsSync(debugKey)) {
	run(java('keytool'), ['-genkeypair', '-keystore', debugKey, '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey',
		'-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US']);
}
const signer = join(binaries, 'lib', 'apksigner.jar');
run(java('java'), ['-jar', signer, 'sign', '--ks', debugKey, '--ks-pass', 'pass:android', '--out', apk, aligned]);
run(java('java'), ['-jar', signer, 'verify', '--verbose', apk]);
console.log(`APK: ${apk}`);
