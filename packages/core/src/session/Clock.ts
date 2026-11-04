export interface Clock {
	now(): number;
	/** Returns an idempotent cancellation function. */
	setTimeout(fn: () => void, ms: number): () => void;
}
