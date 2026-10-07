<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  type Props = {
    onqueryrun?: (value: string, previous: string) => void;
    onpagerun?: (value: number, previous: number) => void;
    oncleanedup?: (watcher: string) => void;
  };

  let { onqueryrun, onpagerun, oncleanedup }: Props = $props();

  let query = $state("");
  let page = $state(1);

  let previousQuery = untrack(() => query);
  let cleanupQuery: (() => void) | undefined;
  $effect.pre(() => {
    const value = query;
    if (Object.is(value, previousQuery)) return;
    const previous = previousQuery;
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
      onqueryrun?.(value, previous);
      onCleanup(() => {
        oncleanedup?.("query");
      });
    });
  });
  onMount(() => () => cleanupQuery?.());

  let previousPage = untrack(() => page);
  $effect.pre(() => {
    const value = page;
    if (Object.is(value, previousPage)) return;
    const previous = previousPage;
    previousPage = value;
    untrack(() => {
      onpagerun?.(value, previous);
    });
  });

  function search(term: string) {
    query = term;
    query = query.toLowerCase();
    page = 1;
  }

  function nextPage() {
    page += 1;
  }

  function skipTwoPages() {
    page += 1;
    page += 1;
  }
</script>

<section class="search-pager" aria-label="Search">
  <p role="status">{query === "" ? "All results" : `Results for ${query}`}, page {page}</p
  ><button type="button" onclick={() => search("Boots")}>Search boots</button
  ><button type="button" onclick={() => search("Sandals")}>Search sandals</button
  ><button type="button" onclick={nextPage}>Next page</button
  ><button type="button" onclick={skipTwoPages}>Skip two pages</button>
</section>
