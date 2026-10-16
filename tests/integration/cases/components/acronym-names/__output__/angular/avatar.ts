import { Component, input, output } from "@angular/core";

@Component({
  selector: "uf-avatar",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let imageURL = this.imageURL();
    @let userID = this.userID();
    <button
      type="button"
      [attr.data-user]="userID"
      (click)="pickedURL.emit(imageURL)"
      [class]="this.class()"
      [style]="this.style()"
    >User {{ userID }}: {{ imageURL }}</button>
  `,
})
export default class Avatar {
  readonly imageURL = input.required<string>();
  readonly userID = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly pickedURL = output<string>();
}
