import { defineConfig } from 'vitest/config';

// Property tests run 1,000+ seeds per case (QA-03); under a full parallel run some exceed
// Vitest's 5 s default. Give them room instead of shrinking the seed counts.
export default defineConfig({
	test: {
		testTimeout: 60_000
	}
});
