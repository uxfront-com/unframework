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
  selector: "uf-status",
  imports: [ScopeAttributes],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let busy = this.busy();
    @let text = this.text();
    @if (busy) {
      <span class="badge" role="status" [ufScope]="this.host">Saving</span>
    } @else {
      <button type="button" class="badge" [ufScope]="this.host">{{ text }}</button>
    }
  `,
})
export default class Status {
  readonly busy = input.required<boolean>();
  readonly text = input.required<string>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
