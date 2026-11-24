import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, viewChild } from "@angular/core";

export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

@Component({
  selector: "uf-file-row",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let path = this.path();
    @let size = this.size();
    <div
      class="file-row"
      role="group"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : path"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <span>{{ path }} ({{ size }} bytes)</span>
      <button type="button" (click)="refresh.emit()">Refresh</button>
      <button type="button" (click)="open.emit(path)">Open</button>
      <button type="button" (click)="archive()">Archive</button>
      <button type="button" (click)="onSelect()">Select</button>
      <button type="button" (click)="share.emit([path])">Share</button>
      <button type="button" (click)="share.emit([path, 'Please review'])">Share with a note</button>
    </div>
  `,
})
export default class FileRow {
  readonly path = input.required<string>();
  readonly size = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly refresh = output<void>();
  readonly open = output<string>();
  readonly move = output<[from: string, to: string]>();
  readonly pick = output<FileInfo>();
  readonly share = output<[path: string, note?: string]>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");

  protected archive() {
    this.move.emit([this.path(), `archive/${this.path()}`]);
    this.refresh.emit();
  }

  protected onSelect() {
    this.pick.emit({ path: this.path(), size: this.size() });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
