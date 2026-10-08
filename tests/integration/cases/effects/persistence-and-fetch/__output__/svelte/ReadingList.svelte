<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  export interface ReadingListProps {
    shelves: string[];
  }

  type Props = ReadingListProps & {
    onrequested?: (url: string) => void;
    oncancelled?: (query: string) => void;
    onfound?: (query: string, count: number) => void;
    onstarted?: () => void;
    onchecked?: (count: number) => void;
    onrefreshed?: (total: number) => void;
  };

  let { shelves, onrequested, oncancelled, onfound, onstarted, onchecked, onrefreshed }: Props =
    $props();

  let query = $state("");
  let books = $state.raw<string[]>([]);
  let searching = $state(false);
  let failure = $state("");
  let shelf = $state("all");
  let checking = $state(false);
  let checks = $state(0);
  let counts = $state.raw<Record<string, number>>({});
  let refreshing = $state(false);
  let checker: ReturnType<typeof setInterval> | undefined;

  let previousShelf = untrack(() => shelf);
  $effect.pre(() => {
    const value = shelf;
    if (Object.is(value, previousShelf)) return;
    previousShelf = value;
    untrack(() => {
      localStorage.setItem("reading-list:shelf", value);
    });
  });

  let previousQuery = untrack(() => query);
  let cleanupQuery: (() => void) | undefined;
  $effect.pre(() => {
    const value = query;
    if (Object.is(value, previousQuery)) return;
    previousQuery = value;
    untrack(async () => {
      cleanupQuery?.();
      const cleanups: (() => void)[] = [];
      cleanupQuery = () => {
        for (const cleanup of cleanups) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups.push(cleanup);
      };
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      if (value === "") {
        books = [];
        searching = false;
        return;
      }
      const url = `/api/books?${new URLSearchParams({ q: value, shelf: shelf })}`;
      searching = true;
      failure = "";
      onrequested?.(url);
      try {
        const response = await fetch(url, { signal: controller.signal });
        const found = (await response.json()) as string[];
        books = found;
        searching = false;
        onfound?.(value, found.length);
      } catch (error) {
        if (controller.signal.aborted) {
          oncancelled?.(value);
          return;
        }
        searching = false;
        failure = error instanceof Error ? error.message : "The search failed";
      }
    });
  });
  onMount(() => () => cleanupQuery?.());

  $effect(() => {
    const cleanups_1: (() => void)[] = [];
    const onCleanup = (cleanup: () => void) => {
      cleanups_1.push(cleanup);
    };
    const cleanUp = () => {
      for (const cleanup of cleanups_1) cleanup();
    };
    if (!checking) return cleanUp;
    const check = () => {
      checks += 1;
      onchecked?.(checks);
    };
    checker = setInterval(check, 1000);
    onstarted?.();
    onCleanup(() => clearInterval(checker));
    return cleanUp;
  });

  async function countShelf(name: string) {
    const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
    const list = (await response.json()) as string[];
    counts = { ...counts, [name]: list.length };
  }

  async function refreshAll() {
    refreshing = true;
    await Promise.all(shelves.map(countShelf));
    refreshing = false;
    onrefreshed?.(shelves.reduce((total, name) => total + (counts[name] ?? 0), 0));
  }
</script>

<section class="reading-list" aria-label="Reading list">
  <label>Search<input
    type="search"
    name="query"
    oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
  /></label
  ><p
    role="status"
  >{searching ? "Searching" : `${books.length} found`}{failure === "" ? "" : `: ${failure}`}</p
  ><ul aria-label="Books">
    {#each books as book (book)}
      <li>{book}</li>
    {/each}
  </ul
  ><div role="group" aria-label="Shelf">
    <button
      type="button"
      aria-pressed={shelf === "all"}
      onclick={() => (shelf = "all")}
    >All</button
    ><button
      type="button"
      aria-pressed={shelf === "unread"}
      onclick={() => (shelf = "unread")}
    >Unread</button>
  </div
  ><button
    type="button"
    aria-pressed={checking}
    onclick={() => (checking = !checking)}
  >Check for new books</button
  ><p>Checks: {checks}</p
  ><button type="button" onclick={refreshAll}>Refresh shelves</button
  ><ul aria-label="Shelves">
    {#each shelves as name (name)}
      <li>{name}: {counts[name] ?? "not counted"}</li>
    {/each}
  </ul
  ><p>{refreshing ? "Refreshing" : "Up to date"}</p>
</section>
