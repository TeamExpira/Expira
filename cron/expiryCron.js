import cron from "node-cron";
import { runExpiryReminderCheck } from "../services/reminderService.js";

export function startExpiryReminderCron() {
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const summary = await runExpiryReminderCheck();
        console.log("Expiry reminder check complete:", summary);
      } catch (error) {
        console.error("Expiry reminder check failed:", error);
      }
    },
    {
      timezone: process.env.CRON_TIMEZONE || "Asia/Kolkata",
    }
  );
}
