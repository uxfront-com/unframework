import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

export interface BookShelfEvents {
  onMoved?: (title: string, previous: string) => void;
  onCounted?: (summary: string) => void;
  onToggled?: (open: boolean) => void;
  onBusy?: (label: string, loading: boolean) => void;
  onSummed?: (total: number) => void;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export default function BookShelf({
  books,
  onMoved,
  onCounted,
  onToggled,
  onBusy,
  onSummed,
}: BookShelfProps & BookShelfEvents) {
  const [focused, setFocused] = useState<Book | null>(null);
  const focusedRef = useRef(focused);
  const [reads, setReads] = useState(() => new Map<number, number>());
  const readsRef = useRef(reads);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const [label, setLabel] = useState("Idle");
  const labelRef = useRef(label);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  const [low] = useState(1);
  const [high, setHigh] = useState(5);
  const highRef = useRef(high);

  const previousFocused = useRef(focused);
  const onFocusedChange = useEffectEvent((book: typeof focused, previous: typeof focused) => {
    onMoved?.(book?.title ?? "none", previous?.title ?? "none");
  });
  useEffect(() => {
    const previous = previousFocused.current;
    if (Object.is(previous, focused)) return;
    previousFocused.current = focused;
    onFocusedChange(focused, previous);
  }, [focused]);

  const previousReads = useRef(reads);
  const onReadsChange = useEffectEvent((next: typeof reads) => {
    onCounted?.([...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
  });
  useEffect(() => {
    const previous = previousReads.current;
    if (Object.is(previous, reads)) return;
    previousReads.current = reads;
    onReadsChange(reads);
  }, [reads]);

  const onOpenChange = useEffectEvent((value: typeof open) => {
    onToggled?.(value);
  });
  useEffect(() => {
    onOpenChange(open);
  }, [open]);

  const previousLabelLoading = useRef<[typeof label, typeof loading]>([label, loading]);
  const onLabelLoadingChange = useEffectEvent(
    ([nextLabel, nextLoading]: [typeof label, typeof loading]) => {
      onBusy?.(nextLabel, nextLoading);
    },
  );
  useEffect(() => {
    const previous = previousLabelLoading.current;
    if (Object.is(previous[0], label) && Object.is(previous[1], loading)) return;
    previousLabelLoading.current = [label, loading];
    onLabelLoadingChange([label, loading]);
  }, [label, loading]);

  const previousLowHigh = useRef<[typeof low, typeof high]>([low, high]);
  const onLowHighChange = useEffectEvent((values: [typeof low, typeof high]) => {
    onSummed?.(sum(values));
  });
  useEffect(() => {
    const previous = previousLowHigh.current;
    if (Object.is(previous[0], low) && Object.is(previous[1], high)) return;
    previousLowHigh.current = [low, high];
    onLowHighChange([low, high]);
  }, [low, high]);

  function focus(book: Book) {
    focusedRef.current = book;
    setFocused(focusedRef.current);
  }

  function peek(book: Book) {
    const before = focusedRef.current;
    focusedRef.current = book;
    setFocused(focusedRef.current);
    focusedRef.current = before;
    setFocused(focusedRef.current);
  }

  function read(book: Book) {
    const next = new Map(readsRef.current);
    next.set(book.id, (next.get(book.id) ?? 0) + 1);
    readsRef.current = next;
    setReads(readsRef.current);
  }

  function reread() {
    const before = readsRef.current;
    readsRef.current = new Map();
    setReads(readsRef.current);
    readsRef.current = before;
    setReads(readsRef.current);
  }

  function start() {
    labelRef.current = "Loading";
    setLabel(labelRef.current);
    loadingRef.current = true;
    setLoading(loadingRef.current);
  }

  return (
    <section className="book-shelf" aria-label="Books">
      <ul aria-label="Shelf">
        {books.map((book) => (
          <li key={book.id}>
            <span>{book.title}</span>
            <button type="button" onClick={() => focus(book)}>{`Focus ${book.title}`}</button>
            <button type="button" onClick={() => peek(book)}>{`Peek ${book.title}`}</button>
            <button type="button" onClick={() => read(book)}>{`Read ${book.title}`}</button>
          </li>
        ))}
      </ul>
      <p>Focused: {focused?.title ?? "none"}</p>
      <p>Books read: {reads.size}</p>
      <button type="button" onClick={reread}>
        Count again
      </button>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
      >
        Details
      </button>
      <button type="button" onClick={start}>
        Start
      </button>
      <p role="status">
        {label}: {loading ? "busy" : "idle"}
      </p>
      <button
        type="button"
        onClick={() => {
          highRef.current += 1;
          setHigh(highRef.current);
        }}
      >
        Raise the limit
      </button>
      <p>
        Range: {low} to {high}
      </p>
    </section>
  );
}
