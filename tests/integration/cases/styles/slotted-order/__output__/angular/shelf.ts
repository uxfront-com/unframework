import Amber from "./amber";
import Blue from "./blue";
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
  selector: "uf-shelf",
  imports: [Blue, Amber, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <uf-blue>
        <p class="caption" data-uf-721c504a-s="">In blue</p>
      </uf-blue>
      <uf-amber>
        <p class="caption" data-uf-c97301b3-s="">In amber</p>
      </uf-amber>
      @for (item of items; track item.label) {
        <div>
          @switch (item.warm ? "Amber" : "Blue") {
            @case ("Amber") {
              <uf-amber>
                <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{{ item.label }}</p>
              </uf-amber>
            } @case ("Blue") {
              <uf-blue>
                <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{{ item.label }}</p>
              </uf-blue>
            }
          }
        </div>
      }
    </section>
  `,
})
export default class Shelf {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly items = [
    { label: "Warm", warm: true },
    { label: "Cool", warm: false },
  ];
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
