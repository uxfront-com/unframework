import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
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
  selector: "uf-billing",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let plan = this.plan();
    <fieldset [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <legend>Billing</legend>
      <label><input
        type="radio"
        name="plan"
        value="monthly"
        [checked]="this.plan() === 'monthly'"
        (change)="this.plan.set('monthly')"
      /> Monthly</label>
      <label><input
        type="radio"
        name="plan"
        value="yearly"
        [checked]="this.plan() === 'yearly'"
        (change)="this.plan.set('yearly')"
      /> Yearly</label>
      <output>Plan: {{ plan }}</output>
      <button type="button" (click)="onReset()">Reset</button>
    </fieldset>
  `,
})
export default class Billing {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly plan = signal("monthly");

  protected onReset() {
    this.plan.set("monthly");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
