"use client";

/**
 * The single table component used across the whole product — Students,
 * Teachers, Invoices, Attendance history, everything. Built once here so
 * sorting/pagination/empty-states/loading-states behave identically
 * everywhere, instead of every screen reinventing its own table and
 * drifting out of sync over time.
 */
import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  emptyMessage = "Nothing here yet.",
  onRowClick,
  sortBy,
  sortDir,
  onSortChange,
  page,
  pageSize,
  totalCount,
  onPageChange,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="rounded-[10px] border border-border bg-surface-1 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-0">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && onSortChange?.(col.key)}
                className={`text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap ${
                  col.sortable ? "cursor-pointer select-none hover:text-ink-900" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortBy === col.key && (
                    <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-300">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-300">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border-soft last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-surface-0" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink-900 whitespace-nowrap">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      {totalCount > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[12.5px] text-ink-500">
          <span>
            Page {page} of {totalPages} · {totalCount} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:border-ink-500"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:border-ink-500"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
