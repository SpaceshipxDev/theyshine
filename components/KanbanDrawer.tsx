"use client";

import type { Task } from "@/types";
import type React from "react";
import { useState, useRef, useCallback } from "react";
import { X, FileText, Download, CalendarDays, MessageSquare, Plus, Loader2, Trash2 } from "lucide-react";

interface KanbanDrawerProps {
  isOpen: boolean;
  task: Task | null;
  columnTitle: string | null;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
}

const truncateFilename = (name: string, maxLength = 25) => {
  if (name.length <= maxLength) return name;
  const extMatch = name.match(/\.[^./]+$/);
  const ext = extMatch ? extMatch[0] : "";
  const core = name.replace(ext, "");
  const coreMaxLength = maxLength - ext.length - 1;
  if (coreMaxLength <= 3) return name;
  return `${core.slice(0, coreMaxLength)}…${ext}`;
};

export default function KanbanDrawer({
  isOpen,
  task,
  columnTitle,
  onClose,
  onTaskUpdated,
}: KanbanDrawerProps) {
  // --- Internal state for API calls and UI feedback ---
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [updatingFile, setUpdatingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null); // New state for delete

  // --- Internal refs for file inputs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  const fileToUpdateRef = useRef<string | null>(null);

  // --- API Call: Upload new files ---
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!task || !files || files.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      const res = await fetch(`/api/jobs/${task.id}/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("File upload failed");
      const updatedTask = await res.json();
      onTaskUpdated(updatedTask);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  }, [task, onTaskUpdated]);

  // --- API Call: Update a single existing file ---
  const handleFileUpdate = useCallback(async (newFile: File, oldFilename: string) => {
    if (!task) return;
    setUpdatingFile(oldFilename);
    const formData = new FormData();
    formData.append("newFile", newFile);
    formData.append("oldFilename", oldFilename);
    try {
      const res = await fetch(`/api/jobs/${task.id}/update-file`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.json().then(e => e.error || "File update failed"));
      const updatedTask = await res.json();
      onTaskUpdated(updatedTask);
    } catch (error) {
      console.error("Update failed:", error);
    } finally {
      setUpdatingFile(null);
    }
  }, [task, onTaskUpdated]);

  // --- NEW API Call: Delete a single file ---
  const handleFileDelete = useCallback(async (filename: string) => {
    if (!task) return;
    
    // Confirmation prompt
    const isConfirmed = window.confirm(`你确定要删除文件 "${filename}" 吗？此操作无法撤销。`);
    if (!isConfirmed) return;

    setDeletingFile(filename);
    try {
      const res = await fetch(`/api/jobs/${task.id}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) throw new Error(await res.json().then(e => e.error || "File deletion failed"));
      const updatedTask = await res.json();
      onTaskUpdated(updatedTask);
    } catch (error) {
      console.error("Deletion failed:", error);
    } finally {
      setDeletingFile(null);
    }
  }, [task, onTaskUpdated]);

  // --- API Call: Download all files as a zip ---
  const handleDownloadZip = useCallback(async () => {
    if (!task || isZipping) return;
    setIsZipping(true);
    try {
      const res = await fetch(`/api/jobs/${task.id}/zip`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `压缩包-${task.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsZipping(false);
    }
  }, [task, isZipping]);

  // --- UI Handlers ---
  const handleUpdateClick = (filename: string) => {
    fileToUpdateRef.current = filename;
    updateFileInputRef.current?.click();
  };

  const handleFileUpdateSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    const oldFilename = fileToUpdateRef.current;
    if (newFile && oldFilename) {
      handleFileUpdate(newFile, oldFilename);
    }
    if (e.target) e.target.value = "";
  };
  
  if (!task) {
    return (
      <aside className="fixed inset-y-0 right-0 w-[400px] translate-x-full pointer-events-none transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]" />
    );
  }
  
  const files = task.files || [];

  return (
    <aside
      className={`fixed inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl border-l border-black/[0.08] 
                 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 flex flex-col
                 ${isOpen ? "translate-x-0 shadow-[0_8px_64px_0_rgba(0,0,0,0.25)]" : "translate-x-full"}`}
      onClick={(e) => e.stopPropagation()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
        handleFileUpload(e.dataTransfer.files);
      }}
    >
      <div className="flex-shrink-0 px-6 pt-6 pb-0 flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <h1 className="text-xl font-semibold text-black tracking-tight truncate -mb-0.5">{task.customerName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[15px] text-black/60 truncate">{task.representative}</p>
            {columnTitle && (
              <>
                <span className="text-black/30 text-sm">·</span>
                <span className="text-[13px] font-medium text-black/50 bg-black/5 px-2 py-0.5 rounded-full">{columnTitle}</span>
              </>
            )}
          </div>
        </div>
        <button onClick={onClose} className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors duration-200">
          <X className="h-4 w-4 text-black/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between py-3 border-b border-black/[0.08]">
            <div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-black/40" /><span className="text-[15px] text-black/60">订单日期</span></div>
            <span className="text-[15px] font-medium text-black">{task.orderDate}</span>
          </div>
          {task.notes && (
            <div className="py-3 border-b border-black/[0.08]">
              <div className="flex items-center gap-3 mb-2"><MessageSquare className="h-4 w-4 text-black/40" /><span className="text-[15px] text-black/60">备注</span></div>
              <p className="text-[15px] text-black leading-relaxed ml-7">{task.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-[17px] font-medium text-black">项目文件</h3>
          
          {files.length > 0 && (
            <div className="bg-black/[0.02] rounded-2xl p-4 space-y-2">
              {files.map((name) => (
                <div key={name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/[0.04] transition-colors duration-150 group">
                  <FileText className="h-4 w-4 text-black/40 flex-shrink-0" />
                  <span className="text-[14px] text-black/70 truncate flex-1" title={name}>{truncateFilename(name)}</span>
                  <div className="flex items-center justify-end gap-2 w-24 opacity-0 group-hover:opacity-100 transition-opacity">
                    {updatingFile === name || deletingFile === name ? (
                      <Loader2 className="h-4 w-4 animate-spin text-black/50" />
                    ) : (
                      <>
                        <button onClick={() => handleUpdateClick(name)} className="text-[13px] font-medium text-blue-600 hover:text-blue-500">更新</button>
                        <button onClick={() => handleFileDelete(name)} className="text-[13px] font-medium text-red-600 hover:text-red-500">删除</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons... */}
          <div className="space-y-3">
            {files.length > 0 && (
              <button onClick={handleDownloadZip} disabled={isZipping} className="w-full flex items-center gap-4 p-4 bg-blue-500/8 hover:bg-blue-500/12 rounded-2xl transition-all duration-200 group disabled:opacity-50 disabled:cursor-wait">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500/15 group-hover:bg-blue-500/20 transition-colors duration-200">
                  {isZipping ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> : <Download className="h-5 w-5 text-blue-600" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-medium text-black">下载所有文件</p>
                  <p className="text-[13px] text-black/50">{isZipping ? '正在压缩...' : '获取压缩包进行本地处理'}</p>
                </div>
              </button>
            )}

            <div className="relative">
              {isUploading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                  <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 text-black/60 animate-spin" /><span className="text-[15px] text-black/60">上传中...</span></div>
                </div>
              )}
              <label htmlFor="drawer-file-upload" className={`block w-full p-5 cursor-pointer rounded-2xl transition-all duration-200 border-2 border-dashed group ${
                isDraggingOver ? "bg-green-50/80 border-green-400/60 ring-4 ring-green-500/10" : files.length > 0 ? "bg-black/[0.02] border-black/10 hover:bg-black/[0.04] hover:border-black/20" : "bg-blue-50/50 border-blue-200/60 hover:bg-blue-50/80 hover:border-blue-300/80"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-full transition-colors duration-200 ${
                    isDraggingOver ? 'bg-green-500/15' : files.length > 0 ? 'bg-black/8 group-hover:bg-black/12' : 'bg-blue-500/15 group-hover:bg-blue-500/20'
                  }`}>
                    <Plus className={`h-5 w-5 transition-colors duration-200 ${
                      isDraggingOver ? 'text-green-600' : files.length > 0 ? 'text-black/60' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] font-medium text-black">{files.length === 0 ? "上传项目文件" : "上传更新文件"}</p>
                    <p className="text-[13px] text-black/50">{files.length === 0 ? "拖放文件或点击选择" : "添加修改后的文件或新内容"}</p>
                  </div>
                </div>
              </label>
              <input id="drawer-file-upload" type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
            </div>
          </div>
        </div>
      </div>
      <input type="file" ref={updateFileInputRef} className="hidden" onChange={handleFileUpdateSelected} />
    </aside>
  );
}