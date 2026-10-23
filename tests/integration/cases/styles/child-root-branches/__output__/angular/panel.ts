import Heading from "./heading";
import Status from "./status";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  ViewEncapsulation,
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
  selector: "uf-panel",
  imports: [Heading, Status, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      class="panel"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-34db6205=""
      [ufScope]="this.host"
    >
      <uf-heading [big]="true" [text]="'Release'" data-uf-34db6205="" />
      <uf-heading [big]="false" [text]="'Notes'" data-uf-34db6205="" />
      <uf-status [busy]="false" [text]="'Save'" data-uf-34db6205="" />
      <uf-status [busy]="true" [text]="'Save'" data-uf-34db6205="" />
    </section>
  `,
  styleUrl: "./Panel.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Panel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
