"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, FileText, X } from "lucide-react";
import type { Task } from "@/types";

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSelect: (task: Task) => void;
}

interface SearchResult {
  task: Task;
  columnTitle: string;
}

export default function SearchDialog({ isOpen, onClose, onTaskSelect }: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure component is mounted on the client before using portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Clear search state whenever the dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setResults([]);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Focus input and add Escape key listener when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      document.addEventListener("keydown", handleKeyDown);

      // Cleanup listener
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Fetch results from the backend
  useEffect(() => {
    if (!isOpen) return;

    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data: SearchResult[]) => setResults(data))
        .catch((error) => {
          console.error("Failed to fetch search results:", error);
          setResults([]);
        })
        .finally(() => setIsLoading(false));
    }, 900);

    return () => clearTimeout(handler);
  }, [searchQuery, isOpen]);

  const handleSelectTask = (task: Task) => {
    onClose();
    onTaskSelect(task);
  };

  if (!isOpen || !isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex justify-center items-start"
      onClick={onClose}
    >
      <div
        className="w-[95vw] max-w-2xl mt-[20vh] bg-white/75 backdrop-blur-2xl border border-gray-200/80 
                   rounded-2xl shadow-2xl flex flex-col overflow-hidden
                   animate-in fade-in-0 zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-4 p-4 border-b border-black/10">
          <Search className="h-5 w-5 text-gray-500 flex-shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            placeholder="按任意信息搜索任务..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-lg text-gray-800 placeholder:text-gray-500 focus:outline-none"
          />
          {isLoading && <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-black/10 transition-colors"
            aria-label="关闭搜索"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-2 min-h-[200px] max-h-[60vh] overflow-y-auto">
          {searchQuery.trim() === "" && (
            <div className="flex flex-col items-center justify-center text-center p-12 text-gray-500 h-full">
              <Search className="h-10 w-10 mb-4" strokeWidth={1} />
              <p className="text-sm font-medium text-gray-700">快速查找任意任务</p>
            </div>
          )}

          {searchQuery.trim() !== "" && !isLoading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-12 text-gray-500 h-full">
              <FileText className="h-10 w-10 mb-4" strokeWidth={1} />
              <p className="text-sm font-medium text-gray-700">未找到结果</p>
              <p className="text-xs text-gray-500 mt-1">请尝试其他搜索词</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map(({ task, columnTitle }) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors hover:bg-black/5"
                  onClick={() => handleSelectTask(task)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectTask(task)}
                >
                  <div className="flex-shrink-0 bg-black/5 p-2 rounded-md">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">
                      {`${task.customerName} - ${task.representative}`}
                    </h3>
                    <p className="text-xs text-gray-600">{task.orderDate}</p>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-xs text-gray-700 bg-gray-200/80 px-2 py-1 rounded-full border border-gray-300/50">
                    {columnTitle}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}