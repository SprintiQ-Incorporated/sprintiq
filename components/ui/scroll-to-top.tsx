"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThrottle } from "@/hooks/use-debounce";

interface ScrollToTopProps {
  threshold?: number;
  className?: string;
  isMenuOpen?: boolean;
}

export default function ScrollToTop({
  threshold = 300,
  className = "",
  isMenuOpen = false,
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Throttled scroll handler for INP optimization
  const toggleVisibility = useCallback(() => {
    if (window.pageYOffset > threshold) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [threshold]);

  const throttledToggle = useThrottle(toggleVisibility);

  useEffect(() => {
    // Initial check
    toggleVisibility();

    window.addEventListener("scroll", throttledToggle, { passive: true });
    return () => window.removeEventListener("scroll", throttledToggle);
  }, [throttledToggle, toggleVisibility]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && !isMenuOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed bottom-8 right-8 z-50 ${className}`}
        >
          <Button
            onClick={scrollToTop}
            size="icon"
            className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 group animate-pulse-glow"
            aria-label="Scroll to top"
          >
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <ChevronUp className="w-5 h-5" />
            </motion.div>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
