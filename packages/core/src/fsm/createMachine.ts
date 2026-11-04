/**
 * Minimal, framework-free finite state machine (spec 04, "State machine pattern").
 *
 * - Transitions are declared per state and event type: `{ target, guard?, reduce?, effects? }`.
 * - A transition may be a list of guarded specs; the first whose guard passes is used.
 * - Events with no matching transition, or whose guard rejects them, are ignored.
 * - `reduce` computes the next context; without it the context object is preserved.
 * - `effects` returns plain side-effect descriptors that the app layer executes
 *   (animations, narration), keeping the machine pure and testable.
 * - A transition is atomic: if `reduce` or `effects` throws, state and context are unchanged.
 */
type EventOf<E extends { type: string }, T extends E['type']> = Extract<E, { type: T }>;

export interface TransitionSpec<S extends string, E extends { type: string }, C, F> {
	target: S;
	guard?: (context: C, event: E) => boolean;
	reduce?: (context: C, event: E) => C;
	/** Receives the context before and after `reduce`. */
	effects?: (context: C, event: E, next: C) => F[];
}

export type StateTransitions<S extends string, E extends { type: string }, C, F> = {
	[T in E['type']]?:
		| TransitionSpec<S, EventOf<E, T>, C, F>
		| readonly TransitionSpec<S, EventOf<E, T>, C, F>[];
};

export interface MachineConfig<S extends string, E extends { type: string }, C, F = never> {
	initialState: S;
	initialContext: () => C;
	transitions: { [K in S]?: StateTransitions<S, E, C, F> };
	/** Transitions available in every state; checked only when the current state has none. */
	global?: StateTransitions<S, E, C, F>;
}

export interface Machine<S extends string, E extends { type: string }, C, F = never> {
	readonly state: S;
	readonly context: C;
	/** Returns true when the event caused a transition. */
	send(event: E): boolean;
	subscribe(listener: (state: S, context: C) => void): () => void;
	onEffect(listener: (effect: F) => void): () => void;
	reset(): void;
}

export function createMachine<S extends string, E extends { type: string }, C, F = never>(
	config: MachineConfig<S, E, C, F>
): Machine<S, E, C, F> {
	let state: S = config.initialState;
	let context: C = config.initialContext();
	// Wrapper objects so the same callback can be subscribed twice independently.
	const listeners = new Set<{ fn: (state: S, context: C) => void }>();
	const effectListeners = new Set<{ fn: (effect: F) => void }>();

	const notify = () => {
		for (const l of [...listeners]) l.fn(state, context);
	};

	const lookup = (type: E['type']) =>
		(config.transitions[state]?.[type] ?? config.global?.[type]) as
			| TransitionSpec<S, E, C, F>
			| readonly TransitionSpec<S, E, C, F>[]
			| undefined;

	return {
		get state() {
			return state;
		},
		get context() {
			return context;
		},
		send(event) {
			const found = lookup(event.type as E['type']);
			const candidates = found === undefined ? [] : Array.isArray(found) ? found : [found];
			const spec = (candidates as TransitionSpec<S, E, C, F>[]).find(
				(c) => !c.guard || c.guard(context, event)
			);
			if (!spec) return false;
			const next = spec.reduce ? spec.reduce(context, event) : context;
			const effects = spec.effects ? spec.effects(context, event, next) : [];
			state = spec.target;
			context = next;
			notify();
			for (const effect of effects) {
				for (const l of [...effectListeners]) l.fn(effect);
			}
			return true;
		},
		subscribe(fn) {
			const entry = { fn };
			listeners.add(entry);
			fn(state, context);
			return () => {
				listeners.delete(entry);
			};
		},
		onEffect(fn) {
			const entry = { fn };
			effectListeners.add(entry);
			return () => {
				effectListeners.delete(entry);
			};
		},
		reset() {
			state = config.initialState;
			context = config.initialContext();
			notify();
		}
	};
}
