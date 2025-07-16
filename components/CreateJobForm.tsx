// file: components/CreateJobForm.tsx
"use client";

import type { Task } from "@/types";
import { useState, useRef } from "react";
import { Folder, PlusCircle, Loader2 } from "lucide-react"; // Changed icon
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateJobFormProps {
  onJobCreated: (task: Task) => void;
}

export default function CreateJobForm({ onJobCreated }: CreateJobFormProps) {
  // STATE CHANGE: from single File to FileList for folder contents
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [representative, setRepresentative] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HELPER: To get the root folder name from the FileList
  const getFolderName = (): string => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return "上传文件夹";
    }
    // webkitRelativePath is like "FolderName/file.txt". We extract "FolderName".
    const firstPath = (selectedFiles[0] as any).webkitRelativePath || "";
    return firstPath.split("/")[0] || "已选文件夹";
  };

  const handleCreateJob = async () => {
    // VALIDATION CHANGE: Check for selectedFiles list
    if (
      !selectedFiles ||
      selectedFiles.length === 0 ||
      !customerName.trim() ||
      !representative.trim() ||
      !orderDate.trim()
    )
      return;

    setIsCreating(true);
    try {
      const formData = new FormData();
      
      // LOGIC CHANGE: Append all files and their relative paths
      for (const file of Array.from(selectedFiles)) {
        formData.append("files", file);
        // The 'webkitRelativePath' property is key for reconstructing the folder structure
        formData.append("filePaths", (file as any).webkitRelativePath);
      }
      
      formData.append("customerName", customerName.trim());
      formData.append("representative", representative.trim());
      formData.append("orderDate", orderDate.trim());
      formData.append("notes", notes.trim());
      formData.append("folderName", getFolderName());


      const res = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("服务端错误");

      const newTask: Task = await res.json();
      onJobCreated(newTask);

      // RESET STATE
      setSelectedFiles(null);
      setCustomerName("");
      setRepresentative("");
      setOrderDate("");
      setNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("任务创建失败", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-shrink-0 w-72 bg-white flex flex-col p-4 gap-4 rounded-xl mx-2 my-4 shadow-sm border border-neutral-200/80">
      <div className="flex items-center gap-2 px-1">
        <PlusCircle className="h-5 w-5 text-neutral-500" />
        <h2 className="text-base font-semibold text-neutral-800">新建任务</h2>
      </div>

      <div className="w-full space-y-3">
        <label
          htmlFor="folderUpload"
          className="flex items-center justify-between w-full rounded-lg bg-neutral-100 hover:bg-neutral-200/70 transition-colors cursor-pointer px-3 py-2.5"
        >
          <div className="flex items-center gap-2 truncate">
            <Folder className="h-4 w-4 text-neutral-400 flex-shrink-0" />
            <span
              className={`text-sm truncate ${
                selectedFiles ? "text-neutral-700 font-medium" : "text-neutral-500"
              }`}
            >
              {getFolderName()}
            </span>
          </div>
          <input
            id="folderUpload"
            ref={fileInputRef}
            type="file"
            // ATTRIBUTE CHANGE: These enable folder selection
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => setSelectedFiles(e.target.files)}
          />
        </label>

        <Input
          placeholder="客户"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="text-sm bg-neutral-100 border-none rounded-lg px-3 py-2.5 h-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 placeholder:text-neutral-500"
        />
        <Input
          placeholder="负责人"
          value={representative}
          onChange={(e) => setRepresentative(e.target.value)}
          className="text-sm bg-neutral-100 border-none rounded-lg px-3 py-2.5 h-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 placeholder:text-neutral-500"
        />
        <Input
          type="text"
          placeholder="日期"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          className="text-sm bg-neutral-100 border-none rounded-lg px-3 py-2.5 h-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 placeholder:text-neutral-500"
        />
        <Input
          placeholder="备注"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm bg-neutral-100 border-none rounded-lg px-3 py-2.5 h-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 placeholder:text-neutral-500"
        />
      </div>

      <Button
        onClick={handleCreateJob}
        className="w-full bg-neutral-800 hover:bg-neutral-900 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:bg-neutral-800/40 disabled:shadow-none disabled:cursor-not-allowed"
        disabled={
          !selectedFiles ||
          selectedFiles.length === 0 ||
          !customerName ||
          !representative ||
          !orderDate ||
          isCreating
        }
      >
        {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : "创建任务"}
      </Button>
    </div>
  );
}