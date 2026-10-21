// Ticket rules shared by the secure server functions and the screens.

/** Tickets can be cancelled until this many minutes before departure. */
export const CANCEL_CUTOFF_MIN = 30;
/** Bookings can be made up to this many days ahead. */
export const MAX_DAYS_AHEAD = 30;
export const MAX_PASSENGERS = 6;

export function canCancel(status: string, travelAt: Date, now: Date = new Date()) {
  if (status !== "pending_payment" && status !== "confirmed") return { ok: false, reason: "This ticket can no longer be cancelled." };
  if (travelAt.getTime() - now.getTime() < CANCEL_CUTOFF_MIN * 60000)
    return { ok: false, reason: `Tickets can only be cancelled up to ${CANCEL_CUTOFF_MIN} minutes before departure.` };
  return { ok: true, reason: "" };
}

export function validateTravelTime(travelAt: Date, now: Date = new Date()) {
  if (Number.isNaN(travelAt.getTime())) return "Please choose a valid date and time.";
  if (travelAt.getTime() < now.getTime() + 2 * 60000) return "Departure time must be in the future.";
  if (travelAt.getTime() > now.getTime() + MAX_DAYS_AHEAD * 86400000) return `You can book up to ${MAX_DAYS_AHEAD} days ahead.`;
  return null;
}

/** Booking fare = journey fare per person × number of passengers. */
export function bookingTotal(farePerPerson: number, passengers: number) {
  return farePerPerson * passengers;
}

/** Unique, human-readable booking code like ST-7K3P9QXA (no confusing 0/O/1/I). */
export function makeBookingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "ST-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
