"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

export function useKeyboardShortcuts() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params?.workspaceId as string;
  const pendingKey = useRef<string | null>(null);
  const pendingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (pendingTimeout.current) {
        clearTimeout(pendingTimeout.current);
      }

      const key = e.key.toLowerCase();

      if (!pendingKey.current) {
        if (key === "g") {
          pendingKey.current = "g";
          pendingTimeout.current = setTimeout(() => {
            pendingKey.current = null;
          }, 1000);
          return;
        }
      }

      if (pendingKey.current === "g" && workspaceId) {
        pendingKey.current = null;

        switch (key) {
          case "h":
            e.preventDefault();
            router.push(`/${workspaceId}/home`);
            break;
          case "t":
            e.preventDefault();
            router.push(`/${workspaceId}/teams`);
            break;
          case "a":
            e.preventDefault();
            router.push(`/${workspaceId}/home`);
            break;
          case "n":
            e.preventDefault();
            router.push(`/${workspaceId}/analytics`);
            break;
        }
      }
    },
    [router, workspaceId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (pendingTimeout.current) {
        clearTimeout(pendingTimeout.current);
      }
    };
  }, [handleKeyDown]);
}
