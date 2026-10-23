import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
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
  selector: "uf-summary",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let plan = this.plan();
    @let seats = this.seats();
    <div
      class="summary"
      [style]="{ display: 'table', 'border-spacing': '8px 4px', ...this.style() }"
      [class]="this.class()"
      [ufScope]="this.host"
    >
      <div style="display: table-caption; font-weight: 700">Account</div>
      <div style="display: table-row">
        <span style="display: table-cell">Name</span>
        <span style="display: table-cell">{{ name }}</span>
      </div>
      <div style="display: table-row">
        <span style="display: table-cell">Plan</span>
        <span style="display: table-cell">{{ plan }} for {{ seats }} seats</span>
      </div>
      <p>Billed to <span style="display: table-cell; padding: 0 4px">{{ name }}</span> monthly.</p>
    </div>
  `,
})
export default class Summary {
  readonly name = input.required<string>();
  readonly plan = input.required<string>();
  readonly seats = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
