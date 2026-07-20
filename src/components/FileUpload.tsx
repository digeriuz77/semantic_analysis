"use client";

import { useState, useCallback } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const validateAndAddFiles = useCallback((files: File[]) => {
    const validTypes = [
      "text/plain",
      "application/pdf",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const validFiles = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const isValidExt = ["txt", "pdf", "csv", "docx"].includes(ext || "");
      return isValidExt || validTypes.includes(f.type);
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  }, [validateAndAddFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
          dragActive
            ? "border-teal-500 bg-teal-500/10 scale-105"
            : "border-slate-700 hover:border-slate-500 bg-slate-900/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".txt,.pdf,.csv,.docx"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center gap-4 pointer-events-none">
          <div className="p-4 bg-navy-800 rounded-full">
            <UploadCloud size={32} className="text-teal-400" />
          </div>
          <div>
            <p className="text-xl font-semibold text-white">
              Drop your documents here
            </p>
            <p className="text-slate-400 mt-2 text-sm">
              Supports .txt, .pdf, .csv, .docx
            </p>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-white mb-4">Selected Files ({selectedFiles.length})</h3>
          <div className="space-y-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-teal-400" />
                  <span className="text-slate-200 text-sm truncate max-w-[300px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 hover:bg-red-500/20 rounded-full transition-colors text-slate-400 hover:text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            className="mt-6 w-full py-3 px-4 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Analysis
          </button>
        </div>
      )}
    </div>
  );
}