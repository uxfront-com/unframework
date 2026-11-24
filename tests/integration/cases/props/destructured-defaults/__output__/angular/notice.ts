import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

@Component({
  selector: "uf-notice",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let title = this.title();
    @let tone = this.tone();
    @let priority = this.priority();
    @let expanded = this.expanded();
    @let tags = this.tags();
    @let author = this.author();
    <section
      class="notice"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : title"
      [attr.data-tone]="'data-tone' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-tone'] : tone"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <details [attr.open]="expanded ? '' : null">
        <summary>Priority {{ priority }}</summary>
        <p>Tagged {{ tags.join(", ") }}, posted by {{ author.name }}.</p>
      </details>
    </section>
  `,
})
export default class Notice {
  readonly message = input.required<string>();
  readonly title = input<string, string | undefined>("Notice", {
    transform: (value) => (value === undefined ? "Notice" : value),
  });
  readonly tone = input<"info" | "warning", "info" | "warning" | undefined>("info", {
    transform: (value) => (value === undefined ? "info" : value),
  });
  readonly priority = input<number, number | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
  readonly expanded = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly tags = input<string[], string[] | undefined>(["general"], {
    transform: (value) => (value === undefined ? ["general"] : value),
  });
  readonly author = input<{ name: string }, { name: string } | undefined>(
    { name: "System" },
    { transform: (value) => (value === undefined ? { name: "System" } : value) },
  );
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
