import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildSheetData, safeSheetLink } from './SheetViewer';

describe('SheetViewer link safety', () => {
  it('renders a malicious workbook hyperlink as text, never a javascript link', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['owned']]);
    sheet.A1.l = { Target: 'javascript:alert(document.domain)' };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Unsafe');

    const cell = buildSheetData(workbook)[0].rows[0][0];
    expect(cell.text).toBe('owned');
    expect(cell.href).toBeUndefined();
  });

  it('accepts only https and mailto hyperlinks', () => {
    expect(safeSheetLink('https://example.com/report')).toBe('https://example.com/report');
    expect(safeSheetLink('mailto:security@example.com')).toBe('mailto:security@example.com');
    expect(safeSheetLink('data:text/html,boom')).toBeUndefined();
    expect(safeSheetLink('javascript:alert(1)')).toBeUndefined();
  });
});
