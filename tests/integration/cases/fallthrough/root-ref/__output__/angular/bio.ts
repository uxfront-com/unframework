import { Component, ElementRef, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-bio",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <input name="bio" [attr.aria-label]="label" #ufElement />
  `,
})
export default class Bio {
  readonly label = input.required<string>();
  readonly ufElement = viewChild<ElementRef<HTMLInputElement>>("ufElement");
}
