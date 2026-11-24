import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-shortcut-tip",
  imports: [ScopeAttributes, Fallthrough],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly dismissed = output<void>();
  readonly shortcut = output<[key: string, count: number]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
