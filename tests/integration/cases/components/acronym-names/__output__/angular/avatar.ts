import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, viewChild } from "@angular/core";

@Component({
  selector: "uf-avatar",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let imageURL = this.imageURL();
    @let userID = this.userID();
    <button
      type="button"
      [attr.data-user]="'data-user' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-user'] : userID"
      (click)="pickedURL.emit(imageURL)"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >User {{ userID }}: {{ imageURL }}</button>
  `,
})
export default class Avatar {
  readonly imageURL = input.required<string>();
  readonly userID = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly pickedURL = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
