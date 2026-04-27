import { useEffect } from "react";

export interface UseKeyboardShortcutsParams {
  navigate: (route: string) => void;
  openPlanModal: () => void;
}

export function useKeyboardShortcuts({
  navigate,
  openPlanModal,
}: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      const isMod = event.ctrlKey || event.metaKey;

      // Ctrl/Cmd+T or Cmd+T → navigate to tasks + focus create
      if (isMod && event.key === "t") {
        event.preventDefault();
        navigate("tasks");
        const focusEvent = new CustomEvent("focus-task-create");
        document.dispatchEvent(focusEvent);
      }

      // Ctrl/Cmd+Shift+F → navigate to focus
      if (isMod && event.shiftKey && event.key === "F") {
        event.preventDefault();
        navigate("focus");
      }

      // Ctrl/Cmd+J → navigate to journal
      if (isMod && event.key === "j") {
        event.preventDefault();
        navigate("journal");
      }

      // Ctrl/Cmd+H → navigate to habits
      if (isMod && event.key === "h") {
        event.preventDefault();
        navigate("habits");
      }

      // Ctrl/Cmd+Shift+P → open plan modal
      if (isMod && event.shiftKey && event.key === "P") {
        event.preventDefault();
        openPlanModal();
      }

      // Ctrl/Cmd+1 → today
      if (isMod && event.key === "1") {
        event.preventDefault();
        navigate("today");
      }

      // Ctrl/Cmd+Shift+C → calendar
      if (isMod && event.shiftKey && event.key === "C") {
        event.preventDefault();
        navigate("calendar");
      }

      // Ctrl/Cmd+Shift+R → review
      if (isMod && event.shiftKey && event.key === "R") {
        event.preventDefault();
        navigate("review");
      }

      // Ctrl/Cmd+Shift+I → insights
      if (isMod && event.shiftKey && event.key === "I") {
        event.preventDefault();
        navigate("insights");
      }

      // Ctrl/Cmd+Shift+G → gamification
      if (isMod && event.shiftKey && event.key === "G") {
        event.preventDefault();
        navigate("gamification");
      }

      // Ctrl/Cmd+Shift+M → player (music)
      if (isMod && event.shiftKey && event.key === "M") {
        event.preventDefault();
        navigate("player");
      }

      // Escape → close modal
      if (event.key === "Escape") {
        const closeEvent = new CustomEvent("close-modal");
        document.dispatchEvent(closeEvent);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, openPlanModal]);
}
