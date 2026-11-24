import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input } from "@angular/core";

@Component({
  selector: "uf-status",
  imports: [ScopeAttributes],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let busy = this.busy();
    @let text = this.text();
    @if (busy) {
      <span class="badge" role="status" [ufScope]="this.host">Saving</span>
    } @else {
      <button type="button" class="badge" [ufScope]="this.host">{{ text }}</button>
    }
  `,
})
export default class Status {
  readonly busy = input.required<boolean>();
  readonly text = input.required<string>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
