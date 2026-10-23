import Counter from "./counter";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  viewChild,
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
  selector: "uf-controls",
  imports: [Counter, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="controls" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <uf-counter #counter [start]="10" />
      <button type="button" (click)="onMore()">More</button>
      <button type="button" (click)="onReset()">Reset</button>
    </div>
  `,
})
export default class Controls {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly counter = viewChild<{ increment(): void; reset(): void }>("counter");

  protected onMore() {
    this.counter()?.increment();
  }

  protected onReset() {
    this.counter()?.reset();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
