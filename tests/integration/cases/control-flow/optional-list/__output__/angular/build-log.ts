import { Component, input } from "@angular/core";

interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
}

@Component({
  selector: "uf-build-log",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let target = this.target();
    @let failed = this.failed();
    @let lines = this.lines();
    @let warnings = this.warnings();
    <section class="build-log" aria-label="Build log" [class]="this.class()" [style]="this.style()">
      <pre>$ make {{ target }}@if (failed) {<strong> (failed)</strong>}{{ "\\n" }}@for (line of lines ?? []; track line.id) {<code>{{ line.text }}{{ "\\n" }}</code>}</pre>
      <ul aria-label="Warnings">
        @for (warning of warnings ?? []; track warning) {
          <li>{{ warning }}</li>
        }
      </ul>
    </section>
  `,
})
export default class BuildLog {
  readonly target = input.required<string>();
  readonly failed = input.required<boolean>();
  readonly lines = input<LogLine[] | null>();
  readonly warnings = input<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
