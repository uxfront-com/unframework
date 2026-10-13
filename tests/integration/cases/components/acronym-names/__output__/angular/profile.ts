import Avatar from "./avatar";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-profile",
  imports: [Avatar],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let picked = this.picked();
    <div [class]="this.class()" [style]="this.style()">
      <uf-avatar [imageURL]="'/a.png'" [userID]="7" (pickedURL)="onPickedURL($event)" />
      <output>Picked: {{ picked }}</output>
    </div>
  `,
})
export default class Profile {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly picked = signal("none");

  protected onPickedURL(url: string) {
    this.picked.set(url);
  }
}
