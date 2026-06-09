'use client';

export function WorksheetActions() {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <a
        href="/downloads/can-i-do-this-worksheet.docx"
        className="inline-block rounded-full bg-g px-5 py-2.5 text-[14px] font-medium text-white hover:bg-g-mid transition-colors"
        download
      >
        Download (.docx)
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-block rounded-full border border-bd2 bg-s0 px-5 py-2.5 text-[14px] font-medium text-ink2 hover:border-g hover:text-g transition-colors"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
