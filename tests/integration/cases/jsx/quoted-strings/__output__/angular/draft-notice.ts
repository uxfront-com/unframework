import { Component, input } from "@angular/core";

export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

@Component({
  selector: "uf-draft-notice",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    @let saved = this.saved();
    <section class="draft-notice" aria-label="Draft">
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
}
