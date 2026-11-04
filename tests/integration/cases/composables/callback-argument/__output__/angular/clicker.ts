import { useCounter } from "./use-counter";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
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
  selector: "uf-clicker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let count = this.counter.count();
    <section
      class="clicker"
      aria-label="Clicker"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">Count: {{ count }}</p>
      <p>{{ message }}</p>
      <button type="button" (click)="void counter.increment()">Add {{ counter.step }}</button>
      <button type="button" (click)="void counter.reset()">Reset</button>
    </section>
  `,
})
export default class Clicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly limit = output<number>();
  protected readonly message = signal("Keep going");
  protected readonly counter = useCounter(3, (reached) => {
    this.message.set(`Reached ${reached}`);
    this.limit.emit(reached);
  });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
