import { $, type QRL, component$, useSignal, useTask$ } from "@qwik.dev/core";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

export interface BookShelfEvents {
  onMoved$?: QRL<(title: string, previous: string) => void>;
  onCounted$?: QRL<(summary: string) => void>;
  onToggled$?: QRL<(open: boolean) => void>;
  onBusy$?: QRL<(label: string, loading: boolean) => void>;
  onSummed$?: QRL<(total: number) => void>;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export default component$<BookShelfProps & BookShelfEvents>(
  ({ books, onMoved$, onCounted$, onToggled$, onBusy$, onSummed$ }) => {
    const focused = useSignal<Book | null>(null);
    const reads = useSignal(new Map<number, number>());
    const open = useSignal(false);
    const label = useSignal("Idle");
    const loading = useSignal(false);
    const low = useSignal(1);
    const high = useSignal(5);

    const previousFocused = useSignal(() => focused.value);
    useTask$(
      ({ track }) => {
        const book = track(focused);
        const previous = previousFocused.value;
        if (Object.is(book, previous)) return;
        previousFocused.value = book;
        onMoved$?.(book?.title ?? "none", previous?.title ?? "none");
      },
      { deferUpdates: false },
    );

    const previousReads = useSignal(() => reads.value);
    useTask$(
      ({ track }) => {
        const next = track(reads);
        if (Object.is(next, previousReads.value)) return;
        previousReads.value = next;
        onCounted$?.([...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
      },
      { deferUpdates: false },
    );

    const previousOpen = useSignal<{ value: typeof open.value }>();
    useTask$(
      ({ track }) => {
        const value = track(open);
        const last = previousOpen.value;
        if (last && Object.is(value, last.value)) return;
        previousOpen.value = { value };
        onToggled$?.(value);
      },
      { deferUpdates: false },
    );

    const previousValues = useSignal<[typeof label.value, typeof loading.value]>(() => [
      label.value,
      loading.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof label.value, typeof loading.value] = [track(label), track(loading)];
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [nextLabel, nextLoading] = values;
        onBusy$?.(nextLabel, nextLoading);
      },
      { deferUpdates: false },
    );

    const previousValues_1 = useSignal<[typeof low.value, typeof high.value]>(() => [
      low.value,
      high.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof low.value, typeof high.value] = [track(low), track(high)];
        if (values.every((item, index) => Object.is(item, previousValues_1.value[index]))) return;
        previousValues_1.value = values;
        onSummed$?.(sum(values));
      },
      { deferUpdates: false },
    );

    const focus = $((book: Book) => {
      focused.value = book;
    });

    const peek = $((book: Book) => {
      const before = focused.value;
      focused.value = book;
      focused.value = before;
    });

    const read = $((book: Book) => {
      const next = new Map(reads.value);
      next.set(book.id, (next.get(book.id) ?? 0) + 1);
      reads.value = next;
    });

    const reread = $(() => {
      const before = reads.value;
      reads.value = new Map();
      reads.value = before;
    });

    const start = $(() => {
      label.value = "Loading";
      loading.value = true;
    });

    return (
      <section class="book-shelf" aria-label="Books">
        <ul aria-label="Shelf">
          {books.map((book) => (
            <li key={book.id}>
              <span>{book.title}</span>
              <button type="button" onClick$={() => focus(book)}>{`Focus ${book.title}`}</button>
              <button type="button" onClick$={() => peek(book)}>{`Peek ${book.title}`}</button>
              <button type="button" onClick$={() => read(book)}>{`Read ${book.title}`}</button>
            </li>
          ))}
        </ul>
        <p>Focused: {focused.value?.title ?? "none"}</p>
        <p>Books read: {reads.value.size}</p>
        <button type="button" onClick$={reread}>
          Count again
        </button>
        <button
          type="button"
          aria-expanded={open.value}
          onClick$={() => (open.value = !open.value)}
        >
          Details
        </button>
        <button type="button" onClick$={start}>
          Start
        </button>
        <p role="status">
          {label.value}: {loading.value ? "busy" : "idle"}
        </p>
        <button type="button" onClick$={() => (high.value += 1)}>
          Raise the limit
        </button>
        <p>
          Range: {low.value} to {high.value}
        </p>
      </section>
    );
  },
);
