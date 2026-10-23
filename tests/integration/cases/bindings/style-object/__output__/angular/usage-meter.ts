import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
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
  selector: "uf-usage-meter",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let percent = this.percent();
    @let colour = this.colour();
    @let thickness = this.thickness();
    <div class="usage-meter" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <p
        style="margin-bottom: 4px"
        [style.color]="colour"
        [style.font-weight]="700"
        [style.line-height]="1.5"
      >{{ label }}: {{ percent }}%</p>
      <div
        role="progressbar"
        [attr.aria-label]="label"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent"
        style="width: 200px; height: 12px; border-style: solid"
        [style.--meter-colour]="colour"
        [style.--meter-value]="percent"
        [style.border-width]="thickness + 'px'"
        [style.border-color]="colour"
      >
        <div
          style="height: 100%; background-color: var(--meter-colour)"
          [style.width]="percent + '%'"
        ></div>
      </div>
      <p
        class="usage-meter-caption"
        style="font-family: &quot;UF Test Sans&quot;, sans-serif"
        [style.color]="colour"
      >{{ percent }} of 100 used</p>
    </div>
  `,
})
export default class UsageMeter {
  readonly label = input.required<string>();
  readonly percent = input.required<number>();
  readonly colour = input.required<string>();
  readonly thickness = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
