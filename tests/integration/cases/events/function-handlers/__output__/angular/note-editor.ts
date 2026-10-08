import { Component, ElementRef, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-note-editor",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let saves = this.saves();
    @let lastKey = this.lastKey();
    @let tags = this.tags();
    <section class="note-editor" aria-label="Note">
      <button type="button" (click)="save()">Save</button>
      <label>Title<input name="title" (keydown)="recordKey($event)" /></label>
      <label>Body<textarea name="body" (keydown)="recordKey($event)"></textarea></label>
      <p role="status">Saved {{ saves }} times, last key {{ lastKey }}</p>
      <button type="button" (click)="save()">Save and close</button>
      <label>Tag<input
        #tagField
        name="tag"
        (input)="onTagInput($event)"
        (keydown)="onTagKeydown($event)"
      /></label>
      <button type="button" (click)="addTag($event)">Add tag</button>
      <p>Tags: {{ tags.join(", ") }}</p>
    </section>
  `,
})
export default class NoteEditor {
  readonly saved = output<number>();
  readonly tagged = output<[tag: string, via: string]>();
  private readonly tagField = viewChild<ElementRef<HTMLInputElement>>("tagField");
  protected readonly saves = signal(0);
  protected readonly lastKey = signal("none");
  protected readonly tags = signal<string[]>([]);
  private readonly tag = signal("");

  protected save() {
    this.saves.update((saves) => saves + 1);
    this.saved.emit(this.saves());
  }

  protected recordKey(event: KeyboardEvent) {
    this.lastKey.set(event.key);
  }

  protected addTag(event: MouseEvent | KeyboardEvent) {
    if (this.tag() === "") return;
    this.tags.set([...this.tags(), this.tag()]);
    this.tagged.emit([this.tag(), event.type]);
    this.tag.set("");
    if (this.tagField()?.nativeElement) this.tagField()!.nativeElement.value = "";
  }

  protected onTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") this.addTag(event);
  }

  protected onTagInput(event: InputEvent) {
    this.tag.set((event.currentTarget as HTMLInputElement).value);
  }
}
