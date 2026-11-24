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

export const DepthKey = new InjectionToken<number>("uf.depth");

@Component({
  selector: "uf-level",
  imports: [ScopeAttributes, Fallthrough],
  providers: [{ provide: DepthKey, useFactory: () => inject(Level).depth() + 1 }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let depth = this.depth();
    <section
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : title"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ title }} at depth {{ depth }}</h2>
      <ng-content />
    </section>
  `,
})
export default class Level implements OnInit {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  readonly depth = computed(() =>
    untracked(() => this.injector.get(DepthKey, null, { optional: true, skipSelf: true }) ?? 0),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.depth();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
