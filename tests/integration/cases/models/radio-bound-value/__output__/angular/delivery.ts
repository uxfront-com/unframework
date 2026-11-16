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

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

/**
 * A checkbox group's array once a box is checked or unchecked, as Vue's `vModelCheckbox`
 * writes it (ADR-0054): a new array with the box's value added or removed.
 */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked) return index === -1 ? [...values, value] : [...values];
  return values.filter((_, at) => at !== index);
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
  selector: "uf-delivery",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let speeds = this.speeds();
    @let extras = this.extras();
    @let speed = this.speed();
    @let chosen = this.chosen();
    <section
      aria-label="Delivery"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <fieldset>
        <legend>Speed</legend>
        @for (value of speeds; track value) {
          <label><input
            type="radio"
            name="speed"
            [attr.value]="value"
            [checked]="this.speed() === value"
            (change)="this.speed.set(value)"
          />&ngsp;{{ value }}</label>
        }
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        @for (extra of extras; track extra) {
          <label><input
            type="checkbox"
            [attr.value]="extra"
            #chosenField
            [checked]="this.chosen().includes(extra)"
            (change)="this.chosen.set(toggle(this.chosen(), extra, chosenField.checked))"
          />&ngsp;{{ extra }}</label>
        }
      </fieldset>
      <output>Speed: {{ speed }}, extras: {{ chosen.join(", ") || "none" }}</output>
    </section>
  `,
})
export default class Delivery {
  readonly speeds = input.required<string[]>();
  readonly extras = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly speed = signal("express");
  protected readonly chosen = signal<string[]>(["insurance"]);
  protected readonly toggle = toggle;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
