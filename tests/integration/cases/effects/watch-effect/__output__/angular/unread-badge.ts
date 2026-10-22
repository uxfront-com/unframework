import {
  type AfterRenderRef,
  Component,
  Directive,
  ElementRef,
  type OnDestroy,
  type OnInit,
  Renderer2,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface UnreadBadgeProps {
  appName: string;
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-unread-badge",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let unread = this.unread();
    <section
      class="unread-badge"
      aria-label="Inbox"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
