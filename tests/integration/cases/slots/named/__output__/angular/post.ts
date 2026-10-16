import Card, { CardFooter, CardHeader } from "./card";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-post",
  imports: [Card, CardHeader, CardFooter],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    <uf-card [class]="this.class()" [style]="this.style()">
      <p>Slots arrive in M3.</p>
      <ng-template ufCardHeader>
        <h2>Release notes</h2>
      </ng-template>
      <ng-template ufCardFooter>
        <small>By {{ author }}</small>
      </ng-template>
    </uf-card>
  `,
})
export default class Post {
  readonly author = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
