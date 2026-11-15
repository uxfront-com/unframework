import Choice, { ChoiceBody } from "./choice";
import List, { ListItem } from "./list";
import { VTrace } from "./v-trace";
import Wrapper, { WrapperRow } from "./wrapper";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
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
  selector: "uf-page",
  imports: [Wrapper, Choice, List, WrapperRow, ChoiceBody, ListItem, ScopeAttributes, VTrace],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let noted = this.noted();
    <section
      class="page"
      aria-label="Page"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <uf-wrapper>
        <ng-template ufWrapperRow>
          <span data-name="row" [vTrace]="label">Row</span>
        </ng-template>
      </uf-wrapper>
      <uf-choice>
        <ng-template ufChoiceBody>
          <em data-name="body" [vTrace]="label">Body</em>
        </ng-template>
      </uf-choice>
      <uf-list [items]="['a', 'b']">
        <ng-template ufListItem let-item="item">
          <strong data-name="item" [vTrace]="label">{{ item }}</strong>
        </ng-template>
      </uf-list>
      <p #note data-name="note" [vTrace]="label">Note</p>
      <output>{{ noted }}</output>
      <button type="button" (click)="onCheck()">Check</button>
      <button type="button" (click)="onRename()">Rename</button>
    </section>
  `,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly note = viewChild<ElementRef<HTMLParagraphElement>>("note");
  protected readonly label = signal("first");
  protected readonly noted = signal("");

  protected onCheck() {
    this.noted.set(this.note()?.nativeElement.getAttribute("data-name") ?? "");
  }

  protected onRename() {
    this.label.set("second");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
