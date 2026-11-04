import { useMediaQuery } from "./use-media-query";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  Renderer2,
  inject,
  input,
  runInInjectionContext,
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
  selector: "uf-layout",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
    >
      <p role="status">{{ wide ? "Wide layout" : "Narrow layout" }}</p>
      <p>{{ tiny ? "Tiny screen" : "Not a tiny screen" }}</p>
    </section>
  `,
})
export default class Layout implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
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
