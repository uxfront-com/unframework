import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
} from "@angular/core";

export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-file-row",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let path = this.path();
    @let size = this.size();
    <div
      class="file-row"
      role="group"
      [attr.aria-label]="path"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  readonly refresh = output<void>();
  readonly open = output<string>();
  readonly move = output<[from: string, to: string]>();
  readonly pick = output<FileInfo>();
  readonly share = output<[path: string, note?: string]>();

  protected archive() {
    this.move.emit([this.path(), `archive/${this.path()}`]);
    this.refresh.emit();
  }

  protected onSelect() {
    this.pick.emit({ path: this.path(), size: this.size() });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
