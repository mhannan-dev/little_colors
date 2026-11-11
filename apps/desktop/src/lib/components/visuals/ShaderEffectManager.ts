import { Camera, Scene, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Opt-in bloom for short feedback moments. Idle frames use the normal renderer. */
export class ShaderEffectManager {
	private composer?: EffectComposer;
	private passes: (RenderPass | UnrealBloomPass | OutputPass)[] = [];
	private width = 1;
	private height = 1;
	private remaining = 0;
	private slowFrames = 0;
	private supported: boolean;

	constructor(private renderer: WebGLRenderer, private scene: Scene, private camera: Camera, bloom: boolean) {
		this.supported = bloom && renderer.extensions.has('EXT_color_buffer_float');
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;
		// Cap the render target independently of device pixel ratio.
		const scale = Math.min(1, 960 / width, 540 / height);
		// UnrealBloomPass builds five mip levels. Keep each dimension large enough for all five.
		this.composer?.setSize(Math.max(32, Math.round(width * scale)), Math.max(32, Math.round(height * scale)));
	}

	/** Warm up on the first scene frame, before a player can trigger a feedback burst. */
	prepare() {
		if (!this.supported || this.composer) return;
		const target = this.renderer.getRenderTarget();
		try {
			const composer = new EffectComposer(this.renderer);
			this.composer = composer;
			composer.setPixelRatio(1);
			const bloom = new UnrealBloomPass(new Vector2(32, 32), 0.24, 0.48, 1.12);
			this.passes = [new RenderPass(this.scene, this.camera), bloom, new OutputPass()];
			for (const pass of this.passes) composer.addPass(pass);
			this.resize(this.width, this.height);
			// Compile hidden instance materials too, in both the direct and linear render paths.
			this.renderer.compile(this.scene, this.camera);
			this.renderer.setRenderTarget(composer.readBuffer);
			this.renderer.compile(this.scene, this.camera);
			this.renderer.setRenderTarget(target);
			composer.renderToScreen = false;
			composer.render(0);
			composer.renderToScreen = true;
		} catch {
			this.dispose();
		} finally {
			this.renderer.setRenderTarget(target);
		}
	}

	pulse(seconds = 0.45) {
		if (!this.composer) return;
		this.remaining = seconds;
		this.slowFrames = 0;
	}

	render(elapsed: number) {
		if (this.composer && this.remaining > 0) {
			this.remaining -= elapsed;
			if (elapsed > 0.024) this.slowFrames++;
			else this.slowFrames = Math.max(0, this.slowFrames - 1);
			if (this.slowFrames >= 4) this.dispose();
			else {
				try { this.composer.render(elapsed); return; }
				catch { this.dispose(); }
			}
		}
		this.renderer.render(this.scene, this.camera);
	}

	clear() { this.remaining = 0; }

	dispose() {
		for (const pass of this.passes) pass.dispose();
		this.passes = [];
		this.composer?.dispose();
		this.composer = undefined;
		this.supported = false;
		this.clear();
	}
}
