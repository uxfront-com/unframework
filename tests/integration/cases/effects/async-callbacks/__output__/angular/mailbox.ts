import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  ApplicationRef,
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
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

export interface MailboxProps {
  folder: string;
}

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
  selector: "uf-mailbox",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let status = this.status();
    @let summary = this.summary();
    <section
      class="mailbox"
      aria-label="Mailbox"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ name }}</h2>
      <p role="status">{{ summary }}</p>
      <p>Status: {{ status }}</p>
      <button type="button" (click)="save()">Save</button>
      <button type="button" (click)="refreshEverySecond()">Refresh every second</button>
      <button type="button" (click)="markAllRead()">Mark all read</button>
      <button type="button" (click)="note()">Note</button>
    </section>
  `,
})
export default class Mailbox implements OnInit, OnDestroy {
  readonly folder = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly loaded = output<[name: string, unread: number]>();
  readonly ufProgress = output<[status: string, attempts: number]>();
  readonly seen = output<string>();
  readonly noted = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly appRef = inject(ApplicationRef);
  protected readonly name = signal("Loading");
  private readonly unread = signal(0);
  protected readonly status = signal("idle");
  private readonly attempts = signal(0);
  protected readonly summary = signal("No messages");
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    afterRenderEffect(() => {
      void (async () => {
        const text = `${this.status()} after ${this.attempts()}`;
        await Promise.resolve();
        this.seen.emit(text);
      })();
    });

    afterNextRender(async () => {
      await Promise.resolve();
      this.name.set(this.folder());
      this.unread.set(3);
    });
  }

  ngOnInit(): void {
    const currentValues = computed(
      () => [this.name(), this.unread()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [nextName, nextUnread] = current;
        lastValues = current;
        untracked(() => {
          this.loaded.emit([nextName, nextUnread]);
        });
      },
      { injector: this.injector },
    );

    const currentValues_1 = computed(
      () => [this.status(), this.attempts()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues_1 = currentValues_1();
    effect(
      () => {
        const current = currentValues_1();
        if (Object.is(current, lastValues_1)) return;
        const [nextStatus, nextAttempts] = current;
        lastValues_1 = current;
        untracked(() => {
          this.ufProgress.emit([nextStatus, nextAttempts]);
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
        untracked(async () => {
          const text = await Promise.resolve(`${value} unread`);
          this.summary.set(text);
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      clearInterval(this.timer);
    }
  }

  protected async save() {
    const label = this.name().trim();
    this.status.set(`saving ${label}`);
    this.attempts.update((attempts) => attempts + 1);
    await this.nextTick();
    this.status.set("saved");
  }

  protected refreshEverySecond() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.name.set(`${this.folder()} (refreshed)`);
      this.unread.update((unread) => unread + 1);
    }, 1000);
  }

  protected markAllRead() {
    queueMicrotask(() => {
      this.unread.set(0);
      this.name.set(`${this.folder()}, all read`);
    });
  }

  protected note() {
    void Promise.resolve().then(() => {
      this.noted.emit(`${this.name()}: ${this.unread()}`);
    });
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
