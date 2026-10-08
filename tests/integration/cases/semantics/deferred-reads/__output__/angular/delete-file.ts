import { Component, input, output, signal } from "@angular/core";

export interface DeleteFileProps {
  fileName: string;
}

@Component({
  selector: "uf-delete-file",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let fileName = this.fileName();
    @let copies = this.copies();
    @let confirming = this.confirming();
    <section class="delete-file" aria-label="File">
      <p>{{ fileName }}, {{ copies }}&ngsp;{{ copies === 1 ? "copy" : "copies" }}</p>
      <button type="button" (click)="addCopy()">Add a copy</button>
      @if (confirming) {
        <button type="button" (click)="confirmDelete()">Confirm the deletion</button>
      } @else {
        <button type="button" (click)="requestDelete()">Delete</button>
      }
    </section>
  `,
})
export default class DeleteFile {
  readonly fileName = input.required<string>();
  readonly deleted = output<[fileName: string, copies: number]>();
  protected readonly copies = signal(1);
  protected readonly confirming = signal(false);
  private resolveConfirmation: (() => void) | undefined;

  protected async requestDelete() {
    this.confirming.set(true);
    await new Promise<void>((resolve) => {
      this.resolveConfirmation = resolve;
    });
    this.confirming.set(false);
    this.deleted.emit([this.fileName(), this.copies()]);
  }

  protected addCopy() {
    this.copies.update((copies) => copies + 1);
  }

  protected confirmDelete() {
    this.resolveConfirmation?.();
  }
}
