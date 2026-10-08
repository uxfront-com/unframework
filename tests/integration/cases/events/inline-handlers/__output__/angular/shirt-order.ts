import { Component, ElementRef, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-shirt-order",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    @let quantity = this.quantity();
    @let note = this.note();
    <section class="shirt-order" aria-label="Shirt order">
      <p role="status">{{ quantity + " x size " + size }}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          [attr.aria-pressed]="size === 'S'"
          (click)="onSmall($event)"
        >Small</button>
        <button
          type="button"
          value="M"
          [attr.aria-pressed]="size === 'M'"
          (click)="onMedium($event)"
        >Medium</button>
        <button
          type="button"
          value="L"
          [attr.aria-pressed]="size === 'L'"
          (click)="onLarge($event)"
        >Large</button>
      </div>
      <button type="button" (click)="onAddOne()">Add one</button>
      <label>Note<input name="note" #noteField (input)="onNoteInput($event)" /></label>
      <p>Note: {{ note }}</p>
      <button type="button" (click)="onReset()">Reset</button>
    </section>
  `,
})
export default class ShirtOrder {
  private readonly noteField = viewChild<ElementRef<HTMLInputElement>>("noteField");
  protected readonly size = signal("M");
  protected readonly quantity = signal(1);
  protected readonly note = signal("");

  protected onSmall(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onMedium(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onLarge(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onAddOne() {
    this.quantity.update((quantity) => quantity + 1);
  }

  protected onNoteInput(event: InputEvent) {
    this.note.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onReset() {
    this.quantity.set(1);
    this.size.set("M");
    this.note.set("");
    const input = this.noteField()?.nativeElement ?? null;
    if (input) input.value = "";
  }
}
