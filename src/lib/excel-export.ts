export type SheetColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export type SheetSpec<T> = {
  name: string;
  columns: SheetColumn<T>[];
  rows: T[];
};

const HEADER_STYLE = {
  font: { bold: true, sz: 11, color: { rgb: "FF1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFE5E7EB" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "FFB0B7C3" } },
    bottom: { style: "thin", color: { rgb: "FFB0B7C3" } },
    left: { style: "thin", color: { rgb: "FFB0B7C3" } },
    right: { style: "thin", color: { rgb: "FFB0B7C3" } },
  },
} as const;

/** Ước lượng độ rộng cột theo độ dài chuỗi dài nhất (auto-fit). */
function autoWidths(header: string[], body: (string | number)[][]) {
  return header.map((h, i) => {
    let max = String(h).length;
    for (const r of body) {
      const len = String(r[i] ?? "").length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 3, 10), 55) };
  });
}

/** Xuất một hoặc nhiều sheet ra file .xlsx (header in hoa, bôi đậm, nền xám, auto-fit cột). */
export async function exportExcel(
  sheets: SheetSpec<never>[] | SheetSpec<any>[],
  fileName: string,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const header = sheet.columns.map((c) => c.header.toUpperCase());
    const body = sheet.rows.map((r) =>
      sheet.columns.map((c) => {
        const v = c.value(r);
        return v === null || v === undefined ? "" : v;
      }),
    );

    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = autoWidths(header, body);
    ws["!freeze"] = { xSplit: "0", ySplit: "1" };
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(body.length, 1), c: header.length - 1 },
      }),
    };

    header.forEach((_, i) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[ref]) ws[ref].s = HEADER_STYLE;
    });

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(wb, fileName, { bookType: "xlsx", compression: true });
}

/** Hậu tố ngày cho tên file: 05_08_2026 */
export function fileDateSuffix(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}_${p(d.getMonth() + 1)}_${d.getFullYear()}`;
}
