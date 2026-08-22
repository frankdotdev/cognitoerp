"use client";

/**
 * Generic photo uploader for any entity with its own upload-url/confirm
 * endpoints (students, teachers) — same two-step presigned-R2 flow as
 * AssetUploader, but parameterized by endpoint path instead of hardcoded
 * to school branding assets. AssetUploader stays as-is for logo/stamp/
 * signature (school-level, not entity-level); this is the entity-level
 * counterpart, built specifically to avoid reusing AssetUploader against
 * the wrong API path.
 */
import { useState, useRef } from "react";
import { Upload, Check, Loader2, User } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface EntityPhotoUploaderProps {
  uploadUrlEndpoint: string;   // e.g. `/students/${id}/photo/upload-url`
  confirmEndpoint: string;     // e.g. `/students/${id}/photo/confirm`
  currentPhotoUrl?: string | null;
  onUploaded: (previewUrl: string) => void;
}

export function EntityPhotoUploader({ uploadUrlEndpoint, confirmEndpoint, currentPhotoUrl, onUploaded }: EntityPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl ?? null);

  async function handleFileSelected(file: File) {
    setStatus("uploading");
    try {
      const { upload_url, object_key } = await apiClient.post<{ upload_url: string; object_key: string }>(
        uploadUrlEndpoint, { filename: file.name, content_type: file.type }
      );

      const uploadRes = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Upload to storage failed");

      await apiClient.post(confirmEndpoint, { object_key });

      // The photo is stored as an R2 object key, not a public URL — the
      // confirm endpoint returns the updated entity, not a signed preview
      // URL, so for immediate display we optimistically show the raw
      // uploaded file via a local object URL rather than waiting on a
      // fresh signed-URL round trip.
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      setStatus("done");
      onUploaded(localPreview);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 h-16 rounded-full border border-border bg-surface-0 flex items-center justify-center overflow-hidden shrink-0">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Photo" className="w-full h-full object-cover" />
        ) : (
          <User size={22} className="text-ink-300" />
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
        {status === "idle" && <Upload size={14} />}
        {status === "uploading" ? "Uploading…" : status === "done" ? "Photo updated" : "Upload photo"}
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
      {status === "error" && <p className="text-[11.5px] text-danger">Upload failed — try again.</p>}
    </div>
  );
}
