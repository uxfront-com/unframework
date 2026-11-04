<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Book {
    id: number;
    title: string;
  }

  export interface BookShelfProps {
    books: Book[];
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = BookShelfProps & {
    onmoved?: (title: string, previous: string) => void;
    oncounted?: (summary: string) => void;
    ontoggled?: (open: boolean) => void;
    onbusy?: (label: string, loading: boolean) => void;
    onsummed?: (total: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let {
    books,
    onmoved,
    oncounted,
    ontoggled,
    onbusy,
    onsummed,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  let focused = $state.raw<Book | null>(null);
  let reads = $state.raw(new Map<number, number>());
  let open = $state(false);
  let label = $state("Idle");
  let loading = $state(false);
  let low = $state(1);
  let high = $state(5);

  let previousFocused = untrack(() => focused);
  $effect.pre(() => {
    const book = focused;
    if (Object.is(book, previousFocused)) return;
    const previous = previousFocused;
    previousFocused = book;
    untrack(() => {
      onmoved?.(book?.title ?? "none", previous?.title ?? "none");
    });
  });

  let previousReads = untrack(() => reads);
  $effect.pre(() => {
    const next = reads;
    if (Object.is(next, previousReads)) return;
    previousReads = next;
    untrack(() => {
      oncounted?.([...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
    });
  });

  let previousOpen = untrack(() => open);
  let openWatched = false;
  $effect.pre(() => {
    const value = open;
    if (openWatched && Object.is(value, previousOpen)) return;
    openWatched = true;
    previousOpen = value;
    untrack(() => {
      ontoggled?.(value);
    });
  });

  let previousLabelLoading = untrack((): [typeof label, typeof loading] => [label, loading]);
  $effect.pre(() => {
    const values_1: [typeof label, typeof loading] = [label, loading];
    if (values_1.every((value, index) => Object.is(value, previousLabelLoading[index]))) return;
    previousLabelLoading = values_1;
    untrack(() => {
      const [nextLabel, nextLoading] = values_1;
      onbusy?.(nextLabel, nextLoading);
    });
  });

  let previousValues = untrack((): [typeof low, typeof high] => [low, high]);
  $effect.pre(() => {
    const values: [typeof low, typeof high] = [low, high];
    if (values.every((value, index) => Object.is(value, previousValues[index]))) return;
    previousValues = values;
    untrack(() => {
      onsummed?.(sum(values));
    });
  });

  function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  function focus(book: Book) {
    focused = book;
  }

  function peek(book: Book) {
    const before = focused;
    focused = book;
    focused = before;
  }

  function read(book: Book) {
    const next = new Map(reads);
    next.set(book.id, (next.get(book.id) ?? 0) + 1);
    reads = next;
  }

  function reread() {
    const before = reads;
    reads = new Map();
    reads = before;
  }

  function start() {
    label = "Loading";
    loading = true;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["book-shelf", className]}
  aria-label="Books"
  {style}
  {...scopeAttributes(attributes)}
>
  <ul aria-label="Shelf">
    {#each books as book (book.id)}
      <li>
        <span>{book.title}</span
        ><button type="button" onclick={() => focus(book)}>{`Focus ${book.title}`}</button
        ><button type="button" onclick={() => peek(book)}>{`Peek ${book.title}`}</button
        ><button type="button" onclick={() => read(book)}>{`Read ${book.title}`}</button>
      </li>
    {/each}
  </ul
  ><p>Focused: {focused?.title ?? "none"}</p
  ><p>Books read: {reads.size}</p
  ><button type="button" onclick={reread}>Count again</button
  ><button type="button" aria-expanded={open} onclick={() => (open = !open)}>Details</button
  ><button type="button" onclick={start}>Start</button
  ><p role="status">{label}: {loading ? "busy" : "idle"}</p
  ><button type="button" onclick={() => (high += 1)}>Raise the limit</button
  ><p>Range: {low} to {high}</p>
</section>
