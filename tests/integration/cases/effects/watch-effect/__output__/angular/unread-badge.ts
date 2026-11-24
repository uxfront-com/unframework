import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  type AfterRenderRef,
  Component,
  ElementRef,
  type OnDestroy,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface UnreadBadgeProps {
  appName: string;
}

@Component({
  selector: "uf-unread-badge",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let unread = this.unread();
    <section
      class="unread-badge"
      aria-label="Inbox"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ unread }} unread</p>
      <button type="button" (click)="onReceiveAMessage()">Receive a message</button>
      <button type="button" (click)="onMarkAllRead()">Mark all read</button>
    </section>
  `,
})
export default class UnreadBadge implements OnDestroy {
  readonly appName = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly titleChange = output<string>();
  readonly titleRelease = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
