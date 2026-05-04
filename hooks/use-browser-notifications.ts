import { useState, useEffect } from "react";

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch (error) {
    console.error("Failed to send browser notification:", error);
  }
}

function isBrowserNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && Notification.permission === "granted";
}

export function useBrowserNotifications() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window);

    const checkPermission = () => {
      setIsEnabled(isBrowserNotificationsEnabled());
    };

    checkPermission();

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "notifications" })
        .then((permissionStatus) => {
          permissionStatus.addEventListener("change", checkPermission);
        });
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false;
    const permission = await Notification.requestPermission();
    setIsEnabled(permission === "granted");
    return permission === "granted";
  };

  const sendNotification = (title: string, body: string) => {
    if (isEnabled) sendBrowserNotification(title, body);
  };

  return {
    isEnabled,
    isSupported,
    requestPermission,
    sendNotification,
  };
}
