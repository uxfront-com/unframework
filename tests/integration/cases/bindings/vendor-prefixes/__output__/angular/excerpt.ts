import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
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
  selector: "uf-excerpt",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let text = this.text();
    @let fill = this.fill();
    @let stroke = this.stroke();
    <article class="excerpt" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <h2
        style="-webkit-text-stroke-width: 1px; color: rgb(0, 0, 0)"
        [style.-webkit-text-fill-color]="fill"
        [style.-webkit-text-stroke-color]="stroke"
      >{{ title }}</h2>
      <p
        style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 240px"
      >{{ text }}</p>
    </article>
  `,
})
export default class Excerpt {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly fill = input.required<string>();
  readonly stroke = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
