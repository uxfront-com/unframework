import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Injector,
  type OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

@Component({
  selector: "uf-book-shelf",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let books = this.books();
    @let focused = this.focused();
    @let reads = this.reads();
    @let open = this.open();
    @let label = this.label();
    @let loading = this.loading();
    @let low = this.low();
    @let high = this.high();
    <section class="book-shelf" aria-label="Books">
      <ul aria-label="Shelf">
        @for (book of books; track book.id) {
          <li>
            <span>{{ book.title }}</span>
            <button type="button" (click)="focus(book)">{{ "Focus " + book.title }}</button>
            <button type="button" (click)="peek(book)">{{ "Peek " + book.title }}</button>
            <button type="button" (click)="read(book)">{{ "Read " + book.title }}</button>
          </li>
        }
      </ul>
      <p>Focused: {{ focused?.title ?? "none" }}</p>
      <p>Books read: {{ reads.size }}</p>
      <button type="button" (click)="reread()">Count again</button>
      <button type="button" [attr.aria-expanded]="open" (click)="onDetails()">Details</button>
      <button type="button" (click)="start()">Start</button>
      <p role="status">{{ label }}: {{ loading ? "busy" : "idle" }}</p>
      <button type="button" (click)="onRaiseTheLimit()">Raise the limit</button>
      <p>Range: {{ low }} to {{ high }}</p>
    </section>
  `,
})
export default class BookShelf implements OnInit {
  readonly books = input.required<Book[]>();
  readonly moved = output<[title: string, previous: string]>();
  readonly counted = output<string>();
  readonly toggled = output<boolean>();
  readonly busy = output<[label: string, loading: boolean]>();
  readonly summed = output<number>();
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly focused = signal<Book | null>(null);
  protected readonly reads = signal(new Map<number, number>());
  protected readonly open = signal(false);
  protected readonly label = signal("Idle");
  protected readonly loading = signal(false);
  protected readonly low = signal(1);
  protected readonly high = signal(5);

  ngOnInit(): void {
    const currentFocused = computed(() => this.focused());
    let lastFocused = currentFocused();
    effect(
      () => {
        const book = currentFocused();
        if (Object.is(book, lastFocused)) return;
        const previous = lastFocused;
        lastFocused = book;
        untracked(() => {
          this.moved.emit([book?.title ?? "none", previous?.title ?? "none"]);
        });
      },
      { injector: this.injector },
    );

    const currentReads = computed(() => this.reads());
    let lastReads = currentReads();
    effect(
      () => {
        const next = currentReads();
        if (Object.is(next, lastReads)) return;
        lastReads = next;
        untracked(() => {
          this.counted.emit([...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
        });
      },
      { injector: this.injector },
    );

    const currentOpen = computed(() => this.open());
    effect(
      () => {
        const value = currentOpen();
        if (!isPlatformBrowser(this.platformId)) return;
        untracked(() => {
          this.toggled.emit(value);
        });
      },
      { injector: this.injector },
    );

    const currentValues = computed(
      () => [this.label(), this.loading()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [nextLabel, nextLoading] = current;
        lastValues = current;
        untracked(() => {
          this.busy.emit([nextLabel, nextLoading]);
        });
      },
      { injector: this.injector },
    );

    const currentValues_1 = computed(() => [this.low(), this.high()] satisfies [unknown, unknown], {
      equal: (next, last) => next.every((value, index) => Object.is(value, last[index])),
    });
    let lastValues_1 = currentValues_1();
    effect(
      () => {
        const values = currentValues_1();
        if (Object.is(values, lastValues_1)) return;
        lastValues_1 = values;
        untracked(() => {
          this.summed.emit(this.sum(values));
        });
      },
      { injector: this.injector },
    );
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  protected focus(book: Book) {
    this.focused.set(book);
  }

  protected peek(book: Book) {
    const before = this.focused();
    this.focused.set(book);
    this.focused.set(before);
  }

  protected read(book: Book) {
    const next = new Map(this.reads());
    next.set(book.id, (next.get(book.id) ?? 0) + 1);
    this.reads.set(next);
  }

  protected reread() {
    const before = this.reads();
    this.reads.set(new Map());
    this.reads.set(before);
  }

  protected start() {
    this.label.set("Loading");
    this.loading.set(true);
  }

  protected onDetails() {
    this.open.set(!this.open());
  }

  protected onRaiseTheLimit() {
    this.high.update((high) => high + 1);
  }
}
