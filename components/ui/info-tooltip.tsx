"use client";

import React, { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfoTooltipContent {
  icon?: React.ReactNode;
  title: string;
  short: string;
  full: string;
}

export interface InfoTooltipProps {
  content: InfoTooltipContent;
  variant?: "light" | "dark";
  className?: string;
}

export function InfoTooltip({
  content,
  variant: _variant = "light",
  className,
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Prevent body scroll when mobile sheet is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobile, isOpen]);

  const handleTriggerClick = () => {
    if (isMobile) {
      setIsOpen(!isOpen);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleTriggerClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
          className
        )}
        aria-label={content.short}
        aria-expanded={isOpen}
        aria-haspopup={isMobile ? "dialog" : "true"}
      >
        <Info className="h-4 w-4" />
      </button>

      {/* Desktop Tooltip */}
      {!isMobile && isOpen && (
        <div
          role="tooltip"
          className="hidden md:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 whitespace-normal"
        >
          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {content.icon && (
                <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  {content.icon}
                </div>
              )}
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                {content.title}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{content.full}</p>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-tooltip-title"
            aria-describedby="info-tooltip-description"
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-4 pb-8 bg-white dark:bg-gray-800 shadow-2xl"
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {content.icon && (
                  <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    {content.icon}
                  </div>
                )}
                <h3
                  id="info-tooltip-title"
                  className="font-semibold text-lg text-gray-900 dark:text-white"
                >
                  {content.title}
                </h3>
              </div>
              <p
                id="info-tooltip-description"
                className="text-base leading-relaxed text-gray-600 dark:text-gray-300"
              >
                {content.full}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
