"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  variant?: "light" | "dark";
  className?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  variant: _variant = "light",
  className,
  children,
}: BottomSheetProps) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "bottom-sheet-title" : undefined}
        className={cn(
          "absolute bottom-0 left-0 right-0 rounded-t-2xl p-4 pb-8 bg-white dark:bg-gray-800 shadow-2xl transition-transform duration-300 ease-out",
          className
        )}
        style={{
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Drag Handle */}
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" aria-hidden="true" />

        {/* Header */}
        <div className="relative pb-4">
          {title && (
            <h2
              id="bottom-sheet-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {title}
            </h2>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 rounded-full p-2 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
