import { Component, input } from "@angular/core";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

@Component({
  selector: "uf-save-indicator",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let saving = this.saving();
    @let changes = this.changes();
    @let savedAt = this.savedAt();
    <p class="save-indicator" role="status">
      @if (saving) {<em>Saving</em>} @else {Saved}, {{ changes === 1 ? "1 change" : changes + " changes" }}@if (savedAt) {<time
        [attr.datetime]="savedAt"
      >{{ " at " + savedAt }}</time>} @else { just now}
    </p>
  `,
})
export default class SaveIndicator {
  readonly saving = input.required<boolean>();
  readonly changes = input.required<number>();
  readonly savedAt = input<string>();
}
