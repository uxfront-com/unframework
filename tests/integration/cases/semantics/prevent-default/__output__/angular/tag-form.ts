import { Component, ElementRef, input as input_1, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-tag-form",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tags = this.tags();
    @let helpOpen = this.helpOpen();
    <form
      class="tag-form"
      aria-label="Tags"
      (submit)="addTag($event)"
      [class]="this.class()"
      [style]="this.style()"
    >
      <label>New tag<input
        name="tag"
        #field
        (keydown)="blockComma($event)"
        (input)="updateDraft($event)"
      /></label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" (click)="toggleHelp($event)">How tags work</a>
      @if (helpOpen) {
        <p>A tag is one word: commas are not allowed.</p>
      }
      <ul aria-label="Added tags">
        @for (tag of tags; track tag) {
          <li>{{ tag }}</li>
        }
      </ul>
    </form>
  `,
})
export default class TagForm {
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly tagsChange = output<string[]>();
  private readonly field = viewChild<ElementRef<HTMLInputElement>>("field");
  protected readonly tags = signal<string[]>([]);
  private readonly draft = signal("");
  protected readonly helpOpen = signal(false);

  protected blockComma(event: KeyboardEvent) {
    if (event.key === ",") event.preventDefault();
  }

  protected updateDraft(event: InputEvent) {
    this.draft.set((event.currentTarget as HTMLInputElement).value);
  }

  protected addTag(event: SubmitEvent) {
    event.preventDefault();
    if (this.draft() !== "" && !this.tags().includes(this.draft())) {
      this.tags.set([...this.tags(), this.draft()]);
      this.tagsChange.emit(this.tags());
    }
    this.draft.set("");
    const input = this.field()?.nativeElement ?? null;
    if (input) input.value = "";
  }

  protected toggleHelp(event: MouseEvent) {
    event.preventDefault();
    this.helpOpen.set(!this.helpOpen());
  }
}
