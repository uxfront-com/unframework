import { Component, input } from "@angular/core";

export interface FileTransferProps {
  fileName: string;
  percent: number;
  paused: boolean;
  eta?: string;
}

@Component({
  selector: "uf-file-transfer",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fileName = this.fileName();
    @let percent = this.percent();
    @let paused = this.paused();
    @let eta = this.eta();
    <div class="file-transfer" [class]="this.class()" [style]="this.style()">
      <svg class="file-transfer-progress" role="img" viewBox="0 0 36 36" width="36" height="36">
        <svg:title>{{ fileName }}: {{ percent }}% sent. {{ eta }}</svg:title>
        <circle cx="18" cy="18" r="16" fill="none" stroke="#0969da" stroke-width="4" />
      </svg>
      <svg class="file-transfer-state" role="img" viewBox="0 0 16 16" width="16" height="16">
        <svg:title>@if (paused) {Transfer paused} @else {Sending {{ fileName }}}</svg:title>
        <rect x="2" y="2" width="12" height="12" rx="2" fill="#1a7f37" />
      </svg>
    </div>
  `,
})
export default class FileTransfer {
  readonly fileName = input.required<string>();
  readonly percent = input.required<number>();
  readonly paused = input.required<boolean>();
  readonly eta = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
