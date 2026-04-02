// Alarm Service Worker - polls for alarms even when tab is backgrounded
const API_BASE_URL = "http://127.0.0.1:8000/api/v2";
const POLL_INTERVAL_MS = 30_000;
const ALARM_WINDOW_MS = 2 * 60_000; // 2 minutes

let pollTimeoutId = null;
const firedAlarms = new Set();

async function pollAlarms() {
  try {
    const response = await fetch(`${API_BASE_URL}/alarms`);
    if (!response.ok) return;

    const alarms = await response.json();
    const now = Date.now();

    for (const alarm of alarms) {
      // Skip if already fired, muted, or not in window
      if (firedAlarms.has(alarm.id) || alarm.muted) continue;

      const alarmTime = new Date(alarm.at).getTime();
      if (alarmTime <= now && now - alarmTime < ALARM_WINDOW_MS) {
        firedAlarms.add(alarm.id);

        // Show notification
        const text = alarm.tts_text || alarm.title;
        const options = {
          body: text,
          tag: alarm.id,
          badge: "/icon-192.png",
          icon: "/icon-192.png",
        };

        try {
          await self.registration.showNotification(alarm.title, options);
        } catch (e) {
          console.error("Failed to show notification:", e);
        }

        // Notify all clients so they can also fire TTS if visible
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: "ALARM_FIRED",
            alarm: alarm,
            text: text,
          });
        }
      }
    }
  } catch (error) {
    console.error("Alarm poll failed:", error);
  } finally {
    // Schedule next poll
    pollTimeoutId = setTimeout(pollAlarms, POLL_INTERVAL_MS);
  }
}

// Start polling on worker activation
self.addEventListener("activate", () => {
  if (!pollTimeoutId) {
    pollTimeoutId = setTimeout(pollAlarms, POLL_INTERVAL_MS);
  }
});

// Reset fired alarms every 24 hours
setInterval(() => {
  firedAlarms.clear();
}, 24 * 60 * 60_000);

// Handle notification clicks to focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window" })
      .then((clients) => {
        if (clients.length > 0) {
          return clients[0].focus();
        }
        return self.clients.openWindow("/");
      })
  );
});
