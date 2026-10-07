import {
  type AfterRenderRef,
  Component,
  type OnDestroy,
  afterRenderEffect,
  input,
  output,
  signal,
} from "@angular/core";

export interface UnreadBadgeProps {
  appName: string;
}

@Component({
  selector: "uf-unread-badge",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let unread = this.unread();
    <section class="unread-badge" aria-label="Inbox">
      <p role="status">{{ unread }} unread</p>
      <button type="button" (click)="onReceiveAMessage()">Receive a message</button>
      <button type="button" (click)="onMarkAllRead()">Mark all read</button>
    </section>
  `,
})
export default class UnreadBadge implements OnDestroy {
  readonly appName = input.required<string>();
  readonly titleChange = output<string>();
  readonly titleRelease = output<string>();
  protected readonly unread = signal(0);
  private readonly renderEffect: AfterRenderRef;

  constructor() {
    this.renderEffect = afterRenderEffect((onCleanup) => {
      const title = `(${this.unread()}) ${this.appName()}`;
      this.titleChange.emit(title);
      onCleanup(() => {
        this.titleRelease.emit(title);
      });
    });
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.renderEffect.destroy();
  }

  protected onReceiveAMessage() {
    this.unread.update((unread) => unread + 1);
  }

  protected onMarkAllRead() {
    this.unread.set(0);
  }
}
