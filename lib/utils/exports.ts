/**
 * Export utilities for the Income Statement (P&L).
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Provides CSV and PDF (HTML) generation from IncomeStatementData.
 * All amounts formatted as MYR with 2 decimal places.
 */

import type {
  IncomeStatementData,
  IncomeSource,
  ExpenseCategory,
  ExpenseSubcategory,
} from '@/lib/actions/incomeStatement'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Format an integer minor-unit amount as MYR display string.
 * @example 800000 → "RM 8,000.00"
 */
function fmtMYR(minor: number): string {
  const absMinor = Math.abs(minor)
  const ringgit = (absMinor / 100).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sign = minor < 0 ? '-' : ''
  return `RM ${sign}${ringgit}`
}

/**
 * Escape a string value for safe CSV output.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value)
  if (!needsQuotes) return value
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Format a Date as a readable string for PDF headers.
 */
function fmtDateLong(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

// ----------------------------------------------------------------------------
// CSV Export
// ----------------------------------------------------------------------------

/**
 * Generate a CSV string from P&L data.
 *
 * Columns: Type, Category, Subcategory, Source, Description, Amount (MYR), Currency, MYR Equiv
 *
 * @param data — the income statement data from getIncomeStatement()
 * @returns RFC-4180 compliant CSV string with UTF-8 BOM
 */
export function generateIncomeStatementCSV(data: IncomeStatementData): string {
  const rows: string[] = []

  // BOM for Excel
  rows.push('\uFEFF')

  // Header
  rows.push(
    [
      'Type',
      'Category',
      'Subcategory',
      'Source',
      'Description',
      'Amount (MYR)',
      'Currency',
      'MYR Equiv',
    ]
      .map(csvEscape)
      .join(',')
  )

  // Meta row
  rows.push(
    [
      'META',
      `Period: ${data.periodLabel}`,
      `Entity: ${data.entityName}`,
      '',
      `Range: ${data.dateFrom} to ${data.dateTo}`,
      '',
      '',
      '',
    ]
      .map(csvEscape)
      .join(',')
  )

  // Blank separator
  rows.push('')

  // Income rows
  for (const src of data.income.sources) {
    rows.push(
      [
        'Income',
        'Income',
        '',
        csvEscape(src.vendor),
        csvEscape(src.description),
        (src.amountMinor / 100).toFixed(2),
        'MYR',
        (src.amountMinor / 100).toFixed(2),
      ].join(',')
    )
  }

  // Income total
  rows.push(
    [
      'Income',
      'TOTAL INCOME',
      '',
      '',
      '',
      (data.income.totalMinor / 100).toFixed(2),
      'MYR',
      (data.income.totalMinor / 100).toFixed(2),
    ].join(',')
  )

  // Blank
  rows.push('')

  // Expense rows
  for (const cat of data.expenses.byCategory) {
    // Category header row
    rows.push(
      [
        'Expense',
        csvEscape(cat.category),
        '',
        '',
        '',
        (cat.totalMinor / 100).toFixed(2),
        'MYR',
        (cat.totalMinor / 100).toFixed(2),
      ].join(',')
    )

    // Subcategory rows
    for (const sub of cat.subcategories) {
      rows.push(
        [
          'Expense',
          csvEscape(cat.category),
          csvEscape(sub.subcategory),
          '',
          '',
          (sub.amountMinor / 100).toFixed(2),
          'MYR',
          (sub.amountMinor / 100).toFixed(2),
        ].join(',')
      )
    }
  }

  // Expense total
  rows.push(
    [
      'Expense',
      'TOTAL EXPENSES',
      '',
      '',
      '',
      (data.expenses.totalMinor / 100).toFixed(2),
      'MYR',
      (data.expenses.totalMinor / 100).toFixed(2),
    ].join(',')
  )

  // Blank
  rows.push('')

  // Net profit
  const netLabel = data.netProfitMinor >= 0 ? 'NET PROFIT' : 'NET LOSS'
  rows.push(
    [
      netLabel,
      '',
      '',
      '',
      '',
      (Math.abs(data.netProfitMinor) / 100).toFixed(2),
      'MYR',
      (Math.abs(data.netProfitMinor) / 100).toFixed(2),
    ].join(',')
  )

  // Receivables note
  if (data.outstandingReceivablesMinor > 0) {
    rows.push('')
    rows.push(
      [
        'NOTE',
        `Outstanding receivables: ${fmtMYR(data.outstandingReceivablesMinor)} across ${data.outstandingProjectCount} active project${data.outstandingProjectCount === 1 ? '' : 's'}.`,
        '',
        '',
        '',
        '',
        '',
        '',
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  return rows.join('\n')
}

// ----------------------------------------------------------------------------
// PDF Export (print-ready HTML)
// ----------------------------------------------------------------------------

/**
 * Generate a print-ready HTML string from P&L data.
 * Designed for headless Chromium PDF generation.
 *
 * @param data — the income statement data from getIncomeStatement()
 * @returns HTML string styled for A4 print output
 */
export function generateIncomeStatementPDF(data: IncomeStatementData): string {
  const netLabel = data.netProfitMinor >= 0 ? 'NET PROFIT' : 'NET LOSS'
  const netColor = data.netProfitMinor >= 0 ? '#1F8A4C' : '#B43A2D'

  const incomeRowsHTML = data.income.sources
    .map(
      (src: IncomeSource) => `
        <tr class="income-row">
          <td class="col-label">${escapeHtml(src.vendor)}</td>
          <td class="col-desc">${escapeHtml(src.description)}</td>
          <td class="col-amount income-color">${escapeHtml(fmtMYR(src.amountMinor))}</td>
        </tr>`
    )
    .join('')

  const expenseCategoriesHTML = data.expenses.byCategory
    .map((cat: ExpenseCategory) => {
      const subRowsHTML = cat.subcategories
        .map(
          (sub: ExpenseSubcategory) => `
            <tr class="subcategory-row">
              <td class="col-label subcategory-label">${escapeHtml(sub.subcategory)}</td>
              <td class="col-desc"></td>
              <td class="col-amount">${escapeHtml(fmtMYR(sub.amountMinor))}</td>
            </tr>`
        )
        .join('')

      return `
        <tr class="category-header">
          <td class="col-label category-label">${escapeHtml(cat.category)}</td>
          <td class="col-desc"></td>
          <td class="col-amount category-total">${escapeHtml(fmtMYR(cat.totalMinor))}</td>
        </tr>
        ${subRowsHTML}
      `
    })
    .join('')

  const receivablesNoteHTML =
    data.outstandingReceivablesMinor > 0
      ? `<p class="receivables-note">
          Outstanding receivables not yet recognized: ${escapeHtml(fmtMYR(data.outstandingReceivablesMinor))}
          across ${data.outstandingProjectCount} active project${data.outstandingProjectCount === 1 ? '' : 's'}.
         </p>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Income Statement — ${escapeHtml(data.periodLabel)}</title>
  <style>
    @page { size: A4; margin: 24mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11pt;
      color: #181818;
      line-height: 1.5;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 24pt;
      padding-bottom: 12pt;
      border-bottom: 1px solid #E5E5E5;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 4pt;
    }
    .header .subtitle {
      font-size: 10pt;
      color: #6B6B6B;
    }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 18pt;
      margin-bottom: 8pt;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .section-title .section-total {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-weight: 700;
      font-size: 12pt;
    }
    .section-title.income .section-total { color: #1F8A4C; }
    .section-title.expense .section-total { color: #181818; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 3pt 0; vertical-align: baseline; }
    .col-label { width: 38%; text-align: left; }
    .col-desc  { width: 42%; text-align: left; color: #6B6B6B; font-size: 9pt; }
    .col-amount { width: 20%; text-align: right; font-family: 'JetBrains Mono', 'Courier New', monospace; }
    .income-row .col-label { padding-left: 0; }
    .income-row .col-amount { color: #1F8A4C; }
    .category-header .col-label { font-weight: 700; }
    .category-header .col-amount { font-weight: 700; }
    .subcategory-row .col-label { padding-left: 16px; color: #6B6B6B; }
    .subcategory-row .col-amount { color: #6B6B6B; }
    .income-color { color: #1F8A4C; }
    .total-row { border-top: 1px solid #E5E5E5; margin-top: 4pt; }
    .total-row td { padding-top: 6pt; font-weight: 700; }
    .net-profit-section {
      margin-top: 24pt;
      padding-top: 12pt;
      border-top: 2px solid #181818;
    }
    .net-profit-section .net-label {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .net-profit-section .net-amount {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 16pt;
      font-weight: 700;
    }
    .receivables-note {
      margin-top: 18pt;
      font-size: 9pt;
      font-style: italic;
      color: #A0A0A0;
      text-align: center;
    }
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8pt;
      color: #A0A0A0;
      padding-top: 8pt;
      border-top: 1px solid #E5E5E5;
    }
    @media print {
      .page-footer { position: fixed; bottom: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Income Statement</h1>
    <p class="subtitle">
      ${escapeHtml(data.periodLabel)} &mdash; ${escapeHtml(data.entityName)}
      <br>
      ${fmtDateLong(data.dateFrom)} &ndash; ${fmtDateLong(data.dateTo)}
    </p>
  </div>

  <!-- Income Section -->
  <div class="section-title income">
    <span>Income</span>
    <span class="section-total">${escapeHtml(fmtMYR(data.income.totalMinor))}</span>
  </div>
  <table>
    <tbody>
      ${incomeRowsHTML}
    </tbody>
  </table>

  <!-- Expenses Section -->
  <div class="section-title expense">
    <span>Expenses</span>
    <span class="section-total">${escapeHtml(fmtMYR(data.expenses.totalMinor))}</span>
  </div>
  <table>
    <tbody>
      ${expenseCategoriesHTML}
      <tr class="total-row">
        <td class="col-label">Total Expenses</td>
        <td class="col-desc"></td>
        <td class="col-amount">${escapeHtml(fmtMYR(data.expenses.totalMinor))}</td>
      </tr>
    </tbody>
  </table>

  <!-- Net Profit -->
  <div class="net-profit-section">
    <table>
      <tr>
        <td class="col-label net-label">${netLabel}</td>
        <td class="col-desc"></td>
        <td class="col-amount net-amount" style="color: ${netColor};">${escapeHtml(fmtMYR(Math.abs(data.netProfitMinor)))}</td>
      </tr>
    </table>
  </div>

  ${receivablesNoteHTML}

  <div class="page-footer">
    Generated by JK Zentra Finance Cockpit &middot; Cash Basis
  </div>
</body>
</html>`
}

// ----------------------------------------------------------------------------
// HTML escape helper
// ----------------------------------------------------------------------------

/**
 * Escape special HTML characters to prevent XSS in PDF HTML.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
