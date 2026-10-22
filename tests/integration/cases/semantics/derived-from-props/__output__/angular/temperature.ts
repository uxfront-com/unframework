import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from "@angular/core";

export interface TemperatureProps {
  celsius: number;
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
  selector: "uf-temperature",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let celsius = this.celsius();
    @let fahrenheit = this.fahrenheit();
    @let level = this.level();
    <figure
      class="temperature"
      [attr.data-level]="level"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>{{ celsius }} °C</p>
      <p>{{ fahrenheit }} °F</p>
      <figcaption>Feels {{ level }}</figcaption>
    </figure>
  `,
})
export default class Temperature implements OnInit {
  readonly celsius = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly reading = output<[celsius: number, previous: number]>();
  private readonly injector = inject(Injector);
  protected readonly fahrenheit = computed(() => Math.round((this.celsius() * 9) / 5 + 32));
  protected readonly level = computed(() =>
    this.celsius() >= 30 ? "hot" : this.celsius() <= 5 ? "cold" : "mild",
  );

  ngOnInit(): void {
    let lastCelsius = this.celsius();
    effect(
      () => {
        const value = this.celsius();
        if (Object.is(value, lastCelsius)) return;
        const previous = lastCelsius;
        lastCelsius = value;
        untracked(() => {
          this.reading.emit([value, previous]);
        });
      },
      { injector: this.injector },
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
