// Secure server functions for tickets. Passengers cannot write bookings or payments directly:
// the database only lets these functions do it, after they re-check the journey and fare.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookingTotal, canCancel, makeBookingCode, MAX_PASSENGERS, validateTravelTime } from "./booking-rules";
import { loadNetwork } from "./network";
import { findJourneyOptions, OPTION_KINDS } from "./route-planner";

const createSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  option: z.enum(OPTION_KINDS as [string, ...string[]]),
  travelAt: z.string().datetime(),
  passengers: z.number().int().min(1).max(MAX_PASSENGERS),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const travelAt = new Date(data.travelAt);
    const timeError = validateTravelTime(travelAt);
    if (timeError) throw new Error(timeError);
    if (data.fromId === data.toId) throw new Error("Starting stop and destination must be different.");

    // Re-plan on the server so the fare cannot be changed by the browser.
    const network = await loadNetwork(context.supabase);
    const option = findJourneyOptions(network.routes, network.buses, data.fromId, data.toId).find((o) => o.kind === data.option);
    if (!option) throw new Error("This journey option is no longer available.");
    const from = network.stops.find((s) => s.id === data.fromId)!;
    const to = network.stops.find((s) => s.id === data.toId)!;

    const legs = option.journey.legs.map((l) => ({
      route_number: l.route.route_number,
      route_name: l.route.name,
      color: l.route.color,
      from: l.stops[0]!.name,
      to: l.stops[l.stops.length - 1]!.name,
      stops: l.stops.map((s) => s.name),
      km: Math.round(l.km * 10) / 10,
      minutes: l.minutes,
      fare: l.fare,
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        booking_code: makeBookingCode(),
        user_id: context.userId,
        from_stop_id: from.id,
        to_stop_id: to.id,
        from_name: from.name,
        to_name: to.name,
        travel_at: travelAt.toISOString(),
        option_type: data.option,
        legs,
        passengers: data.passengers,
        fare_total: bookingTotal(option.journey.totalFare, data.passengers),
        status: "pending_payment",
      })
      .select("id, booking_code")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("You already have an active booking for this journey at this time.");
      throw new Error("Could not save the booking. Please try again.");
    }
    return row;
  });

const randomRef = () => {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
};

/** DEMO payment: no real money moves. The result is recorded and clearly marked as demo. */
export const payBookingDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bookingId: z.string().uuid(), outcome: z.enum(["success", "failure"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select("id, user_id, status, fare_total")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error || !booking || booking.user_id !== context.userId) throw new Error("Booking not found.");
    if (booking.status !== "pending_payment") throw new Error("This booking is not waiting for payment.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.outcome === "success" ? "succeeded" : "failed";
    const transactionRef = `DEMO-${randomRef()}`;
    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      booking_id: booking.id,
      user_id: context.userId,
      amount: booking.fare_total,
      mode: "demo",
      status,
      transaction_ref: transactionRef,
    });
    if (payErr) throw new Error("Could not record the payment.");
    if (status === "succeeded") {
      const { error: upErr } = await supabaseAdmin
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", booking.id)
        .eq("status", "pending_payment");
      if (upErr) throw new Error("Payment recorded but the booking could not be confirmed.");
    }
    return { status, transactionRef };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("bookings")
      .select("id, user_id, status, travel_at, fare_total")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking || booking.user_id !== context.userId) throw new Error("Booking not found.");
    const rule = canCancel(booking.status, new Date(booking.travel_at));
    if (!rule.ok) throw new Error(rule.reason);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wasPaid = booking.status === "confirmed";
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (error) throw new Error("Could not cancel the booking.");
    if (wasPaid) {
      await supabaseAdmin.from("payments").insert({
        booking_id: booking.id,
        user_id: context.userId,
        amount: booking.fare_total,
        mode: "demo",
        status: "refunded",
        transaction_ref: `DEMO-REFUND-${randomRef()}`,
      });
    }
    return { cancelled: true, refunded: wasPaid };
  });

async function requireStaff(supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "operator" | "driver" }) => PromiseLike<{ data: boolean | null }> }, userId: string) {
  for (const role of ["admin", "operator", "driver"] as const) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
    if (data) return role;
  }
  throw new Error("Only drivers, operators and admins can check tickets.");
}

export const checkTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20), markUsed: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const code = data.code.toUpperCase();
    const { data: b } = await context.supabase
      .from("bookings")
      .select("id, booking_code, status, from_name, to_name, travel_at, passengers, fare_total, legs, used_at")
      .eq("booking_code", code)
      .maybeSingle();
    if (!b) return { found: false as const };

    if (data.markUsed) {
      if (b.status !== "confirmed") throw new Error(`Ticket cannot be used: status is ${b.status.replace("_", " ")}.`);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("status", "confirmed");
      if (error) throw new Error("Could not mark the ticket as used.");
      b.status = "used";
    }
    return { found: true as const, booking: b };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "operator", "driver", "passenger"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can change roles.");
    if (data.userId === context.userId && data.role !== "admin") throw new Error("You cannot remove your own admin role.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (del.error) throw new Error("Could not update the role.");
    const ins = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (ins.error) throw new Error("Could not update the role.");
    return { ok: true };
  });
