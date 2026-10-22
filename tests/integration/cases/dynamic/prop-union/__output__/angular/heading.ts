import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
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
  selector: "uf-heading",
  imports: [ScopeAttributes],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let tag = this.tag();
    @let text = this.text();
    @switch (tag) {
      @case ("h1") {
        <h1 class="heading" [ufScope]="this.host">{{ text }}</h1>
      } @case ("h2") {
        <h2 class="heading" [ufScope]="this.host">{{ text }}</h2>
      } @case ("h3") {
        <h3 class="heading" [ufScope]="this.host">{{ text }}</h3>
      }
    }
  `,
})
export default class Heading {
  readonly tag = input.required<"h1" | "h2" | "h3">();
  readonly text = input.required<string>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
