import { defineNitroPlugin } from "nitropack/runtime";
import { runDrawIfNeeded, syncExpiredTickets } from "../utils/draw";

export default defineNitroPlugin(() => {
  const timer = setInterval(async () => {
    try {
      await syncExpiredTickets();
      await runDrawIfNeeded();
    } catch (error) {
      console.error("[draw-runner] background task failed:", error);
    }
  }, 15_000);

  timer.unref?.();
});
