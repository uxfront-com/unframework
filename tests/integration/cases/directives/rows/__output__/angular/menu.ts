import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Picker, { PickerOption } from "./picker";
import { VMark } from "./v-mark";
import { VTrace } from "./v-trace";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-menu",
  imports: [Picker, PickerOption, ScopeAttributes, Fallthrough, VMark, VTrace],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.items();
    @let prefix = this.prefix();
    @let focused = this.focused();
    <section
      class="menu"
      aria-label="Menu"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <ul aria-label="Items">
        @for (item of items; track item.id) {
          <li
            [attr.data-name]="item.id"
            [vTrace]="item.label"
          >{{ item.label }}@if (item.note) {<b
            [attr.data-name]="'note-' + item.id"
            [vTrace]="item.note"
          >{{ item.note }}</b>}</li>
        }
      </ul>
      <ul aria-label="Marked">
        @for (item of items; track item.id) {
          <li
            [attr.data-name]="'both-' + item.id"
            [vTrace]="item.label"
            [vMark]="item.id"
          >{{ item.label }}</li>
        }
      </ul>
      <div class="focus">
        @for (item of items; track item.id) {
          <button
            type="button"
            [attr.data-name]="'focus-' + item.id"
            (focusin)="onFocusin()"
            [vTrace]="item.label"
          >Focus {{ item.label }}</button>
        }
      </div>
      <output>{{ focused }}</output>
      <ul aria-label="Prefixed">
        @for (item of items; track item.id) {
          <li
            [attr.data-name]="'prefixed-' + item.id"
            [vTrace]="prefix + ' ' + item.label"
          >{{ item.label }}</li>
        }
      </ul>
      <uf-picker>
        <ng-template ufPickerOption let-option="option">
          <span
            [attr.data-name]="'option-' + option.id"
            [vTrace]="prefix + ' ' + option.label"
          >{{ option.label }}</span>
        </ng-template>
      </uf-picker>
      <button type="button" (click)="onRenameFirst()">Rename first</button>
      <button type="button" (click)="onReverse()">Reverse</button>
      <button type="button" (click)="onRemoveSecond()">Remove second</button>
      <button type="button" (click)="onAddItem()">Add item</button>
      <button type="button" (click)="onChangePrefix()">Change prefix</button>
    </section>
  `,
})
export default class Menu {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly items = signal<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  protected readonly prefix = signal("Open");
  protected readonly focused = signal(0);

  protected onFocusin() {
    this.focused.update((focused) => focused + 1);
  }

  protected onRenameFirst() {
    this.items.set(
      this.items().map((item) =>
        item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
      ),
    );
  }

  protected onReverse() {
    this.items.set([...this.items()].reverse());
  }

  protected onRemoveSecond() {
    this.items.set(this.items().filter((item) => item.id !== "b"));
  }

  protected onAddItem() {
    this.items.set([...this.items(), { id: "d", label: "Delta" }]);
  }

  protected onChangePrefix() {
    this.prefix.set("Close");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
