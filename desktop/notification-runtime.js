const http = require("node:http");

class NotificationRuntime {
  /** Poll unread counts and due alarms, then fan results back into Electron callbacks. */
  constructor(options = {}) {
    this.http = options.http ?? http;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.Notification = options.Notification;
    this.onUnreadCount = options.onUnreadCount ?? (() => undefined);
    this.onAlarmFired = options.onAlarmFired ?? (() => undefined);
    this.focusMainWindow = options.focusMainWindow ?? (() => undefined);
    this.unreadCountUrl = options.unreadCountUrl ?? "http://127.0.0.1:8000/api/v2/notifications/unread-count";
    this.upcomingAlarmsUrl = options.upcomingAlarmsUrl ?? "http://127.0.0.1:8000/api/v2/alarms/upcoming";
    this.dueAlarmsUrl = options.dueAlarmsUrl ?? "http://127.0.0.1:8000/api/v2/alarms/due";

    this.pollHandle = null;
    this.alarmPollHandle = null;
    this.dueAlarmsPollHandle = null;
    this.firedAlarms = new Map();
  }

  updateUnreadCount(count) {
    this.onUnreadCount(Number(count ?? 0));
  }

  fetchUnreadCount() {
    const request = this.http.get(this.unreadCountUrl, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          this.updateUnreadCount(parsed.count);
        } catch (_error) {
          this.updateUnreadCount(0);
        }
      });
    });

    request.on("error", () => {
      this.updateUnreadCount(0);
    });
  }

  showNotification(title, body) {
    const notification = new this.Notification({
      title,
      body,
      silent: false,
    });
    notification.on("click", () => {
      this.focusMainWindow();
    });
    notification.show();
  }

  fetchUpcomingAlarms() {
    const request = this.http.get(this.upcomingAlarmsUrl, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        try {
          const alarms = JSON.parse(body);
          if (!Array.isArray(alarms)) {
            return;
          }
          const now = Date.now();
          alarms.forEach((alarm) => {
            const alarmAt = new Date(alarm.at).getTime();
            if (!Number.isFinite(alarmAt) || alarm.muted) {
              return;
            }
            const delta = alarmAt - now;
            if (delta < 0 || delta > 90_000 || this.firedAlarms.has(alarm.id)) {
              return;
            }
            this.firedAlarms.set(alarm.id, { id: alarm.id, firedAt: now });
            this.showNotification("DopaFlow Alarm", alarm.title ?? "Alarm");
            this.onAlarmFired({ id: alarm.id, label: alarm.title ?? "Alarm" });
          });
        } catch (_error) {
          // Ignore transient parse/network failures, same as unread polling.
        }
      });
    });

    request.on("error", () => undefined);
  }

  cleanupFiredAlarms() {
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    for (const [id, record] of this.firedAlarms.entries()) {
      if (now - record.firedAt > fiveMinutesMs) {
        this.firedAlarms.delete(id);
      }
    }
  }

  fetchDueAlarms() {
    this.fetchImpl(this.dueAlarmsUrl)
      .then((response) => response.json())
      .then((alarms) => {
        if (!Array.isArray(alarms)) {
          return;
        }
        alarms.forEach((alarm) => {
          if (!this.firedAlarms.has(alarm.id)) {
            this.firedAlarms.set(alarm.id, { id: alarm.id, firedAt: Date.now() });
            this.showNotification(alarm.label ?? "Alarm", alarm.time_str ?? "");
            this.onAlarmFired(alarm);
          }
        });
        this.cleanupFiredAlarms();
      })
      .catch(() => {
        // Backend may not be running yet.
      });
  }

  start() {
    this.fetchUnreadCount();
    this.pollHandle = setInterval(() => this.fetchUnreadCount(), 10_000);

    this.fetchUpcomingAlarms();
    this.alarmPollHandle = setInterval(() => this.fetchUpcomingAlarms(), 30_000);

    this.fetchDueAlarms();
    this.dueAlarmsPollHandle = setInterval(() => this.fetchDueAlarms(), 60_000);
  }

  stop() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (this.alarmPollHandle) {
      clearInterval(this.alarmPollHandle);
      this.alarmPollHandle = null;
    }
    if (this.dueAlarmsPollHandle) {
      clearInterval(this.dueAlarmsPollHandle);
      this.dueAlarmsPollHandle = null;
    }
  }
}

module.exports = { NotificationRuntime };
