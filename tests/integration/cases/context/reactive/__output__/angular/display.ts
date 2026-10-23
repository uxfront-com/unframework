import { CountKey } from "./counter";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";

/** A ref as a descendant injects it (ADR-0054): its value through a getter, read as it changes. */
function refObject<T>(ref: () => T): { readonly value: T } {
  return {
    get value() {
      return ref();
    },
  };
}

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
  selector: "uf-display",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <output
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >Count: {{ count.value }}</output>
  `,
})
export default class Display implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  private readonly none = signal(0);
  protected readonly count = computed(() =>
    untracked(
      () =>
        this.injector.get(CountKey, null, { optional: true, skipSelf: true }) ??
        refObject(this.none),
    ),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
