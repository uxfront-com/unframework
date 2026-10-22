<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onunmounted?: () => void;
    oneffectcleaned?: (query: string) => void;
    onwatchcleaned?: (query: string) => void;
    onsearched?: (query: string, count: number) => void;
    onsearchcleaned?: (query: string) => void;
    onsummary?: (text: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let {
    onunmounted,
    oneffectcleaned,
    onwatchcleaned,
    onsearched,
    onsearchcleaned,
    onsummary,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  let query = $state("");
  let results = $state.raw<string[]>([]);

  $effect(() => {
    const value = query;
    return () => {
      oneffectcleaned?.(value);
    };
  });

  let previousQuery = untrack(() => query);
  let queryWatched = false;
  let cleanupQuery: (() => void) | undefined;
  $effect.pre(() => {
    const value = query;
    if (queryWatched && Object.is(value, previousQuery)) return;
    queryWatched = true;
    previousQuery = value;
    untrack(() => {
      cleanupQuery?.();
      const cleanups: (() => void)[] = [];
      cleanupQuery = () => {
        for (const cleanup of cleanups) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups.push(cleanup);
      };
      onCleanup(() => {
        onwatchcleaned?.(value);
      });
    });
  });
  onMount(() => () => cleanupQuery?.());

  let previousQuery_1 = untrack(() => query);
  $effect.pre(() => {
    const value = query;
    if (Object.is(value, previousQuery_1)) return;
    previousQuery_1 = value;
    untrack(() => {
      results = value === "" ? [] : [value, `${value} docs`];
    });
  });

  let previousQuery_2 = untrack(() => query);
  let cleanupQuery_1: (() => void) | undefined;
  $effect(() => {
    const value = query;
    if (Object.is(value, previousQuery_2)) return;
    previousQuery_2 = value;
    untrack(() => {
      cleanupQuery_1?.();
      const cleanups_1: (() => void)[] = [];
      cleanupQuery_1 = () => {
        for (const cleanup of cleanups_1) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups_1.push(cleanup);
      };
      onsearched?.(value, results.length);
      onCleanup(() => {
        onsearchcleaned?.(value);
      });
    });
  });
  onMount(() => () => cleanupQuery_1?.());

  onMount(() => () => {
    onunmounted?.();
  });

  $effect(() => {
    onsummary?.(`${results.length} results for "${query}"`);
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["search-session", className]}
  aria-label="Search"
  {style}
  {...scopeAttributes(attributes)}
>
  <label>Query<input
    name="query"
    oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
  /></label
  ><ul aria-label="Results">
    {#each results as result (result)}
      <li>{result}</li>
    {/each}
  </ul
  ><button type="button" onclick={() => (results = [])}>Clear results</button>
</section>
