import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { ThemeKey } from "./theme-provider";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-badge",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let theme = this.theme();
    <span
      class="badge"
      [class]="[theme?.accent, this.class()].join(' ')"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ text }} in {{ theme?.label ?? "no theme" }}</span>
  `,
})
export default class Badge implements OnInit {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly theme = computed(() =>
    untracked(
      () => this.injector.get(ThemeKey, null, { optional: true, skipSelf: true }) ?? undefined,
    ),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.theme();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
