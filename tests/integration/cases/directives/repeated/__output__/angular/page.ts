import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Choice, { ChoiceBody } from "./choice";
import List, { ListItem } from "./list";
import { VTrace } from "./v-trace";
import Wrapper, { WrapperRow } from "./wrapper";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [
    Wrapper,
    Choice,
    List,
    WrapperRow,
    ChoiceBody,
    ListItem,
    ScopeAttributes,
    Fallthrough,
    VTrace,
  ],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly note = viewChild<ElementRef<HTMLParagraphElement>>("note");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
