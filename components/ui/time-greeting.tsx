"use client";

import { useState, useEffect } from "react";

interface TimeGreetingProps {
  name?: string;
  className?: string;
}

/**
 * Client-side greeting component that uses the user's local timezone
 */
export function TimeGreeting({ name, className }: TimeGreetingProps) {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    // Run on client to get correct local time
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good morning");
    } else if (hour < 17) {
      setGreeting("Good afternoon");
    } else {
      setGreeting("Good evening");
    }
  }, []);

  return (
    <h1 className={className}>
      {greeting},{" "}
      <span className="text-emerald-600 dark:text-emerald-400">
        {name || "there"}
      </span>
    </h1>
  );
}
