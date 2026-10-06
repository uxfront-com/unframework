import { Component, input } from "@angular/core";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

@Component({
  selector: "uf-usage-meter",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let percent = this.percent();
    @let colour = this.colour();
    @let thickness = this.thickness();
    <div class="usage-meter">
      <p
        style="margin-bottom: 4px"
        [style.color]="colour"
        [style.font-weight]="700"
        [style.line-height]="1.5"
      >{{ label }}: {{ percent }}%</p>
      <div
        role="progressbar"
        [attr.aria-label]="label"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent"
        style="width: 200px; height: 12px; border-style: solid"
        [style.--meter-colour]="colour"
        [style.--meter-value]="percent"
        [style.border-width]="thickness + 'px'"
        [style.border-color]="colour"
      >
        <div
          style="height: 100%; background-color: var(--meter-colour)"
          [style.width]="percent + '%'"
        ></div>
      </div>
      <p
        class="usage-meter-caption"
        style="font-family: &quot;UF Test Sans&quot;, sans-serif"
        [style.color]="colour"
      >{{ percent }} of 100 used</p>
    </div>
  `,
})
export default class UsageMeter {
  readonly label = input.required<string>();
  readonly percent = input.required<number>();
  readonly colour = input.required<string>();
  readonly thickness = input.required<number>();
}
