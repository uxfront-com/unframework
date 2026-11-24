import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useMediaQuery } from "./use-media-query";
import {
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  inject,
  input,
  runInInjectionContext,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-layout",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let wide = this.mediaQuery.matches();
    @let tiny = this.mediaQuery_1.matches();
    <section
      class="layout"
      aria-label="Layout"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ wide ? "Wide layout" : "Narrow layout" }}</p>
      <p>{{ tiny ? "Tiny screen" : "Not a tiny screen" }}</p>
    </section>
  `,
})
export default class Layout implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly mediaQueryInjector = Injector.create({ providers: [], parent: this.injector });
  protected readonly mediaQuery = runInInjectionContext(this.mediaQueryInjector, () =>
    useMediaQuery("(min-width: 1px)"),
  );
  private readonly mediaQueryInjector_1 = Injector.create({ providers: [], parent: this.injector });
  protected readonly mediaQuery_1 = runInInjectionContext(this.mediaQueryInjector_1, () =>
    useMediaQuery("(max-width: 1px)"),
  );

  ngOnDestroy(): void {
    this.mediaQueryInjector.destroy();
    this.mediaQueryInjector_1.destroy();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
