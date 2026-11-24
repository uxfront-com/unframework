import { Pipe, type PipeTransform, inject } from "@angular/core";
import { DomSanitizer, type SafeHtml } from "@angular/platform-browser";

/** Marks markup trusted, so that `[innerHTML]` renders it as written. */
@Pipe({ name: "trustedHtml" })
export class TrustedHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
