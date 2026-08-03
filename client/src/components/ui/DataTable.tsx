import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Tailwind width/alignment classes, applied to header and cell. */
  className?: string;
  /** Hide this column from the mobile card view (e.g. redundant metadata). */
  hideOnCard?: boolean;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Column key used as the card title on mobile. Defaults to the first column. */
  cardTitleKey?: string;
}

/**
 * One column definition, two layouts: a table from `sm` up, stacked cards below —
 * a table with five columns is unreadable on a 375px screen.
 */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, cardTitleKey }: Props<T>) {
  const titleKey = cardTitleKey ?? columns[0]?.key;
  const titleColumn = columns.find((c) => c.key === titleKey);
  const detailColumns = columns.filter((c) => c.key !== titleKey && !c.hideOnCard);

  return (
    <>
      {/* Table — sm and up */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-5 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-slate-100 last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-slate-50" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-3 text-sm ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — below sm */}
      <ul className="divide-y divide-slate-100 sm:hidden">
        {rows.map((row) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm font-medium text-slate-900">{titleColumn?.render(row)}</div>
              </div>
              <dl className="mt-2 space-y-1.5">
                {detailColumns.map((col) => (
                  <div key={col.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-xs text-slate-500">{col.header}</dt>
                    <dd className="min-w-0 text-right text-sm text-slate-700">{col.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );

          return (
            <li key={rowKey(row)}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="w-full cursor-pointer px-4 py-3.5 text-left hover:bg-slate-50"
                >
                  {content}
                </button>
              ) : (
                <div className="px-4 py-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
