// UF2002 non-static-prop-default: a default must be a literal value; this one reads a global.
export interface PagerProps {
  page: number;
  pageCount?: number;
}

export default function Pager({ page, pageCount = Number.MAX_SAFE_INTEGER }: PagerProps) {
  return (
    <p>
      Page {page} of {pageCount}
    </p>
  );
}
