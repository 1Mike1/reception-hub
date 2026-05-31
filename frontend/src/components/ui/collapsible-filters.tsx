import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CollapsibleFiltersProps {
  children: React.ReactNode;
  activeFiltersCount?: number;
  className?: string;
  onReset?: () => void;
}

export function CollapsibleFilters({ children, activeFiltersCount = 0, className, onReset }: CollapsibleFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !target.closest('[data-radix-popper-content-wrapper]') &&
        !target.closest('[role="listbox"]') &&
        !target.closest('[role="option"]')
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative",
          isOpen && "bg-muted"
        )}
      >
        {isOpen ? (
          <X className="w-4 h-4" />
        ) : (
          <SlidersHorizontal className="w-4 h-4" />
        )}
        {activeFiltersCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 min-w-[280px] p-4 bg-popover border border-border rounded-lg shadow-lg space-y-3">
          {children}
          {onReset && activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => { onReset(); setIsOpen(false); }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
