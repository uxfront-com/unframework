import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import type { FieldOptions } from "./types";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

@Component({
  selector: "uf-text-field",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let label = this.label();
    @let placeholder = this.placeholder();
    @let required = this.required();
    <label
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ label }}<input
      [attr.name]="name"
      [attr.placeholder]="placeholder"
      [attr.required]="required ? '' : null"
    /></label>
  `,
})
export default class TextField {
  readonly name = input.required<TextFieldProps["name"]>();
  readonly label = input.required<TextFieldProps["label"]>();
  readonly placeholder = input<TextFieldProps["placeholder"]>();
  readonly required = input<TextFieldProps["required"]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLLabelElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
