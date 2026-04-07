import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { betId, type } = await request.json();

  const { data: bet } = await supabase
    .from("bets")
    .select(
      "*, game:games(*), market:markets(*), placer:profiles!bets_user_id_fkey(*), counterparties:bet_counterparties(*, profile:profiles(*))"
    )
    .eq("id", betId)
    .single();

  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  let message = "";

  if (type === "new_bet") {
    message = `${bet.placer.display_name} bet $${bet.wager_amount} on ${bet.game.away_team} @ ${bet.game.home_team} — ${bet.market.name} (${bet.pick}). You're on the other side for $${(bet.wager_amount / 2).toFixed(2)}.`;
  } else if (type === "settled") {
    message = `Bet settled: ${bet.game.away_team} @ ${bet.game.home_team} — ${bet.placer.display_name} ${bet.result === "win" ? "won" : bet.result === "loss" ? "lost" : "pushed"}.`;
  }

  const recipients =
    type === "new_bet"
      ? bet.counterparties.map((cp: any) => cp.profile)
      : [bet.placer, ...bet.counterparties.map((cp: any) => cp.profile)];

  for (const recipient of recipients) {
    // SMS via Twilio
    if (recipient.phone_number && process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
        await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            Body: `TULSA KING: ${message}`,
            From: process.env.TWILIO_PHONE_NUMBER!,
            To: recipient.phone_number,
          }),
        });
      } catch (e) {
        console.error("SMS failed:", e);
      }
    }

    // Web Push
    if (recipient.push_subscription && process.env.VAPID_PRIVATE_KEY) {
      try {
        const webpush = await import("web-push");
        webpush.setVapidDetails(
          "mailto:admin@tulsa-king.local",
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        );
        await webpush.sendNotification(
          recipient.push_subscription as any,
          JSON.stringify({ title: "TULSA KING", body: message })
        );
      } catch (e) {
        console.error("Push failed:", e);
      }
    }
  }

  return NextResponse.json({ success: true });
}
