// file: components/KanbanDrawer.tsx
"use client";

import type { Task } from "@/types";
import type React from "react";
import { X, Plus, FileText, Download, CalendarDays, MessageSquare, UploadCloud, Loader2 } from "lucide-react";

interface KanbanDrawerProps {
  isOpen: boolean;
  task: Task | null;
  columnTitle: string | null;
  onClose: () => void;
  onUpload: (files: FileList | null) => void;
  onOpenZip: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isDraggingOver: boolean;
  isUploading: boolean;
}

// A more robust shortening function for long filenames
const shorten = (name: string, maxLength = 35) => {
  if (name.length <= maxLength) return name;
  const extMatch = name.match(/\.[^./]+$/);
  const ext = extMatch ? extMatch[0] : "";
  const core = name.replace(ext, "");
  // Leave space for '...' and the extension
  const coreMaxLength = maxLength - ext.length - 3;
  if (coreMaxLength <= 5) return name; // Not worth shortening
  return `${core.slice(0, coreMaxLength)}...${ext}`;
};

export default function KanbanDrawer({
  isOpen,
  task,
  columnTitle,
  onClose,
  onUpload,
  onOpenZip,
  fileInputRef,
  isDraggingOver,
  isUploading,
}: KanbanDrawerProps) {
  // This is the "closed" state placeholder for the animation
  if (!task) {
    return (
      <aside className="fixed inset-y-0 right-0 w-[420px] translate-x-full pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" />
    );
  }

  const files = task.files || [];

  return (
    // MAIN CONTAINER: Glassy, with a stronger shadow for depth.
    <aside
      className={`fixed inset-y-0 right-0 w-[420px] bg-white/80 backdrop-blur-2xl border-l border-gray-200/80 
                 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 flex flex-col
                 ${isOpen ? "translate-x-0 shadow-2xl shadow-black/10" : "translate-x-full"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* HEADER: Cleaner typography, better spacing, and a more prominent close button. */}
      <div className="flex-shrink-0 px-6 pt-8 pb-6 flex items-start justify-between border-b border-black/5">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight truncate">
            {task.customerName}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-sm text-gray-600 truncate">{task.representative}</p>
            {columnTitle && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs font-medium text-gray-500 bg-gray-100/80 px-2.5 py-1 rounded-full border border-gray-200/80">
                  {columnTitle}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-4 flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-gray-500/10 hover:bg-gray-500/20 transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* CONTENT SCROLL AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* DETAILS SECTION: Structured like cards, with icons for scannability. */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60">
            <CalendarDays className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <div className="flex-1 flex justify-between items-center">
              <span className="text-sm text-gray-600">订单日期</span>
              <span className="text-sm font-semibold text-gray-800">{task.orderDate}</span>
            </div>
          </div>
          {task.notes && (
            <div className="flex items-start gap-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60">
              <MessageSquare className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm text-gray-600 block mb-1">备注</span>
                <p className="text-sm text-gray-800 leading-relaxed">{task.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* FILES SECTION: Modernized file list and upload area. */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">文件</h2>
            {/* FIX: Changed from files.length > 1 to files.length > 0 */}
            {files.length > 0 && (
              <button
                onClick={onOpenZip}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-600 hover:bg-gray-200/70 hover:text-gray-800 transition-all"
              >
                <Download className="h-4 w-4" />
                <span className="text-xs font-medium">打开</span>
              </button>
            )}
          </div>

          <div className="relative space-y-3">
            {isUploading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                 <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              </div>
            )}
            
            {files.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-200/80 shadow-sm"
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100/70 flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-800 truncate flex-1" title={name}>
                  {shorten(name)}
                </span>
              </div>
            ))}

            {/* UPLOAD AREA: Replaces dashed border with a more inviting, solid component. */}
            <label
              htmlFor="drawer-file-upload"
              className={`flex flex-col items-center justify-center p-6 cursor-pointer rounded-2xl transition-all duration-200
                          ${isDraggingOver
                            ? "bg-blue-50 border-blue-500 ring-4 ring-blue-500/20"
                            : "bg-gray-50/80 border border-gray-200/60 hover:border-gray-300"
                          }`}
            >
              <div className={`flex items-center justify-center h-12 w-12 rounded-full mb-3 transition-colors ${isDraggingOver ? 'bg-blue-100' : 'bg-gray-200/70'}`}>
                <UploadCloud className={`h-6 w-6 transition-colors ${isDraggingOver ? 'text-blue-600' : 'text-gray-500'}`} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">上传文件</p>
            </label>
            <input
              id="drawer-file-upload"
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
          </div>
        </div>
      </div>

      {/* FOOTER ACTION: Button style is now consistent with CreateJobForm */}
      <div className="flex-shrink-0 p-6 border-t border-black/5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          添加新文件
        </button>
      </div>
    </aside>
  );
}