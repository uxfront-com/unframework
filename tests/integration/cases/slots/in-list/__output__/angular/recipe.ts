import Steps, { StepsMarker } from "./steps";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-recipe",
  imports: [Steps, StepsMarker],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let steps = this.steps();
    <div [class]="this.class()" [style]="this.style()">
      <uf-steps [steps]="steps">
        <ng-template ufStepsMarker>
          <span aria-hidden="true">> </span>
        </ng-template>
      </uf-steps>
    </div>
  `,
})
export default class Recipe {
  readonly steps = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
