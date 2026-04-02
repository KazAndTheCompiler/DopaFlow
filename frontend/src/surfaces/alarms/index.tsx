import { useContext } from "react";

import { AppDataContext } from "../../App";
import AlarmForm from "./AlarmForm";
import AlarmQueue from "./AlarmQueue";
import AlarmsPanel from "./AlarmsPanel";

export default function AlarmsView(): JSX.Element {
  const app = useContext(AppDataContext);

  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const { alarms, active_alarm_id, next_alarm_at, schedulerRunning, create, remove, trigger } = app.alarms;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <AlarmsPanel
        running={schedulerRunning}
        nextAlarmAt={next_alarm_at}
        alarmCount={alarms.length}
      />

      <AlarmForm
        onCreate={async (alarm) => {
          await create(alarm);
        }}
      />

      <AlarmQueue
        alarms={alarms}
        activeAlarmId={active_alarm_id}
        onTrigger={trigger}
        onDelete={remove}
      />
    </div>
  );
}
