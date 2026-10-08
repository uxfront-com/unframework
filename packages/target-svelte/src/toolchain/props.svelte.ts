// The props object a rerender updates (browser). Svelte 5 reads a component's props from the
// object `mount` receives, as a compiled parent passes them: each read goes through the object
// (`props.title`), so a read of state there makes it reactive. Here each key reads a
// `$state.raw` box of its own: a rerender assigns a key whose value changed, and a key it lacks
// becomes `undefined`, which falls back to the `$props()` default. A value is the caller's own,
// never a deep proxy of it, as a parent that keeps its data in `$state.raw` passes it (and as
// Vue's adapter passes props from a `shallowReactive` object): state given a prop's item is that
// item, which identity and `structuredClone` read as the source does (ADR-0046). A `.svelte.ts`
// module, so that the Svelte compiler turns `$state.raw` into its runtime calls.

/** Props that a rerender replaces whole. */
export interface ReactiveProps {
  /** The object to mount the component with. */
  readonly props: Record<string, unknown>;
  /** Deletes the keys `next` lacks, then assigns the others whose value changed. */
  replace(next: Readonly<Record<string, unknown>>): void;
}

/** One prop's value, raw. */
class Prop {
  value: unknown = $state.raw();

  constructor(value: unknown) {
    this.value = value;
  }
}

/** A props object whose every key reads a `$state.raw` box, starting with `initial`'s keys. */
export function reactiveProps(initial: Readonly<Record<string, unknown>>): ReactiveProps {
  const boxes = new Map(Object.entries(initial).map(([key, value]) => [key, new Prop(value)]));
  // The keys the props hold, for `in` and for a rest pattern.
  let keys: readonly string[] = $state.raw(Object.keys(initial));
  // A key read before a rerender adds it gets its box at that read, so the reader sees it come.
  const box = (key: string): Prop => {
    let found = boxes.get(key);
    if (!found) boxes.set(key, (found = new Prop(undefined)));
    return found;
  };
  const props = new Proxy<Record<string, unknown>>(
    {},
    {
      get: (_, key) => (typeof key === "string" ? box(key).value : undefined),
      has: (_, key) => typeof key === "string" && keys.includes(key),
      ownKeys: () => [...keys],
      getOwnPropertyDescriptor: (_, key) =>
        typeof key === "string" && keys.includes(key)
          ? { value: box(key).value, enumerable: true, configurable: true, writable: true }
          : undefined,
    },
  );
  return {
    props,
    replace(next) {
      for (const key of keys) if (!Object.hasOwn(next, key)) box(key).value = undefined;
      // Only the keys whose value changed, as a parent passes its props: Svelte hands a teardown
      // that runs in this flush a source's value from before it (`old_values`), so a callback
      // prop an effect's teardown calls must keep its box when it did not change.
      for (const [key, value] of Object.entries(next)) {
        const prop = box(key);
        if (!Object.is(prop.value, value)) prop.value = value;
      }
      const nextKeys = Object.keys(next);
      if (nextKeys.join("\0") !== keys.join("\0")) keys = nextKeys;
    },
  };
}
