import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  untracked,
  viewChild,
} from "@angular/core";

export const ToneKey = new InjectionToken<string>("uf.tone");

@Component({
  selector: "uf-badge",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tone = this.tone();
    <span
      class="badge"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >Tone: {{ tone }}</span>
  `,
})
export default class Badge implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLSpanElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly tone = computed(() =>
    untracked(
      () => this.injector.get(ToneKey, null, { optional: true, skipSelf: true }) ?? "plain",
    ),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.tone();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
