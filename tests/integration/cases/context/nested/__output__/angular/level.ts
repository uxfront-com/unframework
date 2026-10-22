import {
  Component,
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  untracked,
} from "@angular/core";

export const DepthKey = new InjectionToken<number>("uf.depth");

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
  selector: "uf-level",
  imports: [ScopeAttributes],
  providers: [{ provide: DepthKey, useFactory: () => inject(Level).depth() + 1 }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let depth = this.depth();
    <section
      [attr.aria-label]="title"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
