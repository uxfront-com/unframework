import { Component, input } from "@angular/core";

export interface StepListProps {
  title: string;
  steps: string[];
}

@Component({
  selector: "uf-step-list",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let steps = this.steps();
    <ol class="step-list" [attr.aria-label]="title">
      @for (step of steps; track index; let index = $index) {
        <li [attr.data-step]="index + 1">Step {{ index + 1 }}: {{ step }}</li>
      }
    </ol>
  `,
})
export default class StepList {
  readonly title = input.required<string>();
  readonly steps = input.required<string[]>();
}
