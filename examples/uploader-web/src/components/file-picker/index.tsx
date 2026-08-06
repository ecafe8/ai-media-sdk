import { useCallback, useRef, useState } from "react";
import { UploadCloudIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/shadcn/button";

export interface FilePickerProps {
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  inputId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FilePicker({
  file,
  onSelect,
  disabled,
  inputId = "file-upload",
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      onSelect(files && files.length > 0 ? (files[0] ?? null) : null);
    },
    [onSelect]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/40 p-6 text-center transition-colors hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        dragging && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <UploadCloudIcon className="size-8 text-muted-foreground" />
      {file ? (
        <div className="text-sm">
          <p className="font-medium text-foreground">{file.name}</p>
          <p className="text-muted-foreground">
            {formatBytes(file.size)}
            {file.type ? ` · ${file.type}` : ""}
          </p>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          点击或拖拽文件到此处上传
        </div>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="hidden"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
      >
        选择文件
      </Button>
    </div>
  );
}
