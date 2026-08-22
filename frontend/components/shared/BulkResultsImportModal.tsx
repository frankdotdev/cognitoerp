"use client";

/**
 * Historical results import — "the school should be able to upload all
 * past results scattered across Excel files." Same UX pattern as
 * BulkImportModal (students), pointed at /results/bulk-import, which
 * auto-detects wide vs. long spreadsheet format (see
 * results/bulk_import.py).
 */
import { useState, useRef } from "react";
import { Upload, X, FileSpreadsheet, Loader2 } from "lucide-react";

interface ImportResult {
  format_detected: string;
  total_rows: number;
  scores_recorded: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export function BulkResultsImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus("uploading");
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/results/bulk-import`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Import failed");
      }
      const data: ImportResult = await res.json();
      setResult(data);
      setStatus("done");
      if (data.scores_recorded > 0) onImported();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't process that file.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-surface-1 rounded-[14px] w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-[17px]">Import past results</h2>
          <button onClick={onClose} className="p-1 text-ink-300 hover:text-ink-900"><X size={18} /></button>
        </div>

        {status !== "done" && (
          <>
            <p className="text-[12.5px] text-ink-500 mb-4">
              Upload an Excel file of historical scores — one row per student, with a column per subject (like
              "Mathematics CA1", "Mathematics Exam"), or a simple Subject/Component/Score layout. Requires a grading
              scheme to already be set up.
            </p>

            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-[10px] py-8 flex flex-col items-center gap-2 hover:border-brand-500 transition-colors"
            >
              {file ? (
                <><FileSpreadsheet size={22} className="text-brand-600" /><span className="text-[12.5px] font-medium">{file.name}</span></>
              ) : (
                <><Upload size={22} className="text-ink-300" /><span className="text-[12.5px] text-ink-500">Click to choose a file</span></>
              )}
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

            {errorMsg && <p className="text-[12.5px] text-danger mt-3">{errorMsg}</p>}

            <button
              onClick={handleUpload}
              disabled={!file || status === "uploading"}
              className="w-full mt-5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-[13.5px] font-medium py-2.5 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {status === "uploading" && <Loader2 size={14} className="animate-spin" />}
              {status === "uploading" ? "Importing…" : "Import results"}
            </button>
          </>
        )}

        {status === "done" && result && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-brand-50 rounded-[10px] p-3 text-center">
                <div className="font-heading font-bold text-[20px] text-brand-700">{result.scores_recorded}</div>
                <div className="text-[11px] text-brand-700">Scores recorded</div>
              </div>
              <div className={`rounded-[10px] p-3 text-center ${result.skipped > 0 ? "bg-warning-bg" : "bg-surface-0"}`}>
                <div className={`font-heading font-bold text-[20px] ${result.skipped > 0 ? "text-warning" : "text-ink-500"}`}>{result.skipped}</div>
                <div className={`text-[11px] ${result.skipped > 0 ? "text-warning" : "text-ink-500"}`}>Skipped</div>
              </div>
            </div>
            <p className="text-[11px] text-ink-300 mb-3">Detected format: {result.format_detected}</p>
            {result.errors.length > 0 && (
              <div className="mb-4">
                <p className="text-[11.5px] font-medium text-ink-700 mb-2">Rows to fix:</p>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-[11.5px] text-ink-500 bg-surface-0 rounded px-2.5 py-1.5">Row {e.row}: {e.reason}</div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onClose} className="w-full bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium py-2.5 rounded-md">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
