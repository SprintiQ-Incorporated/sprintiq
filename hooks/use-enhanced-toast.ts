import { useToast } from "@/hooks/use-toast";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";

export function useEnhancedToast() {
  const { toast } = useToast();
  const { isEnabled: browserNotificationsEnabled, sendNotification } =
    useBrowserNotifications();

  const enhancedToast = (props: any) => {
    const {
      sendBrowserNotification = false,
      browserNotificationTitle,
      browserNotificationBody,
      ...toastProps
    } = props;

    // Show regular toast
    const toastResult = toast(toastProps);

    // Send browser notification if enabled and requested
    if (sendBrowserNotification && browserNotificationsEnabled) {
      const title =
        browserNotificationTitle ||
        (typeof toastProps.title === "string"
          ? toastProps.title
          : "SprintiQ Notification");
      const body =
        browserNotificationBody ||
        (typeof toastProps.description === "string"
          ? toastProps.description
          : "You have a new notification");

      sendNotification(title, body);
    }

    return toastResult;
  };

  return {
    toast: enhancedToast,
    browserNotificationsEnabled,
  };
}
