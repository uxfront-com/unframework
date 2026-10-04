// The props object a rerender updates (browser). Svelte 5 reads a component's props from the
// object `mount` receives, and a `$state` proxy makes reading them reactive: a key assigned is
// a new value, and a key deleted falls back to the `$props()` default. A `.svelte.ts` module,
// so that the Svelte compiler turns `$state` into its runtime call.

/** Props that a rerender replaces whole. */
export interface ReactiveProps {
  /** The object to mount the component with. */
  readonly props: Record<string, unknown>;
  /** Deletes the keys `next` lacks, then assigns the others. */
  replace(next: Readonly<Record<string, unknown>>): void;
}

/** A `$state` props object, starting with `initial`'s keys. */
export function reactiveProps(initial: Readonly<Record<string, unknown>>): ReactiveProps {
  const props: Record<string, unknown> = $state({ ...initial });
  return {
    props,
    replace(next) {
      for (const key of Object.keys(props)) {
        if (!Object.hasOwn(next, key)) Reflect.deleteProperty(props, key);
      }
      Object.assign(props, next);
    },
  };
}
