import { isPlatformBrowser } from "@angular/common";
import {
  ApplicationRef,
  Component,
  Injector,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";

export interface MailboxProps {
  folder: string;
}

@Component({
  selector: "uf-mailbox",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let status = this.status();
    @let summary = this.summary();
    <section class="mailbox" aria-label="Mailbox">
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
  readonly loaded = output<[name: string, unread: number]>();
  readonly progress = output<[status: string, attempts: number]>();
  readonly seen = output<string>();
  readonly noted = output<string>();
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
          this.progress.emit([nextStatus, nextAttempts]);
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
}
