import cron from "node-cron";
import { runExpiryReminderCheck } from "../services/reminderService.js";

export function startExpiryReminderCron() {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const summary = await runExpiryReminderCheck();
        console.log("Expiry reminder check complete:", summary);
      } catch (error) {
        console.error("Expiry reminder cron failed:", error);
      }
    },
    {
      timezone: process.env.CRON_TIMEZONE || "Asia/Kolkata",
    }
  );
}
