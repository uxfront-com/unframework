import Display from "./display";
import {
  Component,
  Directive,
  ElementRef,
  InjectionToken,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
} from "@angular/core";

export const CountKey = new InjectionToken<{ readonly value: number }>("uf.count");

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
  selector: "uf-counter",
  imports: [Display, ScopeAttributes],
  providers: [{ provide: CountKey, useFactory: () => refObject(inject(Counter).count) }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      aria-label="Counter"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <uf-display />
      <button type="button" (click)="onAddOne()">Add one</button>
    </section>
  `,
})
export default class Counter {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly count = signal(1);

  protected onAddOne() {
    this.count.update((count) => count + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
