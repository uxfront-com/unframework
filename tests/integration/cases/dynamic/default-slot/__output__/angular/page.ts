import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Action, { ActionIcon } from "./action";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [Action, ActionIcon, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    <section
      class="page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-action [href]="'#docs'" [label]="'Docs'">Read the docs</uf-action>
      <uf-action [label]="'Save'">Save the draft</uf-action>
      <uf-action [href]="'#home'" [label]="'Home'" />
      <uf-action [label]="'Close'" />
      <uf-action
        [href]="linked ? '#more' : undefined"
        [label]="'More'"
      >Learn more<ng-template ufActionIcon><i aria-hidden="true">+</i></ng-template></uf-action>
      <button type="button" (click)="onToggle()">Toggle</button>
    </section>
  `,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly linked = signal(true);

  protected onToggle() {
    this.linked.set(!this.linked());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
