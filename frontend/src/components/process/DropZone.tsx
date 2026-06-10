"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.heic,.heif,.bmp,.tiff,.webp";

export default function DropZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setSelected(file);
    onFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function clear() {
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />

      {selected ? (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
          <FileText className="w-8 h-8 text-violet-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{selected.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{(selected.size / 1024).toFixed(1)} KB</p>
          </div>
          {!disabled && (
            <button onClick={clear} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "w-full border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 transition-colors",
            dragging
              ? "border-violet-400 bg-violet-50"
              : "border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="p-3 bg-violet-100 rounded-xl border border-violet-200">
            <Upload className="w-6 h-6 text-violet-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Drop invoice here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG, HEIC, TIFF, WebP</p>
          </div>
        </button>
      )}
    </div>
  );
}
