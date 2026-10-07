import type { WriteReference } from "@unframework/ir";
// What this target emits for M2's constructs (ADR-0045 to ADR-0049), pinned as text: the
// browser tests (*.browser.test.ts) show that each shape behaves as the semantics contract says,
// output.test.ts and lint.test.ts that it passes L3, L4 and L5, and these that it stays the shape
// they judged. The sources are lint-probes.ts's M2_SOURCES.
import { describe, expect, it } from "vitest";

import { planComponent } from "../src/plan.ts";
import { classRules } from "../src/rules.ts";
import { emitFormatted, lower } from "./helpers.ts";
import { M2_SOURCES } from "./lint-probes.ts";

/** A source of M2_SOURCES, emitted and formatted as the compiler writes it. */
async function output(file: string): Promise<string> {
  const [emitted] = await emitFormatted(lower(M2_SOURCES[file]!, file, true));
  return emitted!.contents;
}

/** Lines as one string, so an expectation reads as the output does. */
const lines = (...text: string[]) => text.join("\n");

describe("state, derived values and constants (ADR-0046)", () => {
  it("seeds from inputs lazily, and reads what was seeded once in ngOnInit", async () => {
    const contents = await output("Seeded.uf.tsx");
    expect(contents).toContain(
      lines(
        "  private readonly factor = 2;",
        "  private readonly label = computed(() => untracked(() => `${this.start()} ${this.unit()}`));",
        "  private readonly amount = linkedSignal(() => untracked(() => this.start() * this.factor));",
        "  protected readonly picked = signal<string | undefined>(undefined);",
        "  private readonly total = computed<number>(() => this.amount() + this.start());",
        "  protected readonly summary = computed(() => `${this.label()}: ${this.total()}`);",
        "  private clicks = 0;",
        "  private last: number | undefined;",
        "",
        "  ngOnInit(): void {",
        "    // Read once the inputs are set: these keep the values they start with.",
        "    this.label();",
        "    this.amount();",
        "  }",
      ),
    );
  });

  it("writes through `set` and `update`, and a setup `let` as a field", async () => {
    expect(await output("Seeded.uf.tsx")).toContain(
      lines(
        "  protected add() {",
        "    this.clicks += 1;",
        "    this.last = this.amount();",
        // A field, which TypeScript narrows in no callback: `set`, not `update`.
        "    this.amount.set(this.amount() + this.factor);",
        "    this.picked.set(`${this.clicks} after ${this.last}`);",
        "  }",
      ),
    );
  });
});

describe("listeners (ADR-0047)", () => {
  it("calls a setup function from the template, with `$event` when it takes the event", async () => {
    const contents = await output("Handlers.uf.tsx");
    expect(contents).toContain('<input aria-label="Key" (keydown)="remember($event)" />');
    expect(contents).toContain(
      '<button type="button" (click)="choose(item, index, $event)">{{ item.name }}</button>',
    );
  });

  it("writes an emit or a call of literals and inputs as a template statement", async () => {
    const contents = await output("Handlers.uf.tsx");
    expect(contents).toContain(
      '<button type="button" (click)="pick.emit([owner.id, -1])">Owner</button>',
    );
    expect(contents).toContain('<button type="button" (click)="cleared.emit()">Clear all</button>');
  });

  it("drops the value of a function that returns one (Angular prevents the event for `false`)", async () => {
    const contents = await output("Handlers.uf.tsx");
    expect(contents).toContain('<button type="button" (click)="void toggle()">Toggle</button>');
    const returns = await output("Returns.uf.tsx");
    expect(returns).toContain('(keydown)="void handleKey($event)"');
    expect(returns).toContain('<a href="#toggled" (click)="void toggle()">Toggle</a>');
    expect(returns).toContain('(keydown)="void moveFrom(row, $event)"');
    // A handler moved to a method returns nothing, on every path (`noImplicitReturns`).
    expect(returns).toContain(
      '<input type="search" aria-label="Search" (keydown)="onSearchKeydown($event)" />',
    );
    expect(returns).toContain(
      lines(
        "  protected onSearchKeydown(event: KeyboardEvent) {",
        '    if (event.key === "Enter") return;',
        "    this.keys.update((keys) => keys + 1);",
        "    this.counted();",
        "  }",
        "",
        "  protected onMixedKeydown(event: KeyboardEvent) {",
        '    if (event.key === "Escape") return;',
        "    this.keys.update((keys) => keys + 10);",
        "  }",
      ),
    );
    // Nor does it keep a value as a statement: a read is no effect (`this.keys() > 0`), and a
    // branch or a side without one goes (`no-unused-expressions`).
    expect(returns).toContain(
      lines(
        "  protected onValuesKeydown(event: KeyboardEvent) {",
        '    if (event.key === "a") return;',
        '    if (event.key === "b") return;',
        '    if (event.key === "c") return;',
        '    for (const key of ["x", "y"]) {',
        "      if (event.key === key) {",
        "        this.counted();",
        "        return;",
        "      }",
        "    }",
        "    this.keys.update((keys) => keys + 100);",
        '    if (event.key === "Enter") this.counted();',
        "  }",
        "",
        "  protected onCounted() {",
        "    if (this.keys() > 0) this.counted();",
        "  }",
        "",
        "  protected onUnselected() {",
        "    if (!this.selected()) this.counted();",
        "  }",
      ),
    );
  });

  it("emits an event named after a JavaScript keyword through `this.`", async () => {
    const contents = await output("Deleting.uf.tsx");
    expect(contents).toContain('(click)="this.delete.emit(id)"');
    expect(contents).toContain('(click)="this.continue.emit()"');
    expect(contents).toContain("  readonly delete = output<number>();");
    expect(contents).toContain(lines("    this.default.emit();", "    this.new.emit();"));
  });

  it("reads a state in a list handler's arguments from the class, declaring no `@let`", async () => {
    const contents = await output("Returns.uf.tsx");
    expect(contents).toContain('(click)="choose(row, this.selected())"');
    expect(contents).not.toContain("@let selected");
    // The template reads the member: it is protected.
    expect(contents).toContain('  protected readonly selected = signal("");');
  });

  it("moves any other handler to a method named after its element, dropping its value", async () => {
    const contents = await output("Handlers.uf.tsx");
    expect(contents).toContain(
      lines(
        "  protected onSettle() {",
        "    if (!this.busy()) this.reset();",
        "  }",
        "",
        "  protected onCheck() {",
        "    if (this.busy()) this.clear();",
        "    else this.reset();",
        "  }",
        "",
        "  protected async onWait() {",
        "    this.busy.set(true);",
        "    await Promise.resolve();",
        "    this.busy.set(false);",
        "  }",
        "",
        "  protected onNameInput(event: InputEvent) {",
      ),
    );
  });

  it("listens with an option through a directive the file declares", async () => {
    const contents = await output("Options.uf.tsx");
    expect(contents).toContain(
      lines(
        '@Directive({ selector: "[ufTouchstartPassive]" })',
        "export class TouchstartPassive {",
        "  readonly ufTouchstartPassive = output<TouchEvent>();",
        "",
        "  constructor() {",
        "    const element: HTMLElement = inject(ElementRef).nativeElement;",
        "    const stop = inject(Renderer2).listen(",
        "      element,",
        '      "touchstart",',
        "      (event: TouchEvent) => this.ufTouchstartPassive.emit(event),",
        "      { passive: true },",
        "    );",
        "    inject(DestroyRef).onDestroy(stop);",
        "  }",
        "}",
      ),
    );
    expect(contents).toContain("imports: [ClickCapture, ClickOnce, TouchstartPassive],");
    expect(contents).toContain(
      '<button type="button" (ufClickOnce)="note(row)">{{ row }}</button>',
    );
  });
});

describe("effects and lifecycle (ADR-0048)", () => {
  it("watches a state through a `computed`, skipping the effect's first run", async () => {
    expect(await output("Watchers.uf.tsx")).toContain(
      lines(
        "    const currentCount = computed(() => this.count());",
        "    let lastCount = currentCount();",
        "    effect(",
        "      () => {",
        "        const value = currentCount();",
        "        if (Object.is(value, lastCount)) return;",
        "        const previous = lastCount;",
        "        lastCount = value;",
        "        untracked(() => {",
        "          this.moved.emit([value, previous]);",
        "        });",
        "      },",
        "      { injector: this.injector },",
        "    );",
      ),
    );
  });

  it("watches a `computed` or an input as it is, and runs an immediate one in the browser", async () => {
    const contents = await output("Watchers.uf.tsx");
    expect(contents).toContain("    let lastDouble = this.double();");
    expect(contents).toContain(
      lines(
        "    let lastSize = this.size();",
        "    let first_1 = true;",
        "    effect(",
        "      () => {",
        "        const value = this.size();",
        "        const previous = first_1 ? undefined : lastSize;",
        "        first_1 = false;",
        "        lastSize = value;",
        "        if (!isPlatformBrowser(this.platformId)) return;",
      ),
    );
  });

  it("compares an array of sources by element, and destroys a watcher with a cleanup first", async () => {
    const contents = await output("Watchers.uf.tsx");
    expect(contents).toContain(
      lines(
        "    const currentValues = computed(() => [this.count(), this.name()] satisfies [unknown, unknown], {",
        "      equal: (next, last) => next.every((value, index) => Object.is(value, last[index])),",
        "    });",
        "    let lastValues = currentValues();",
        "    this.valuesWatcher = effect(",
        "      (onCleanup) => {",
      ),
    );
    expect(contents).toContain(
      lines(
        "  ngOnDestroy(): void {",
        "    // Before Angular stops the outputs: a cleanup may still emit, as on every target.",
        "    this.valuesWatcher?.destroy();",
        "    this.countWatcher?.destroy();",
        "    this.renderEffect.destroy();",
        "    if (isPlatformBrowser(this.platformId)) {",
        "      this.left.emit();",
        "    }",
        "  }",
      ),
    );
  });

  it("runs `watchEffect` and post watchers after the render, `onMounted` after the first", async () => {
    const contents = await output("Watchers.uf.tsx");
    expect(contents).toContain(
      lines(
        "  constructor() {",
        "    afterRenderEffect(() => {",
        "      this.sized.emit(this.size() + this.count());",
        "    });",
        "",
        "    this.renderEffect = afterRenderEffect((onCleanup) => {",
      ),
    );
    expect(contents).toContain("    this.countWatcher = afterRenderEffect(");
    expect(contents).toContain(
      lines(
        "    afterNextRender(async () => {",
        "      this.count.set(1);",
        "      await this.nextTick();",
        "      this.measured.emit(this.box()?.nativeElement.childElementCount ?? 0);",
        "    });",
      ),
    );
  });

  it("renders the pending change in a microtask for `nextTick()`, and resolves after it", async () => {
    const contents = await output("Watchers.uf.tsx");
    expect(contents).toContain("  private readonly appRef = inject(ApplicationRef);");
    expect(contents).toContain(
      lines(
        "  private async nextTick(): Promise<void> {",
        "    await Promise.resolve();",
        "    this.appRef.tick();",
        "  }",
      ),
    );
  });
});

describe("ids and functions as values (ADR-0049, ADR-0045)", () => {
  it("makes ids from a module counter, and keeps `this` in a function passed as a value", async () => {
    const contents = await output("Ids.uf.tsx");
    expect(contents).toContain("let nextId = 0;");
    expect(contents).toContain(
      lines(
        "  private readonly tick = () => {",
        "    this.ticks += 1;",
        "    this.ticked.emit(this.ticks);",
        "  };",
        "  protected readonly fieldId = `uf-id-ids-${nextId++}`;",
        "  protected readonly hintId = `uf-id-ids-${nextId++}`;",
        "  private ticks = 0;",
      ),
    );
    expect(contents).toContain("      setTimeout(this.tick, 10);");
  });

  it("declares a function passed as a value before the fields whose initialisers call it", async () => {
    expect(await output("Sorter.uf.tsx")).toContain(
      lines(
        "  private readonly compare = (a: string, b: string): number => {",
        "    return a < b ? -1 : a > b ? 1 : 0;",
        "  };",
        '  protected readonly names = signal(["Cy", "Al"].toSorted((a, b) => this.compare(a, b)));',
      ),
    );
  });
});

describe("async callbacks (ADR-0048)", () => {
  it("runs an async watch callback untracked, its promise left to run", async () => {
    expect(await output("AsyncEffects.uf.tsx")).toContain(
      lines(
        "        lastCount = value;",
        "        untracked(async () => {",
        "          await Promise.resolve();",
        "          this.saved.emit(value);",
        "        });",
      ),
    );
  });

  it("runs an async `watchEffect` inside the effect, so its reads before `await` track", async () => {
    expect(await output("AsyncEffects.uf.tsx")).toContain(
      lines(
        "    afterRenderEffect(() => {",
        "      void (async () => {",
        "        const current = this.count();",
        "        await Promise.resolve();",
        "        this.seen.emit(current);",
        "      })();",
        "    });",
      ),
    );
  });
});

describe("setup `let`s seeded from inputs (ADR-0046)", () => {
  it("declares each with its type, definitely assigned in ngOnInit, in source order", async () => {
    const contents = await output("SeededLets.uf.tsx");
    expect(contents).toContain(
      lines(
        "  private remaining!: number;",
        "  private text!: string;",
        "  private base!: number;",
        "  private twice!: number;",
        "  private hint!: string | undefined;",
        "  private plain = 1;",
        "  private found!: ReturnType<typeof this.initialFound>;",
        "  private tally!: Record<string, unknown>;",
        "  private size!: number;",
        "  private fallback!: string;",
        "",
        "  ngOnInit(): void {",
        "    // Read once the inputs are set: these keep the values they start with.",
        "    this.count();",
        "    this.remaining = this.limit();",
        "    this.text = `${this.label()} (${this.limit()})`;",
        "    this.base = this.count();",
        "    this.twice = this.double();",
        "    this.hint = this.note();",
        "    this.found = this.initialFound();",
        "    this.tally = { limit: this.limit() };",
        "    this.size = this.label().length * 2;",
        '    this.fallback = this.note() ?? "none";',
        "  }",
        "",
        "  private initialFound() {",
        "    return [this.label()].find((word) => word.length > this.limit());",
        "  }",
      ),
    );
  });
});

describe("a seeded `let`'s type, as TypeScript infers the `let`'s (ADR-0046)", () => {
  it("types operators, `.length`, string and array methods and pure globals by their operands", async () => {
    expect(await output("SeededTypes.uf.tsx")).toContain(
      lines(
        "  private size!: number;",
        "  private label!: string;",
        "  private text!: string;",
        "  private next!: number;",
        "  private sum!: number;",
        "  private joined!: string;",
        "  private pick!: string;",
        "  private either!: string | number;",
        "  private first!: string | undefined;",
        "  private copy!: string[];",
        "  private sorted!: string[];",
        "  private max!: number;",
        "  private words!: string[];",
        "  private has!: boolean;",
        "  private shown!: Mode | string;",
        "  private factor!: number;",
        "  private fixed!: string;",
        "  private flag!: boolean;",
        "  private negative!: number;",
        "  private firstOr!: string;",
        "  private typed!: string;",
      ),
    );
  });
});

describe("listeners of one event on one element (ADR-0047)", () => {
  it("are one template listener, which chains their statements in their attributes' order", async () => {
    const contents = await output("ListenerOrder.uf.tsx");
    expect(contents).toContain(
      `(click)="record('plain'); void (once(clickOnce, $event) && record('once'))"`,
    );
    expect(contents).toContain("(ufClickCapture)=\"record('own capture')\"");
    expect(contents).toContain(
      `(click)="once(clickOnce, $event) && record('first only'); record('every time')"`,
    );
    expect(contents).toContain(
      lines(
        "  protected readonly clickOnce = new WeakSet<EventTarget>();",
        "  protected readonly wheelOnce = new WeakSet<EventTarget>();",
      ),
    );
    expect(contents).toContain(
      lines(
        "  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {",
        "    const element = event.currentTarget;",
        "    if (element === null || elements.has(element)) return false;",
        "    elements.add(element);",
        "    return true;",
        "  }",
      ),
    );
  });

  it("calls the method a handler moved to from the chain, one that awaits included", async () => {
    const contents = await output("ListenerOrder.uf.tsx");
    expect(contents).toContain(`(click)="once(clickOnce, $event) && onJumpOnce($event); onJump()"`);
    expect(contents).toContain(
      lines(
        "  protected onJumpOnce(e: PointerEvent) {",
        "    const kind = e.type;",
        "    this.record(kind);",
        "  }",
      ),
    );
    expect(contents).toContain(`(click)="once(clickOnce, $event) && onWaitOnce(); record('now')"`);
    expect(contents).toContain("  protected async onWaitOnce() {");
  });

  it("keeps a list's variables in the template, which types them, and a passive one in the chain", async () => {
    const contents = await output("ListenerOrder.uf.tsx");
    expect(contents).toContain(
      `(click)="record(row); void (once(clickOnce, $event) && record(row + ' ' + index + ' ' + $event.type))"`,
    );
    expect(contents).toContain(
      `(wheel)="changeVolume($event); record('passive wheel'); void (once(wheelOnce, $event) && record('first wheel'))"`,
    );
  });

  it("keeps what the template types and narrows in the chain, and the source's names apart", async () => {
    const contents = await output("ListenerPairs.uf.tsx");
    // A list over a `computed`, over a prop's member, over a `ref` the source leaves unannotated.
    expect(contents).toContain(
      `(click)="record(entry.title); void (once(clickOnce, $event) && record('first ' + entry.title))"`,
    );
    expect(contents).toContain(
      `(click)="record('row ' + event.title); void (once(clickOnce, $event) && save(event.title))"`,
    );
    expect(contents).toContain(
      `(click)="record(tag); void (once(clickOnce, $event) && first.emit(tag))"`,
    );
    // A value a condition narrows, read through its `@let`.
    expect(contents).toContain(
      `(click)="record(owner.name); void (once(clickOnce, $event) && first.emit(owner.name))"`,
    );
    expect(contents).toContain(`(click)="record('hello ' + owner.name.toUpperCase())"`);
    // Spreads too, which Angular's expressions read.
    expect(contents).toContain(`(click)="greet({ ...owner, name: owner.name.toUpperCase() })"`);
    expect(contents).toContain(`(click)="keep([...owner.tags, 'new'])"`);
    // A handler's own names stay in its method.
    expect(contents).toContain(
      `(click)="onCount(); void (once(clickOnce, $event) && onCountOnce())"`,
    );
    expect(contents).toContain(
      lines(
        "  protected onCountOnce() {",
        '    const event = "first-click";',
        "    this.track.emit([event, this.count()]);",
        "  }",
      ),
    );
    expect(contents).toContain(
      `(click)="record($event.type); void (once(clickOnce, $event) && onKindsOnce($event))"`,
    );
    expect(contents).toContain(
      lines(
        "  protected onKindsOnce(e: PointerEvent) {",
        "    this.keep(this.kinds().filter((event) => event !== e.type));",
        "  }",
      ),
    );
  });
});

describe("the members a template statement reads (ADR-0047)", () => {
  it("take no name a list's variable has, which would shadow them in the list", async () => {
    const contents = await output("Shadowed.uf.tsx");
    expect(contents).toContain(
      `(click)="record(once); void (once_1(clickOnce_1, $event) && record(once + ' ' + clickOnce))"`,
    );
    expect(contents).toContain("  protected readonly clickOnce_1 = new WeakSet<EventTarget>();");
    expect(contents).toContain(
      "  protected once_1(elements: WeakSet<EventTarget>, event: Event): boolean {",
    );
  });
});

describe("array sources (ADR-0048)", () => {
  it("hands the callback the values as a mutable tuple, annotated or not, never `readonly`", async () => {
    const contents = await output("Tuples.uf.tsx");
    expect(contents).toContain(
      lines(
        "    const currentValues = computed(",
        "      () => [this.count(), this.label()] satisfies [unknown, unknown],",
        "      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },",
        "    );",
      ),
    );
    expect(contents).toContain(
      lines(
        "        const current = currentValues();",
        "        if (Object.is(current, lastValues)) return;",
        "        const [nextCount, nextLabel]: [number, string] = current;",
        '        const [lastCount = -1, lastLabel = "none"] = lastValues;',
        "        lastValues = current;",
      ),
    );
    expect(contents).toContain(
      lines(
        "        const values = currentValues_2();",
        "        if (Object.is(values, lastValues_2)) return;",
        "        const previous = lastValues_2;",
        "        lastValues_2 = values;",
      ),
    );
  });

  it("types an immediate watcher's first previous values as Vue does, each or `undefined`", async () => {
    const contents = await output("Tuples.uf.tsx");
    expect(contents).toContain(
      lines(
        "        const values = currentValues_5();",
        "        const previous = (first ? [] : lastValues_5) as [",
        "          (typeof lastValues_5)[0] | undefined,",
        "          (typeof lastValues_5)[1] | undefined,",
        "        ];",
        "        first = false;",
        "        lastValues_5 = values;",
      ),
    );
  });
});

describe("template refs (ADR-0045)", () => {
  it("reads an element kept, passed, returned or compared as `T | null`, as the source types it", async () => {
    const contents = await output("Elements.uf.tsx");
    expect(contents).toContain(
      lines(
        "      this.handleElement = this.handle()?.nativeElement ?? null;",
        '      this.handleElement?.addEventListener("click", this.onHandleClick);',
        "      this.keep(this.field()?.nativeElement ?? null);",
        "      this.found.emit(",
        "        this.field()?.nativeElement != null &&",
        "          this.current() === (this.field()?.nativeElement ?? null),",
        "      );",
        "      const box = this.field()?.nativeElement ?? this.handle()?.nativeElement ?? null;",
      ),
    );
    expect(contents).toContain("    return this.field()?.nativeElement ?? null;");
  });
});

describe("outputs named like a setup binding (ADR-0047)", () => {
  it("keep the event's name, and rename the class's own member, never aliasing the output", async () => {
    const contents = await output("Collisions.uf.tsx");
    expect(contents).toContain(
      lines(
        "  readonly save = output<Settings>();",
        "  readonly toggle = output<[id: string, open: boolean]>();",
        "  readonly page = output<number>();",
        "  readonly field = output<void>();",
        '  private readonly fieldElement = viewChild<ElementRef<HTMLInputElement>>("fieldElement");',
      ),
    );
    expect(contents).toContain("  protected readonly currentPage = signal(1);");
    // A watcher's locals do not say `current` twice.
    expect(contents).toContain(
      lines(
        "    const currentPage = computed(() => this.currentPage());",
        "    let lastPage = currentPage();",
      ),
    );
    expect(contents).toContain('<form aria-label="Settings" (submit)="onSave($event)">');
    expect(contents).toContain('<input type="text" aria-label="Name" #fieldElement />');
    expect(contents).toContain('(click)="onToggle(row)"');
    expect(contents).toContain(
      lines(
        "  protected onSave(event: SubmitEvent) {",
        "    event.preventDefault();",
        "    this.save.emit({ ...this.draft() });",
      ),
    );
    expect(contents).toContain("    this.fieldElement()?.nativeElement.focus();");
    expect(contents).not.toContain("alias");
  });
});

describe("reads a condition narrows (ADR-0046)", () => {
  it("assert the path present where the class reads it through a call, and the template needs none", async () => {
    const contents = await output("Narrowing.uf.tsx");
    expect(contents).toContain(
      lines(
        "  protected readonly owner = computed(() =>",
        "    this.selected()?.owner && this.selected()!.owner!.email",
        "      ? this.selected()!.owner!.email!",
        '      : "none",',
        "  );",
      ),
    );
    expect(contents).toContain('    this.user() ? `Hello, ${this.user()!.name}` : "Hello",');
    expect(contents).toContain("    if (this.selected()) this.pick.emit(this.selected()!.id);");
    expect(contents).toContain(
      lines(
        "    if (!this.field()?.nativeElement) return;",
        "    const element = this.field()!.nativeElement;",
        "    this.size.emit(element.value.length + this.field()!.nativeElement.value.length);",
      ),
    );
    expect(contents).toContain(
      "    if (this.user() && this.user()!.email) this.mail.emit(this.user()!.email!);",
    );
    // An assignment narrows the state it writes.
    expect(contents).toContain(
      lines(
        "    this.selected.set(row);",
        "    if (this.selected()!.email) this.mail.emit(this.selected()!.email!);",
      ),
    );
    // A template statement reads a state through the class, and an input through the template.
    expect(contents).toContain(`(click)="compare(row, this.selected() ? this.selected()!.id : 0)"`);
  });

  it("set a current value they narrow, which `update`'s parameter would not be", () => {
    const module = lower(
      [
        'import { ref } from "unframework";',
        "export default function Bump() {",
        "  const count = ref<number | null>(null);",
        "  function bump() {",
        "    if (count.value !== null) count.value += 1;",
        "  }",
        '  return <button type="button" onClick={bump}>{count.value}</button>;',
        "}",
      ].join("\n"),
    );
    const [component] = module.components;
    const binding = component!.bindings.find(({ name }) => name === "count")!;
    // The one write, wherever the IR keeps it.
    const writes: WriteReference[] = [];
    JSON.stringify(component, (_key, value: { kind?: string }) => {
      if (value?.kind === "Write") writes.push(value as WriteReference);
      return value;
    });
    const rules = classRules(planComponent(component!, module));
    const spell = (target: string) =>
      rules.write!(writes[0]!, binding, { target, value: "1", code: "" }, "client");
    expect(spell("this.count()")).toBe("this.count.update((count) => count + 1)");
    // A read the IR marks narrowed is asserted (`classRead`), and kept where the source reads it.
    expect(spell("this.count()!")).toBe("this.count.set(this.count()! + 1)");
  });

  it("keep the narrowing of a write's value: `update`'s callback only for literals and signals", async () => {
    const contents = await output("Narrowing.uf.tsx");
    expect(contents).toContain(
      lines(
        "      if (row.owner !== null && row.owner.email !== undefined)",
        "        this.total.set(this.total() + row.owner.email.length);",
      ),
    );
    expect(contents).toContain(
      "    if (this.bonus !== null) this.total.set(this.total() + this.bonus);",
    );
    expect(contents).toContain(
      lines(
        "    let index;",
        "    for (index = 0; index < this.rows().length; index++)",
        "      this.total.set(this.total() + this.rows()[index]!.id);",
        "    this.total.update((total) => total + 1);",
      ),
    );
  });
});

describe("callbacks the class runs for no value (ADR-0048)", () => {
  it("return none, and an `onUnmounted` that returns ends itself, not `ngOnDestroy`", async () => {
    const contents = await output("Teardowns.uf.tsx");
    expect(contents).toContain(
      lines(
        "    afterNextRender(() => {",
        "      if (this.count() > 0) return;",
        "      this.bump();",
        "    });",
      ),
    );
    expect(contents).toContain(
      lines(
        "        untracked(() => {",
        "          if (value > 2) {",
        "            this.bump();",
        "            return;",
        "          }",
        "          this.counted.emit(value);",
        "        });",
      ),
    );
    expect(contents).toContain("      if (!shown) return;");
    expect(contents).toContain(
      lines(
        "  ngOnDestroy(): void {",
        "    if (isPlatformBrowser(this.platformId)) {",
        "      (() => {",
        "        if (!this.timer) return;",
        "        clearInterval(this.timer);",
        '        this.stopped.emit("timer");',
        "      })();",
        "    }",
        "    if (isPlatformBrowser(this.platformId)) {",
        '      this.stopped.emit("second");',
        "    }",
        "  }",
      ),
    );
  });
});
