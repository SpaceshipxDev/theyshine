// file: app/page.tsx (or wherever KanbanBoard is)
"use client"

// ... (all other imports and state remain the same)
import type React from "react"
import type { Task, Column, BoardData } from "@/types"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import CreateJobForm from "@/components/CreateJobForm"
import { Card } from "@/components/ui/card"
import { Archive, Search } from "lucide-react"
import { baseColumns, START_COLUMN_ID } from "@/lib/baseColumns"
import KanbanDrawer from "@/components/KanbanDrawer"
import SearchDialog from "@/components/SearchDialog"


export default function KanbanBoard() {
  // ... (all state and functions remain exactly the same up to the return statement)
  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [columns, setColumns] = useState<Column[]>(baseColumns)

  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // This function ensures the UI always has the full set of columns from code,
  // merged with the saved data (taskIds).
  const mergeWithSkeleton = (saved: Column[]): Column[] => {
    const savedColumnsMap = new Map(saved.map((c) => [c.id, c]));
    return baseColumns.map(
      (baseCol) => savedColumnsMap.get(baseCol.id) || baseCol
    );
  };

  const saveBoard = async (nextBoard: BoardData) => {
    try {
      await fetch("/api/jobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextBoard),
      });
    } catch (err) {
      console.error("保存看板失败", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs");
        if (res.ok) {
          const data: BoardData = await res.json();
          setTasks(data.tasks || {});
          setColumns(mergeWithSkeleton(data.columns || []));
        }
      } catch (e) {
        console.warn("metadata.json 不存在或无效，已重置");
        setTasks({});
        setColumns(baseColumns);
      }
    })();
  }, []);

  const updateTaskInState = useCallback((updatedTask: Task) => {
    // Updates are simpler: just update the task in the tasks dictionary
    setTasks((prev) => ({
      ...prev,
      [updatedTask.id]: updatedTask,
    }));
    setSelectedTask(updatedTask);
  }, []);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnter = (columnId: string) => setDragOverColumn(columnId);
  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTask || draggedTask.columnId === targetColumnId) return;

    // --- NEW LOGIC FOR FLAT DATA ---
    // 1. Update the task's columnId in the tasks dictionary
    const nextTasks = {
      ...tasks,
      [draggedTask.id]: { ...draggedTask, columnId: targetColumnId },
    };

    // 2. Update the columns' taskIds arrays
    const nextColumns = columns.map((col) => {
      // Remove from the original column's taskIds
      if (col.id === draggedTask.columnId) {
        return {
          ...col,
          taskIds: col.taskIds.filter((id) => id !== draggedTask.id),
        };
      }
      // Add to the new target column's taskIds
      if (col.id === targetColumnId) {
        return { ...col, taskIds: [...col.taskIds, draggedTask.id] };
      }
      return col;
    });

    // 3. Update local state for an instant UI change
    setTasks(nextTasks);
    setColumns(nextColumns);

    // 4. Persist the changes to the backend
    saveBoard({ tasks: nextTasks, columns: nextColumns });

    setDraggedTask(null);
  };

  const handleJobCreated = (newTask: Task) => {
    // Add the new task to the central tasks dictionary
    setTasks((prev) => ({ ...prev, [newTask.id]: newTask }));

    // Add the new task's ID to the starting column's taskIds array
    setColumns((prev) =>
      prev.map((col) =>
        col.id === START_COLUMN_ID
          ? { ...col, taskIds: [...col.taskIds, newTask.id] }
          : col,
      ),
    );
  };

  // The task click handler is now simpler, as the task object itself has all the info
  const handleTaskClick = (task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (task.columnId === "archive") return;

    const column = columns.find((c) => c.id === task.columnId);
    setSelectedTaskColumnTitle(column ? column.title : null);
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      setSelectedTask(null);
      setSelectedTaskColumnTitle(null);
      setIsUploading(false);
      setIsZipping(false);
      setIsDraggingOver(false);
    }, 300);
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const mockEvent = {
      dataTransfer: { files },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.DragEvent;
    handleFileDrop(mockEvent);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (!selectedTask || isUploading) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      setIsUploading(true);
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      try {
        const res = await fetch(`/api/jobs/${selectedTask.id}/upload`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("文件上传失败");
        const updatedTask = await res.json();
        updateTaskInState(updatedTask); // This will update the task in the main 'tasks' state
      } catch (error) {
        console.error("上传失败:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [selectedTask, isUploading, updateTaskInState],
  );

  const handleDownloadZip = useCallback(async () => {
    if (!selectedTask || isZipping) return;
    setIsZipping(true);
    try {
      const res = await fetch(`/api/jobs/${selectedTask.id}/zip`);
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `task-${selectedTask.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("下载失败:", error);
    } finally {
      setIsZipping(false);
    }
  }, [selectedTask, isZipping]);

  // For the search dialog, we just need a flat array of all tasks, which is easy to get now.
  const allTasksForSearch = useMemo(() => Object.values(tasks), [tasks]);


  return (
    <div className="h-screen w-full flex flex-col bg-gray-50/50">
      {/* ... (header and other JSX remains the same) ... */}
      <header className="px-6 py-4 bg-white/70 backdrop-blur-lg sticky top-0 z-30 border-b border-gray-200/80">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">项目看板</h1>
            <button
            onClick={() => setIsSearchOpen(true)}
            className="group relative flex items-center justify-center gap-2.5 px-4 py-2 
                        bg-white/50 backdrop-blur-lg 
                        border border-gray-900/10 hover:border-gray-900/20
                        rounded-full shadow-sm hover:shadow-md
                        transform-gpu transition-all duration-300 ease-out
                        hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
            >
            {/* Inner shadow/highlight for depth */}
            <div className="absolute inset-0.5 rounded-full bg-gradient-to-b from-white/80 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Content (Icon and Text) */}
            <Search className="relative h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors duration-200" strokeWidth={2} />
            <span className="relative text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                查询
            </span>
            </button>
        </div>
      </header>

      <div className="relative flex-1 flex">
        {isDrawerOpen && <div className="fixed inset-0 backdrop-blur-[2px] z-40" onClick={closeDrawer} />}

        <div className="flex-1 flex overflow-x-auto transition-all duration-300 z-10">
          <CreateJobForm onJobCreated={handleJobCreated} />

          {columns.map((column) => {
            // RECONSTITUTE DATA FOR RENDERING: Get full task objects for the current column
            const columnTasks = column.taskIds.map(id => tasks[id]).filter(Boolean);

            return column.id === "archive" ? (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-shrink-0 w-72 flex flex-col rounded-xl mx-2 my-4 transition-colors duration-200 ${
                  dragOverColumn === column.id ? "bg-blue-100/50" : "bg-gray-100/80"
                }`}
              >
                <div className="p-4 border-b border-gray-200/80 sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-gray-600" strokeWidth={1.5} />
                    <h2 className="text-base font-semibold text-gray-800">{column.title}</h2>
                    <span className="text-xs font-medium text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 pb-20">
                  {columnTasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <Archive className="h-12 w-12 text-gray-400 mb-4" strokeWidth={1.2} />
                      <p className="text-sm font-medium text-gray-600 mb-1">归档区域</p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        拖拽任务到此处归档
                        <br />
                        归档的任务将被保存
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {columnTasks.map((task) => (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          onClick={(e) => handleTaskClick(task, e)}
                          className="p-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-200 border border-gray-200/60 bg-white/60 group rounded-xl shadow-sm opacity-75 hover:opacity-100"
                        >
                          <div className="flex items-start gap-2">
                            <Archive className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-700 mb-1.5 leading-tight group-hover:text-gray-900 transition-colors">
                                {`${task.customerName} - ${task.representative}`}
                              </h3>
                              <p className="text-xs text-gray-500 leading-relaxed">{task.orderDate}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-shrink-0 w-72 flex flex-col rounded-xl mx-2 my-4 border border-gray-200/75 shadow-sm hover:shadow-md hover:-translate-y-0.5 transform-gpu transition-all duration-300 ${
                  dragOverColumn === column.id ? "bg-blue-100/50" : "bg-gray-100/80"
                }`}
              >
                <div className="p-4 border-b border-gray-200/80 sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-800">{column.title}</h2>
                    <span className="text-xs font-medium text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
                  {columnTasks.map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onClick={(e) => handleTaskClick(task, e)}
                      className="p-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-200 border border-gray-200/60 bg-white group rounded-xl shadow-sm"
                    >
                      <h3 className="text-sm font-medium text-gray-900 mb-1.5 leading-tight group-hover:text-blue-700 transition-colors">
                        {`${task.customerName} - ${task.representative}`}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{task.orderDate}</p>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* MODIFICATION: The SearchDialog no longer needs the 'tasks' prop */}
        <SearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onTaskSelect={(task) => {
            // This logic remains the same. The dialog now provides the full task object.
            const column = columns.find((c) => c.id === task.columnId);
            setSelectedTaskColumnTitle(column ? column.title : null);
            setSelectedTask(task);
            setIsDrawerOpen(true);
            // The dialog now handles closing itself upon selection.
          }}
        />

        <KanbanDrawer
          isOpen={isDrawerOpen}
          task={selectedTask}
          columnTitle={selectedTaskColumnTitle}
          onClose={closeDrawer}
          onUpload={handleFileChange}
          onOpenZip={handleDownloadZip}
          fileInputRef={fileInputRef}
          isDraggingOver={isDraggingOver}
          isUploading={isUploading}
        />
      </div>
    </div>
  );
}