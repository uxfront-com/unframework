import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";

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
  selector: "uf-shortcut-tip",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let enabled = this.enabled();
    @let count = this.count();
    <section
      class="shortcut-tip"
      aria-label="Shortcuts"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>{{ open ? "Press Escape to hide this tip." : "Tip hidden." }}</p>
      <button type="button" [attr.aria-pressed]="enabled" (click)="toggle()">Shortcut K</button>
      <p role="status">Used: {{ count }}</p>
    </section>
  `,
})
export default class ShortcutTip implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly dismissed = output<void>();
  readonly shortcut = output<[key: string, count: number]>();
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.open.set(false);
      this.dismissed.emit();
    }
  };
  private readonly onShortcut = (event: KeyboardEvent) => {
    if (event.key === "k") {
      this.count.update((count) => count + 1);
      this.shortcut.emit([event.key, this.count()]);
    }
  };
  protected readonly open = signal(true);
  protected readonly enabled = signal(false);
  protected readonly count = signal(0);

  constructor() {
    afterNextRender(() => {
      document.addEventListener("keydown", this.onEscape);
    });
  }

  ngOnInit(): void {
    const currentEnabled = computed(() => this.enabled());
    let lastEnabled = currentEnabled();
    afterRenderEffect(
      () => {
        const on = currentEnabled();
        if (Object.is(on, lastEnabled)) return;
        lastEnabled = on;
        untracked(() => {
          if (on) {
            document.addEventListener("keydown", this.onShortcut);
          } else {
            document.removeEventListener("keydown", this.onShortcut);
          }
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener("keydown", this.onEscape);
      document.removeEventListener("keydown", this.onShortcut);
    }
  }

  protected toggle() {
    this.enabled.set(!this.enabled());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
