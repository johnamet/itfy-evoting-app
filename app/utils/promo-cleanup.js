import cron from "node-cron";
import PromoCode from "../models/promocode.js";

/**
 * Scheduled job to deactivate expired promo codes.
 * Runs daily at midnight.
 */
cron.schedule("0 0 * * *", async () => {
  console.log("Running promo code cleanup...");

  const now = new Date();

  try {
    const expiredPromoCodes = await PromoCode.all({
      active: true,
      expiration_date: { $lt: now }
    });

    for (const promo of expiredPromoCodes) {
      promo.active = false;
      await promo.updateInstance(promo.to_object());
      console.log(`Deactivated expired promo code: ${promo.code}`);
    }

    console.log("Promo code cleanup complete.");
  } catch (err) {
    console.error("Error during promo code cleanup:", err);
  }
});
