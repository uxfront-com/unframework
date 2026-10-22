import Frame, { FrameLabel } from "./frame";
import Mat from "./mat";
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
  selector: "uf-gallery",
  imports: [Frame, Mat, FrameLabel, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let matted = this.matted();
    <section [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <uf-frame>
        <p class="caption" data-uf-9dc516fd-s="">A quiet harbour</p>
      </uf-frame>
      <uf-frame>
        <ng-template ufFrameLabel let-text="text">
          <p class="caption" data-uf-9dc516fd-s="">{{ text }}</p>
        </ng-template>
      </uf-frame>
      @switch (matted ? "Mat" : "Frame") {
        @case ("Mat") {
          <uf-mat>
            <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">A matted print</p>
          </uf-mat>
        } @case ("Frame") {
          <uf-frame>
            <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">A matted print</p>
          </uf-frame>
        }
      }
      <p class="caption">Outside the frame</p>
    </section>
  `,
})
export default class Gallery {
  readonly matted = input<boolean, boolean | undefined>(true, {
    transform: (value) => (value === undefined ? true : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
