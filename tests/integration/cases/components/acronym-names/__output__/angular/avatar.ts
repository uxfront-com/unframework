import { Component, input, output } from "@angular/core";

@Component({
  selector: "uf-avatar",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let imageURL = this.imageURL();
    @let userID = this.userID();
    <button
      type="button"
      [attr.data-user]="userID"
      (click)="pickedURL.emit(imageURL)"
    >User {{ userID }}: {{ imageURL }}</button>
  `,
})
export default class Avatar {
  readonly imageURL = input.required<string>();
  readonly userID = input.required<number>();
  readonly pickedURL = output<string>();
}
