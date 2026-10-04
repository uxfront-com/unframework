import { Component, input } from "@angular/core";

export interface StatusIconProps {
  label: string;
  size?: number;
  colour?: string;
}

@Component({
  selector: "uf-status-icon",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let size = this.size();
    @let colour = this.colour();
    <svg
      class="status-icon"
      role="img"
      viewBox="0 0 24 24"
      [attr.width]="size"
      [attr.height]="size"
      fill="none"
    >
      <title>{{ label }}</title>
      <defs>
        <linearGradient id="status-icon-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="colour" />
          <stop offset="1" stop-color="#0b3d91" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#status-icon-fill)" />
      <path
        d="M7 12.5l3 3 7-7"
        stroke="#ffffff"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
})
export default class StatusIcon {
  readonly label = input.required<string>();
  readonly size = input<number, number | undefined>(24, {
    transform: (value) => (value === undefined ? 24 : value),
  });
  readonly colour = input<string, string | undefined>("#1f6feb", {
    transform: (value) => (value === undefined ? "#1f6feb" : value),
  });
}
