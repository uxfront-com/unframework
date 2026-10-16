import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-note-editor",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let note = this.note();
    <section aria-label="Note" [class]="this.class()" [style]="this.style()">
      <textarea
        aria-label="Text"
        #noteField
        [value]="this.note()"
        (input)="this.note.set(noteField.value)"
      ></textarea>
      <output>{{ note.length }} characters</output>
      <button type="button" (click)="onDiscard()">Discard</button>
    </section>
  `,
})
export default class NoteEditor {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly note = signal("Buy milk");

  protected onDiscard() {
    this.note.set("");
  }
}
