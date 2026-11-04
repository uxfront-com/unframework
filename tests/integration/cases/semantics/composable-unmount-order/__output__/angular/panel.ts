import { useTeardown } from "./use-teardown";
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
  output,
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
  selector: "uf-panel",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.teardown.title();
    <section
      class="panel"
      [attr.aria-label]="title"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>{{ title }}</h2>
    </section>
  `,
})
export default class Panel implements OnInit, OnDestroy {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly closed = output<string>();
  private readonly injector = inject(Injector);
  private readonly teardownInjector = Injector.create({ providers: [], parent: this.injector });
  protected teardown!: ReturnType<typeof this.createTeardown>;

  ngOnInit(): void {
    this.teardown = runInInjectionContext(this.teardownInjector, () => this.createTeardown());
  }

  ngOnDestroy(): void {
    this.teardownInjector.destroy();
  }

  private createTeardown() {
    return useTeardown(
      () => this.name(),
      (entry) => this.closed.emit(entry),
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
