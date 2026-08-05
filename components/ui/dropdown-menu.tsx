'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = 'right',
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Close dropdown when pressing Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-56 rounded-lg border border-border bg-popover/95 backdrop-blur-md p-1.5 text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none animate-in fade-in-0 zoom-in-95 duration-100",
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          )}
        >
          <div className="flex flex-col gap-0.5" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
}

export function DropdownMenuItem({
  children,
  className,
  variant = 'default',
  ...props
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium outline-none select-none transition-all duration-75 active:scale-[0.98]",
        variant === 'destructive'
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300 dark:hover:bg-red-500/20"
          : "text-foreground/90 hover:bg-muted hover:text-foreground dark:hover:bg-input/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="-mx-1.5 my-1 h-px bg-border/60 pointer-events-none" />;
}
