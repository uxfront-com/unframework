import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-note-editor",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let bold = this.bold();
    @let saves = this.saves();
    <form
      class="note-editor"
      aria-label="Note"
      (submit)="onNoteSubmit($event)"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Title<input name="title" (input)="onTitleInput($event)" /></label>
      <label>Text<textarea name="text"></textarea></label>
      <div class="format" role="group" aria-label="Format">
        <button
          type="button"
          [attr.aria-pressed]="bold"
          (mousedown)="onBoldMousedown($event)"
          (click)="onBold()"
        >Bold</button>
      </div>
      <button type="submit" (click)="save()">Save</button>
      <p role="status">Saves: {{ saves }}</p>
    </form>
  `,
})
export default class NoteEditor {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly saved = output<[title: string, bold: boolean]>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  private readonly title = signal("");
  protected readonly bold = signal(false);
  protected readonly saves = signal(0);

  protected save() {
    this.saves.update((saves) => saves + 1);
    this.saved.emit([this.title(), this.bold()]);
  }

  protected onNoteSubmit(event: SubmitEvent) {
    event.preventDefault();
  }

  protected onTitleInput(event: InputEvent) {
    this.title.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onBoldMousedown(event: MouseEvent) {
    event.preventDefault();
  }

  protected onBold() {
    this.bold.set(!this.bold());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
