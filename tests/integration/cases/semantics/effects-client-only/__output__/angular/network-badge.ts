import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-network-badge",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let online = this.online();
    @let label = this.label();
    <p
      class="network-badge"
      role="status"
      [attr.data-checked]="'data-checked' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-checked'] : online === undefined ? 'no' : 'yes'"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}</p>
  `,
})
export default class NetworkBadge implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly online = signal<boolean | undefined>(undefined);
  protected readonly label = signal("Checking the connection");

  constructor() {
    afterNextRender(() => {
      this.online.set(navigator.onLine);
    });
  }

  ngOnInit(): void {
    const currentOnline = computed(() => this.online());
    let lastOnline = currentOnline();
    effect(
      () => {
        const value = currentOnline();
        if (Object.is(value, lastOnline)) return;
        lastOnline = value;
        untracked(() => {
          this.label.set(value ? "Online" : "Offline");
        });
      },
      { injector: this.injector },
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
