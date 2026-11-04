import { useControllableState } from "./use-controllable-state";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
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
  selector: "uf-rating",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let current = this.controllableState.current();
    <section
      class="rating"
      aria-label="Rating"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">Rated {{ current }} of 3</p>
      <button type="button" (click)="void controllableState.set(2)">Two</button>
      <button type="button" (click)="void controllableState.set(3)">Three</button>
    </section>
  `,
})
export default class Rating implements OnInit {
  readonly value = input<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufChange = output<number>();
  private readonly injector = inject(Injector);
  protected controllableState!: ReturnType<typeof this.createControllableState>;

  ngOnInit(): void {
    this.controllableState = runInInjectionContext(this.injector, () =>
      this.createControllableState(),
    );
  }

  private createControllableState() {
    return useControllableState(
      () => this.value(),
      1,
      (next) => this.ufChange.emit(next),
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
