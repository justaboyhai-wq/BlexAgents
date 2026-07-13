/**
 * Spreadsheet read-only viewer. Cells are rendered as React nodes rather than
 * serialized spreadsheet HTML: workbook hyperlinks are attacker-controlled
 * input, so raw HTML injection is unsafe.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { clampSheetRange } from './sheetMetrics';
import type { RichDocSubViewerProps } from './types';

const MAX_ROWS = 2000;
const MAX_COLS = 100;

interface SheetCell {
  text: string;
  href?: string;
}

interface SheetData {
  name: string;
  rows: SheetCell[][];
  truncated: boolean;
}

/** Only protocols that are safe to hand to the browser's link handler. */
export function safeSheetLink(target: unknown): string | undefined {
  if (typeof target !== 'string' || target.trim() === '') return undefined;
  try {
    const url = new URL(target);
    return url.protocol === 'https:' || url.protocol === 'mailto:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function buildSheetData(workbook: XLSX.WorkBook): SheetData[] {
  return workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const ref = ws['!ref'];
    if (!ref) return { name, rows: [], truncated: false };

    const clamped = clampSheetRange(XLSX.utils.decode_range(ref), MAX_ROWS, MAX_COLS);
    const rows: SheetCell[][] = [];
    for (let row = clamped.range.s.r; row <= clamped.range.e.r; row += 1) {
      const cells: SheetCell[] = [];
      for (let col = clamped.range.s.c; col <= clamped.range.e.c; col += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
        cells.push({
          text: cell == null ? '' : String(cell.w ?? cell.v ?? ''),
          href: safeSheetLink(cell?.l?.Target),
        });
      }
      rows.push(cells);
    }
    return { name, rows, truncated: clamped.truncated };
  });
}

export default function SheetViewer({ bytes, onError, onEmpty }: RichDocSubViewerProps) {
  const { t } = useTranslation('app');
  const parsed = useMemo<{ sheets: SheetData[] | null; error: string | null; empty: boolean }>(() => {
    try {
      const workbook = XLSX.read(new Uint8Array(bytes), {
        type: 'array',
        sheetRows: MAX_ROWS + 1,
        dense: true,
        cellFormula: false,
        cellHTML: false,
      });
      if (workbook.SheetNames.length === 0) return { sheets: null, error: null, empty: true };
      return { sheets: buildSheetData(workbook), error: null, empty: false };
    } catch (e) {
      return { sheets: null, error: e instanceof Error ? e.message : t('richDoc.sheetParseFailed'), empty: false };
    }
  }, [bytes, t]);

  const [active, setActive] = useState(0);
  useEffect(() => {
    if (parsed.error) onError(parsed.error);
    else if (parsed.empty) onEmpty();
  }, [parsed, onError, onEmpty]);

  const sheets = parsed.sheets;
  if (!sheets || sheets.length === 0) return null;
  const current = sheets[Math.min(active, sheets.length - 1)];

  return (
    <div className="flex h-full flex-col bg-[var(--paper-elevated)]">
      <div className="flex-1 overflow-auto overscroll-contain p-3">
        {current.truncated && (
          <div className="mb-2 rounded-[var(--radius-sm)] bg-[var(--paper-inset)] px-3 py-1.5 text-xs text-[var(--ink-muted)]">
            {t('richDoc.sheetTruncated', { rows: MAX_ROWS, cols: MAX_COLS })}
          </div>
        )}
        <table className="border-collapse text-sm text-[var(--ink)]">
          <tbody>
            {current.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="border border-[var(--line)] px-2 py-1 align-top">
                    {cell.href ? (
                      <a className="text-[var(--accent)] underline" href={cell.href} rel="noreferrer" target="_blank">
                        {cell.text}
                      </a>
                    ) : cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheets.length > 1 && (
        <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-t border-[var(--line)] bg-[var(--paper-elevated)] px-2 py-1.5">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActive(index)}
              className={`flex-shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors ${
                index === active ? 'bg-[var(--paper-inset)] text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
