"use client";

/**
 * Reusable upload control for school branding assets (logo, stamp,
 * signature, favicon) — implements the two-step flow from
 * schools/storage_router.py exactly:
 *   1. POST /schools/me/assets/upload-url -> presigned R2 PUT URL
 *   2. PUT the file bytes directly to R2 (never through our backend)
 *   3. POST /schools/me/assets/confirm -> saves the object_key on the theme
 */
import { useState, useRef } from "react";
import { Upload, Check, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface AssetUploaderProps {
  category: "logos" | "favicons" | "stamps" | "signatures";
  label: string;
  currentPreviewUrl?: string | null;
  onUploaded: (previewUrl: string) => void;
}

export function AssetUploader({ category, label, currentPreviewUrl, onUploaded }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [preview, setPreview] = useState<string | null>(currentPreviewUrl ?? null);

  async function handleFileSelected(file: File) {
    setStatus("uploading");
    try {
      const { upload_url, object_key } = await apiClient.post<{ upload_url: string; object_key: string }>(
        "/schools/me/assets/upload-url",
        { category, filename: file.name, content_type: file.type }
      );

      // Direct-to-R2 upload — deliberately not going through apiClient,
      // since this needs a raw PUT with the file body, not JSON.
      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload to storage failed");

      const confirmed = await apiClient.post<{ preview_url: string }>("/schools/me/assets/confirm", {
        category,
        object_key,
      });

      setPreview(confirmed.preview_url);
      setStatus("done");
      onUploaded(confirmed.preview_url);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <label className="block text-[12.5px] font-medium text-ink-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-md border border-border bg-surface-0 flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="w-full h-full object-contain" />
          ) : (
            <Upload size={18} className="text-ink-300" />
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-border text-[13px] font-medium hover:border-brand-500 disabled:opacity-60"
        >
          {status === "uploading" && <Loader2 size={14} className="animate-spin" />}
          {status === "done" && <Check size={14} className="text-brand-600" />}
          {status === "uploading" ? "Uploading…" : status === "done" ? "Uploaded" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />
      </div>
      {status === "error" && <p className="text-[11.5px] text-danger mt-1.5">Upload failed — try again.</p>}
    </div>
  );
}
