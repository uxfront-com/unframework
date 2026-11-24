import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

@Component({
  selector: "uf-draft-notice",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    @let saved = this.saved();
    <section
      class="draft-notice"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
        [attr.alt]="author + &quot;'s avatar&quot;"
        width="32"
        height="32"
      />
      <p
        [attr.title]="saved ? 'Saved' : &quot;Don't forget to save&quot;"
      >{{ saved ? "Saved" : 'Not "saved" yet' }}</p>
      <p
        [attr.title]="saved ? 'Nothing to save' : 'Press &quot;Save&quot; to keep ' + author + &quot;'s changes&quot;"
      >{{ saved ? author + "'s draft is safe." : author + " says: \\u0022I'll save it later.\\u0022" }}</p>
    </section>
  `,
})
export default class DraftNotice {
  readonly author = input.required<string>();
  readonly saved = input.required<boolean>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
