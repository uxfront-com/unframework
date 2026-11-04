import Panel from "./panel";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
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
  selector: "uf-board",
  imports: [Panel, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let showA = this.showA();
    @let showB = this.showB();
    @let entries = this.entries();
    <div class="board" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      @if (showA) {
        <uf-panel [name]="'a'" (closed)="record($event)" />
      }
      @if (showB) {
        <uf-panel [name]="'b'" (closed)="record($event)" />
      }
      <button type="button" (click)="onHideA()">Hide a</button>
      <button type="button" (click)="onHideB()">Hide b</button>
      <output>{{ entries.join(", ") }}</output>
    </div>
  `,
})
export default class Board {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly showA = signal(true);
  protected readonly showB = signal(true);
  protected readonly entries = signal<string[]>([]);

  protected record(entry: string) {
    this.entries.set([...this.entries(), entry]);
  }

  protected onHideA() {
    this.showA.set(false);
  }

  protected onHideB() {
    this.showB.set(false);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
