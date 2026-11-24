import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  type AfterRenderRef,
  ApplicationRef,
  Component,
  Directive,
  type EffectRef,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-inbox-lookup",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let answers = this.answers();
    @let ordering = this.ordering();
    @let messages = this.messages();
    @let loading = this.loading();
    @let failure = this.failure();
    @let unread = this.unread();
    <section
      class="inbox-lookup"
      aria-label="Inbox"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly looked = output<string>();
  readonly dropped = output<string>();
  readonly sorted = output<string>();
  readonly scaled = output<string>();
  readonly busy = output<[count: number, loading: boolean]>();
  readonly failed = output<[message: string, loading: boolean]>();
  readonly counted = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
