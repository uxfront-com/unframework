import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformServer } from "@angular/common";
import { Component, ElementRef, PLATFORM_ID, inject, input, model, viewChild } from "@angular/core";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

@Component({
  selector: "uf-select",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let options = this.options();
    <label
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}&ngsp;<select
      #valueField
      (change)="this.value.set($any(valueField.value))"
    >@for (option of options; track option) {<option
      [attr.value]="option"
      [defaultSelected]="onServer && this.value() === option" [selected]="this.value() === option"
    >{{ option }}</option>}</select></label>
  `,
})
export default class Select<T extends string> {
  readonly label = input.required<string>();
  readonly options = input.required<readonly T[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly value = model.required<T>();
  readonly ufElement = viewChild<ElementRef<HTMLLabelElement>>("ufElement");
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
