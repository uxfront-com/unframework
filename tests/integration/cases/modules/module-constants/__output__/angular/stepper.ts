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

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

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
  selector: "uf-stepper",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let value = this.value();
    <section
      class="stepper"
      aria-label="Stepper"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">{{ caption(value) }}</p>
      <ul>
        @for (step of STEPS; track step) {
          <li>
            <button type="button" (click)="add(step)">Add {{ step }}</button>
          </li>
        }
      </ul>
    </section>
  `,
})
export default class Stepper {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly value = signal(START);
  protected readonly STEPS = STEPS;
  protected readonly caption = caption;

  protected add(step: number) {
    this.value.set(Math.min(LIMITS.max, this.value() + step));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
