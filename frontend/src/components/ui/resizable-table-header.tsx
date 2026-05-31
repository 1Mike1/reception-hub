import { cn } from '@/lib/utils';

interface ResizableTableHeaderProps {
  children?: React.ReactNode;
  columnKey: string;
  width: number;
  onResize: (e: React.MouseEvent, key: string) => void;
  className?: string;
  isLast?: boolean;
}

export function ResizableTableHeader({
  children,
  columnKey,
  width,
  onResize,
  className,
  isLast = false,
}: ResizableTableHeaderProps) {
  return (
    <th
      className={cn(
        "text-left p-4 font-medium text-muted-foreground relative select-none h-12",
        className
      )}
      style={{ width, minWidth: width }}
    >
      <span className="truncate block">{children}</span>
      {!isLast && (
        <div
          className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center group"
          onMouseDown={(e) => onResize(e, columnKey)}
        >
          <div className="w-px h-4 bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      )}
    </th>
  );
}

interface ResizableTableCellProps {
  children: React.ReactNode;
  width: number;
  className?: string;
}

export function ResizableTableCell({
  children,
  width,
  className,
}: ResizableTableCellProps) {
  return (
    <td
      className={cn("p-4 overflow-hidden h-14", className)}
      style={{ width, maxWidth: width }}
    >
      <span className="truncate block">{children}</span>
    </td>
  );
}
