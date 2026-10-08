import {
  type AfterRenderRef,
  ApplicationRef,
  Component,
  type EffectRef,
  Injector,
  type OnDestroy,
  type OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from "@angular/core";

@Component({
  selector: "uf-inbox-lookup",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let answers = this.answers();
    @let ordering = this.ordering();
    @let messages = this.messages();
    @let loading = this.loading();
    @let failure = this.failure();
    @let unread = this.unread();
    <section class="inbox-lookup" aria-label="Inbox">
      <button type="button" (click)="onFindAnn()">Find Ann</button>
      <button type="button" (click)="onFindAnna()">Find Anna</button>
      <button type="button" (click)="answerLookups()">Answer lookups</button>
      <ol aria-label="Answers">
        @for (line of answers; track index; let index = $index) {
          <li>{{ line }}</li>
        }
      </ol>
      <button type="button" (click)="onSwitchOrder()">Switch order</button>
      <button type="button" (click)="onAnswerOrder()">Answer order</button>
      <p>Order: {{ ordering }}</p>
      <button type="button" (click)="load()">Load</button>
      <button type="button" (click)="refresh()">Refresh</button>
      <button type="button" (click)="onReply()">Reply</button>
      <button type="button" (click)="onFail()">Fail</button>
      <p
        role="status"
      >{{ loading ? "Loading" : messages.length + " messages" }}{{ failure === "" ? "" : ", " + failure }}</p>
      <button type="button" (click)="markTwice()">Mark twice</button>
      <p>Unread: {{ unread }}</p>
    </section>
  `,
})
export default class InboxLookup implements OnInit, OnDestroy {
  readonly looked = output<string>();
  readonly dropped = output<string>();
  readonly sorted = output<string>();
  readonly scaled = output<string>();
  readonly busy = output<[count: number, loading: boolean]>();
  readonly failed = output<[message: string, loading: boolean]>();
  readonly counted = output<number>();
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  private readonly sender = signal("");
  private readonly order = signal("newest");
  protected readonly answers = signal<string[]>([]);
  protected readonly ordering = signal("none");
  protected readonly messages = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly failure = signal("");
  protected readonly unread = signal(0);
  private lookupReplies: ((text: string) => void)[] = [];
  private orderReply: ((text: string) => void) | undefined;
  private respond: ((list: string[]) => void) | undefined;
  private fail: ((error: Error) => void) | undefined;
  private senderWatcher?: EffectRef;
  private readonly renderEffect: AfterRenderRef;

  constructor() {
    this.renderEffect = afterRenderEffect((onCleanup) => {
      void (async () => {
        const current = this.order();
        let cancelled = false;
        onCleanup(() => {
          cancelled = true;
        });
        this.sorted.emit(current);
        const text = await new Promise<string>((resolve) => {
          this.orderReply = resolve;
        });
        if (!cancelled) {
          this.ordering.set(`${current} ${text}`);
          this.scaled.emit(current);
        }
      })();
    });
  }

  ngOnInit(): void {
    const currentSender = computed(() => this.sender());
    let lastSender = currentSender();
    this.senderWatcher = effect(
      (onCleanup) => {
        const value = currentSender();
        if (Object.is(value, lastSender)) return;
        lastSender = value;
        untracked(async () => {
          let cancelled = false;
          onCleanup(() => {
            cancelled = true;
            this.dropped.emit(value);
          });
          this.looked.emit(value);
          const text = await this.lookupReply();
          if (!cancelled) {
            this.answers.set([...this.answers(), `${value}: ${text}`]);
          }
        });
      },
      { injector: this.injector },
    );

    const currentValues = computed(
      () => [this.messages(), this.loading()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [list, busy] = current;
        lastValues = current;
        untracked(() => {
          this.busy.emit([list.length, busy]);
        });
      },
      { injector: this.injector },
    );

    const currentValues_1 = computed(
      () => [this.failure(), this.loading()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues_1 = currentValues_1();
    effect(
      () => {
        const current = currentValues_1();
        if (Object.is(current, lastValues_1)) return;
        const [message, busy] = current;
        lastValues_1 = current;
        untracked(() => {
          this.failed.emit([message, busy]);
        });
      },
      { injector: this.injector },
    );

    const currentUnread = computed(() => this.unread());
    let lastUnread = currentUnread();
    effect(
      () => {
        const value = currentUnread();
        if (Object.is(value, lastUnread)) return;
        lastUnread = value;
        untracked(() => {
          this.counted.emit(value);
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.senderWatcher?.destroy();
    this.renderEffect.destroy();
  }

  private lookupReply(): Promise<string> {
    return new Promise<string>((resolve) => {
      this.lookupReplies = [...this.lookupReplies, resolve];
    });
  }

  protected answerLookups() {
    const waiting = this.lookupReplies;
    this.lookupReplies = [];
    waiting.forEach((resolve) => resolve("found"));
  }

  private request(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.respond = resolve;
      this.fail = reject;
    });
  }

  protected async load() {
    this.loading.set(true);
    this.failure.set("");
    try {
      const list = await this.request();
      this.messages.set(list);
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : "unknown");
    }
    this.loading.set(false);
  }

  protected async refresh() {
    this.loading.set(true);
    this.messages.set(await this.request());
    this.loading.set(false);
  }

  protected async markTwice() {
    const bump = () => {
      this.unread.update((unread) => unread + 1);
    };
    bump();
    bump();
    await this.nextTick();
    bump();
    bump();
  }

  protected onFindAnn() {
    this.sender.set("Ann");
  }

  protected onFindAnna() {
    this.sender.set("Anna");
  }

  protected onSwitchOrder() {
    this.order.set(this.order() === "newest" ? "oldest" : "newest");
  }

  protected onAnswerOrder() {
    this.orderReply?.("ready");
  }

  protected onReply() {
    this.respond?.(["Hello", "Welcome"]);
  }

  protected onFail() {
    this.fail?.(new Error("offline"));
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
}
