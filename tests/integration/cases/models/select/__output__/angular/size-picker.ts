import { isPlatformServer } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  PLATFORM_ID,
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
  selector: "uf-size-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    <section aria-label="Size" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <label>Size <select
        #sizeField
        (change)="this.size.set(sizeField.value)"
      ><option
        value="s"
        [selected]="this.size() === 's'" [defaultSelected]="onServer && this.size() === 's'"
      >Small</option><option
        value="m"
        [selected]="this.size() === 'm'" [defaultSelected]="onServer && this.size() === 'm'"
      >Medium</option><option
        value="l"
        [selected]="this.size() === 'l'" [defaultSelected]="onServer && this.size() === 'l'"
      >Large</option></select></label>
      <output>Chosen: {{ size }}</output>
      <button type="button" (click)="onLargest()">Largest</button>
    </section>
  `,
})
export default class SizePicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly size = signal("m");
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));

  protected onLargest() {
    this.size.set("l");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
