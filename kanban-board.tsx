"use client"

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
  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [columns, setColumns] = useState<Column[]>(baseColumns)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTaskColumnTitle, setSelectedTaskColumnTitle] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const taskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!highlightedTaskId) return;

    const node = taskRefs.current.get(highlightedTaskId);
    const container = scrollContainerRef.current;
    if (node && container) {
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const scrollPadding = 60; 

      if (nodeRect.left < containerRect.left) {
        container.scrollTo({
          left: container.scrollLeft + nodeRect.left - containerRect.left - scrollPadding,
          behavior: 'smooth',
        });
      } else if (nodeRect.right > containerRect.right) {
        container.scrollTo({
          left: container.scrollLeft + nodeRect.right - containerRect.right + scrollPadding,
          behavior: 'smooth',
        });
      }

      node.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

    const timer = setTimeout(() => {
      setHighlightedTaskId(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [highlightedTaskId]);

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

  // This is the callback for the drawer. It updates the board's state.
  const handleTaskUpdated = useCallback((updatedTask: Task) => {
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

    const nextTasks = {
      ...tasks,
      [draggedTask.id]: { ...draggedTask, columnId: targetColumnId },
    };

    const nextColumns = columns.map((col) => {
      if (col.id === draggedTask.columnId) {
        return {
          ...col,
          taskIds: col.taskIds.filter((id) => id !== draggedTask.id),
        };
      }
      if (col.id === targetColumnId) {
        return { ...col, taskIds: [...col.taskIds, draggedTask.id] };
      }
      return col;
    });

    setTasks(nextTasks);
    setColumns(nextColumns);
    saveBoard({ tasks: nextTasks, columns: nextColumns });
    setDraggedTask(null);
  };

  const handleJobCreated = (newTask: Task) => {
    setTasks((prev) => ({ ...prev, [newTask.id]: newTask }));
    setColumns((prev) =>
      prev.map((col) =>
        col.id === START_COLUMN_ID
          ? { ...col, taskIds: [...col.taskIds, newTask.id] }
          : col,
      ),
    );
  };

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
    // Delay clearing task to allow for smooth exit animation
    setTimeout(() => {
      setSelectedTask(null);
      setSelectedTaskColumnTitle(null);
    }, 300);
  };

  const allTasksForSearch = useMemo(() => Object.values(tasks), [tasks]);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50/50">
      <header className="px-6 py-4 bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b-2 border-gray-200/60">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-medium text-gray-900 tracking-tight">Eldaline</h1>
            <span className="text-sm text-gray-500 font-normal">项目看板</span>
          </div>
          
          <button
            onClick={() => setIsSearchOpen(true)}
            className="group relative flex items-center justify-center gap-2.5 px-4 py-2.5 
                        bg-gray-100/60 backdrop-blur-sm 
                        border border-gray-200/60 hover:border-gray-300/80
                        rounded-full shadow-sm hover:shadow-md
                        transform-gpu transition-all duration-200 ease-out
                        hover:bg-white/80 active:scale-[0.96]"
          >
            <Search className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors duration-200" strokeWidth={2} />
            <span className="text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
              搜索
            </span>
            <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-gray-300/60">
              <kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-200/60 rounded border border-gray-300/40">⌘</kbd>
              <kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-200/60 rounded border border-gray-300/40">K</kbd>
            </div>
          </button>
        </div>
      </header>
      
      <div className="relative flex-1 flex min-h-0">
        {isDrawerOpen && <div className="fixed inset-0 backdrop-blur-[2px] z-40" onClick={closeDrawer} />}

        <div 
          ref={scrollContainerRef}
          className="flex-1 flex gap-4 overflow-x-auto p-4 transition-all duration-300 z-10"
        >
          <CreateJobForm onJobCreated={handleJobCreated} />

          {columns.map((column) => {
            const columnTasks = column.taskIds.map(id => tasks[id]).filter(Boolean);

            return column.id === "archive" ? (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex-shrink-0 w-72 flex flex-col rounded-xl transition-colors duration-200 ${
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
                          ref={(node) => {
                            const map = taskRefs.current;
                            if (node) map.set(task.id, node);
                            else map.delete(task.id);
                          }}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          onClick={(e) => handleTaskClick(task, e)}
                          className="p-3 cursor-pointer hover:shadow-lg hover:-translate-y-px transform transition-all duration-200 border border-gray-200/60 bg-white/60 group rounded-xl shadow-sm opacity-75 hover:opacity-100"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                               <div
                                className={`p-1 -m-1 rounded-md transition-colors duration-500
                                  ${highlightedTaskId === task.id ? 'bg-yellow-300/80' : 'bg-transparent'}`
                                }
                              >
                                <h3 className="text-sm font-medium text-gray-700 mb-1.5 leading-tight group-hover:text-gray-900 transition-colors">
                                  {`${task.customerName} - ${task.representative}`}
                                </h3>
                                <p className="text-xs text-gray-500 leading-relaxed">{task.orderDate}</p>
                              </div>
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
                className={`flex-shrink-0 w-72 flex flex-col rounded-xl border border-gray-200/75 shadow-sm hover:shadow-md transform-gpu transition-all duration-300 ${
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
                      ref={(node) => {
                        const map = taskRefs.current;
                        if (node) map.set(task.id, node);
                        else map.delete(task.id);
                      }}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onClick={(e) => handleTaskClick(task, e)}
                      className="p-3 cursor-pointer hover:shadow-lg hover:-translate-y-px transform transition-all duration-200 border border-gray-200/60 bg-white group rounded-xl shadow-sm"
                    >
                      <div
                        className={`p-1 -m-1 rounded-md transition-colors duration-500
                          ${highlightedTaskId === task.id ? 'bg-yellow-300/80' : 'bg-transparent'}`
                        }
                      >
                        <h3 className="text-sm font-medium text-gray-900 mb-1.5 leading-tight group-hover:text-blue-700 transition-colors">
                          {`${task.customerName} - ${task.representative}`}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed">{task.orderDate}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <SearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onTaskSelect={(task) => {
            setHighlightedTaskId(task.id);
          }}
        />

        <KanbanDrawer
          isOpen={isDrawerOpen}
          task={selectedTask}
          columnTitle={selectedTaskColumnTitle}
          onClose={closeDrawer}
          onTaskUpdated={handleTaskUpdated}
        />
      </div>
    </div>
  );
}