import { defineEmits, ref, watch } from "unframework";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

export default function BookShelf({ books }: BookShelfProps) {
  const emit = defineEmits<{
    moved: [title: string, previous: string];
    counted: [summary: string];
    toggled: [open: boolean];
    busy: [label: string, loading: boolean];
    summed: [total: number];
  }>();

  const focused = ref<Book | null>(null);
  const reads = ref(new Map<number, number>());
  const open = ref(false);
  const label = ref("Idle");
  const loading = ref(false);
  const low = ref(1);
  const high = ref(5);

  watch(focused, (book, previous) => {
    emit("moved", book?.title ?? "none", previous?.title ?? "none");
  });

  watch(reads, (next) => {
    emit("counted", [...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
  });

  watch(
    open,
    (value) => {
      emit("toggled", value);
    },
    { immediate: true },
  );

  watch([label, loading], ([nextLabel, nextLoading]) => {
    emit("busy", nextLabel, nextLoading);
  });

  watch([low, high], (values) => {
    emit("summed", sum(values));
  });

  function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  function focus(book: Book) {
    focused.value = book;
  }

  function peek(book: Book) {
    const before = focused.value;
    focused.value = book;
    focused.value = before;
  }

  function read(book: Book) {
    const next = new Map(reads.value);
    next.set(book.id, (next.get(book.id) ?? 0) + 1);
    reads.value = next;
  }

  function reread() {
    const before = reads.value;
    reads.value = new Map();
    reads.value = before;
  }

  function start() {
    label.value = "Loading";
    loading.value = true;
  }

  return (
    <section class="book-shelf" aria-label="Books">
      <ul aria-label="Shelf">
        {books.map((book) => (
          <li key={book.id}>
            <span>{book.title}</span>
            <button type="button" onClick={() => focus(book)}>
              {`Focus ${book.title}`}
            </button>
            <button type="button" onClick={() => peek(book)}>
              {`Peek ${book.title}`}
            </button>
            <button type="button" onClick={() => read(book)}>
              {`Read ${book.title}`}
            </button>
          </li>
        ))}
      </ul>
      <p>Focused: {focused.value?.title ?? "none"}</p>
      <p>Books read: {reads.value.size}</p>
      <button type="button" onClick={reread}>
        Count again
      </button>
      <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        Details
      </button>
      <button type="button" onClick={start}>
        Start
      </button>
      <p role="status">
        {label.value}: {loading.value ? "busy" : "idle"}
      </p>
      <button type="button" onClick={() => (high.value += 1)}>
        Raise the limit
      </button>
      <p>
        Range: {low.value} to {high.value}
      </p>
    </section>
  );
}
