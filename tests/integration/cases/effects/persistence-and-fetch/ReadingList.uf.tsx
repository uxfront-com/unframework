import { defineEmits, ref, watch, watchEffect } from "unframework";

export interface ReadingListProps {
  shelves: string[];
}

export default function ReadingList({ shelves }: ReadingListProps) {
  const emit = defineEmits<{
    requested: [url: string];
    cancelled: [query: string];
    found: [query: string, count: number];
    started: [];
    checked: [count: number];
    refreshed: [total: number];
  }>();

  const query = ref("");
  const books = ref<string[]>([]);
  const searching = ref(false);
  const failure = ref("");
  const shelf = ref("all");
  const checking = ref(false);
  const checks = ref(0);
  const counts = ref<Record<string, number>>({});
  const refreshing = ref(false);
  let checker: ReturnType<typeof setInterval> | undefined;

  watch(shelf, (value) => {
    localStorage.setItem("reading-list:shelf", value);
  });

  watch(query, async (value, previous, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    if (value === "") {
      books.value = [];
      searching.value = false;
      return;
    }
    const url = `/api/books?${new URLSearchParams({ q: value, shelf: shelf.value })}`;
    searching.value = true;
    failure.value = "";
    emit("requested", url);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const found = (await response.json()) as string[];
      books.value = found;
      searching.value = false;
      emit("found", value, found.length);
    } catch (error) {
      if (controller.signal.aborted) {
        emit("cancelled", value);
        return;
      }
      searching.value = false;
      failure.value = error instanceof Error ? error.message : "The search failed";
    }
  });

  watchEffect((onCleanup) => {
    if (!checking.value) return;
    const check = () => {
      checks.value += 1;
      emit("checked", checks.value);
    };
    checker = setInterval(check, 1000);
    emit("started");
    onCleanup(() => clearInterval(checker));
  });

  async function countShelf(name: string) {
    const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
    const list = (await response.json()) as string[];
    counts.value = { ...counts.value, [name]: list.length };
  }

  async function refreshAll() {
    refreshing.value = true;
    await Promise.all(shelves.map(countShelf));
    refreshing.value = false;
    emit(
      "refreshed",
      shelves.reduce((total, name) => total + (counts.value[name] ?? 0), 0),
    );
  }

  return (
    <section class="reading-list" aria-label="Reading list">
      <label>
        Search
        <input
          type="search"
          name="query"
          onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p role="status">
        {searching.value ? "Searching" : `${books.value.length} found`}
        {failure.value === "" ? "" : `: ${failure.value}`}
      </p>
      <ul aria-label="Books">
        {books.value.map((book) => (
          <li key={book}>{book}</li>
        ))}
      </ul>
      <div role="group" aria-label="Shelf">
        <button
          type="button"
          aria-pressed={shelf.value === "all"}
          onClick={() => (shelf.value = "all")}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={shelf.value === "unread"}
          onClick={() => (shelf.value = "unread")}
        >
          Unread
        </button>
      </div>
      <button
        type="button"
        aria-pressed={checking.value}
        onClick={() => (checking.value = !checking.value)}
      >
        Check for new books
      </button>
      <p>Checks: {checks.value}</p>
      <button type="button" onClick={refreshAll}>
        Refresh shelves
      </button>
      <ul aria-label="Shelves">
        {shelves.map((name) => (
          <li key={name}>
            {name}: {counts.value[name] ?? "not counted"}
          </li>
        ))}
      </ul>
      <p>{refreshing.value ? "Refreshing" : "Up to date"}</p>
    </section>
  );
}
