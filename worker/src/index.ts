import { createClient } from "@supabase/supabase-js";

interface Env {
  ODDS_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  LEDGER_BACKUP?: R2Bucket;
}

// Major USA sports + golf, tennis, UFC
const PRIMARY_SPORTS = [
  // American Football
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "americanfootball_nfl_super_bowl_winner",
  "americanfootball_ncaaf_championship_winner",
  // Basketball
  "basketball_nba",
  "basketball_ncaab",
  "basketball_nba_championship_winner",
  // Baseball
  "baseball_mlb",
  "baseball_mlb_world_series_winner",
  // Hockey
  "icehockey_nhl",
  "icehockey_nhl_championship_winner",
  // Soccer (USA league only)
  "soccer_usa_mls",
  // MMA / Boxing
  "mma_mixed_martial_arts",
  "boxing_boxing",
  // Golf majors
  "golf_masters_tournament_winner",
  "golf_pga_championship_winner",
  "golf_us_open_winner",
  "golf_the_open_championship_winner",
  // Tennis majors
  "tennis_atp_french_open",
  "tennis_atp_wimbledon",
  "tennis_atp_us_open",
  "tennis_atp_aus_open",
];

// Sports that have scores API for settlement
const SETTLEMENT_SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "icehockey_nhl",
  "soccer_usa_mls",
  "mma_mixed_martial_arts",
  "boxing_boxing",
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/all-sports") {
      const apiUrl = `https://api.the-odds-api.com/v4/sports/?apiKey=${env.ODDS_API_KEY}&all=true`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/sports") {
      const apiUrl = `https://api.the-odds-api.com/v4/sports/?apiKey=${env.ODDS_API_KEY}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith("/fetch-sport/")) {
      const sport = path.split("/").filter(Boolean)[1];
      if (!sport) {
        return new Response("Missing sport", { status: 400 });
      }

      try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        const games = await fetchAndSyncSport(supabase, env, sport);
        return new Response(JSON.stringify(games), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Cleanup endpoint: mark stale past events as final
    if (path === "/cleanup") {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
      const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4 hours ago
      const { data } = await supabase
        .from("games")
        .update({ status: "final", last_updated: new Date().toISOString() })
        .in("status", ["upcoming", "live"])
        .lt("start_time", cutoff)
        .select("id");
      return new Response(
        JSON.stringify({ cleaned: data?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path.startsWith("/odds/")) {
      const parts = path.split("/").filter(Boolean);
      const sport = parts[1];
      const eventId = parts[2];

      let apiUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      if (eventId) {
        apiUrl += `&eventIds=${eventId}`;
      }

      const response = await fetch(apiUrl);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path.startsWith("/scores/")) {
      const sport = path.split("/")[2];
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=1`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const now = new Date();
    const minute = now.getUTCMinutes();
    const hour = now.getUTCHours();

    // Always: settle bets, refresh live scores, and clean up stale games
    await settleBets(supabase, env);
    await refreshLiveScores(supabase, env);
    await cleanupStaleGames(supabase);

    // Sync primary sports hourly
    if (minute < 5) {
      await syncPrimarySports(supabase, env);
    }

    // Nightly backup (5am UTC)
    if (hour === 5 && minute < 5) {
      await backupLedger(supabase, env);
    }
  },
};

// Mark games that started 4+ hours ago and are still "upcoming"/"live" as "final"
async function cleanupStaleGames(supabase: any) {
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("games")
    .update({ status: "final", last_updated: new Date().toISOString() })
    .eq("status", "upcoming")
    .lt("start_time", cutoff);
}

async function syncPrimarySports(supabase: any, env: Env) {
  try {
    const sportsResp = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${env.ODDS_API_KEY}`
    );
    const allActive: any[] = await sportsResp.json();

    if (Array.isArray(allActive)) {
      const activeKeys = new Set(allActive.map((s) => s.key));

      for (const sport of PRIMARY_SPORTS) {
        if (activeKeys.has(sport)) {
          try {
            await fetchAndSyncSport(supabase, env, sport);
          } catch (e) {
            console.error(`Error syncing ${sport}:`, e);
          }
        }
      }
    }
  } catch (e) {
    console.error("Error in syncPrimarySports:", e);
    for (const sport of PRIMARY_SPORTS) {
      try {
        await fetchAndSyncSport(supabase, env, sport);
      } catch (e) {
        console.error(`Error syncing ${sport}:`, e);
      }
    }
  }
}

async function fetchAndSyncSport(supabase: any, env: Env, sport: string) {
  const isOutright =
    sport.includes("_winner") ||
    sport.includes("_championship") ||
    sport.includes("_series_winner");
  const markets = isOutright ? "outrights" : "h2h,spreads,totals";

  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`
  );
  const events: any[] = await response.json();

  if (!Array.isArray(events)) return [];

  const now = new Date();
  const syncedGames: any[] = [];

  for (const event of events) {
    const eventTime = new Date(event.commence_time);

    // CRITICAL: Skip events that have already started (unless outright/futures which don't "start" traditionally)
    // For standard sports, if the event started more than 10 minutes ago, don't mark as upcoming
    const minutesSinceStart = (now.getTime() - eventTime.getTime()) / 60000;

    let status: string;
    if (isOutright) {
      // Outrights: if the event date has passed, skip it entirely
      if (minutesSinceStart > 24 * 60) continue; // skip if > 24h past
      status = "upcoming";
    } else if (minutesSinceStart > 0 && minutesSinceStart <= 240) {
      // Started within last 4 hours — could be live
      status = "live";
    } else if (minutesSinceStart > 240) {
      // Started more than 4 hours ago — game is over, skip
      continue;
    } else {
      status = "upcoming";
    }

    const homeTeam = event.home_team || formatSportTitle(sport);
    const awayTeam = event.away_team || "";

    const gameData = {
      external_id: event.id,
      sport,
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: event.commence_time,
      status,
      last_updated: now.toISOString(),
    };

    await supabase
      .from("games")
      .upsert(gameData, { onConflict: "external_id" });

    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("external_id", event.id)
      .single();

    if (game && event.bookmakers?.length > 0) {
      const bookmaker = event.bookmakers[0];
      for (const market of bookmaker.markets) {
        const marketRows = buildMarketData(game.id, market);
        if (!marketRows) continue;

        const rows = Array.isArray(marketRows) ? marketRows : [marketRows];
        for (const row of rows) {
          await supabase
            .from("markets")
            .upsert(row, { onConflict: "game_id,type,name" });
        }
      }
    }

    syncedGames.push({ ...gameData, id: game?.id });
  }

  return syncedGames;
}

function formatSportTitle(sport: string): string {
  return sport
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function refreshLiveScores(supabase: any, env: Env) {
  const now = new Date().toISOString();

  // Mark games as live if their start_time has passed and they're still "upcoming"
  // But only if started within last 4 hours
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: shouldBeLive } = await supabase
    .from("games")
    .select("id, sport, external_id")
    .eq("status", "upcoming")
    .lte("start_time", now)
    .gte("start_time", fourHoursAgo);

  if (shouldBeLive && shouldBeLive.length > 0) {
    for (const g of shouldBeLive) {
      await supabase
        .from("games")
        .update({ status: "live", last_updated: now })
        .eq("id", g.id);
    }
  }

  // Get unique sports with live games
  const { data: liveSportGames } = await supabase
    .from("games")
    .select("sport")
    .eq("status", "live");

  const liveSports = [
    ...new Set((liveSportGames || []).map((g: any) => g.sport)),
  ];

  for (const sport of liveSports) {
    try {
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=1`
      );
      const scores: any[] = await response.json();
      if (!Array.isArray(scores)) continue;

      for (const score of scores) {
        if (!score.scores) continue;

        const homeScore = parseInt(
          score.scores.find((s: any) => s.name === score.home_team)?.score || "0"
        );
        const awayScore = parseInt(
          score.scores.find((s: any) => s.name === score.away_team)?.score || "0"
        );

        await supabase
          .from("games")
          .update({
            home_score: homeScore,
            away_score: awayScore,
            status: score.completed ? "final" : "live",
            last_updated: new Date().toISOString(),
          })
          .eq("external_id", score.id);
      }

      await fetchAndSyncSport(supabase, env, sport);
    } catch (e) {
      console.error(`Error refreshing live scores for ${sport}:`, e);
    }
  }
}

async function settleBets(supabase: any, env: Env) {
  for (const sport of SETTLEMENT_SPORTS) {
    try {
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=3`
      );
      const scores: any[] = await response.json();

      if (!Array.isArray(scores)) continue;

      for (const score of scores) {
        if (!score.completed) continue;

        const homeScore = parseInt(
          score.scores?.find((s: any) => s.name === score.home_team)?.score || "0"
        );
        const awayScore = parseInt(
          score.scores?.find((s: any) => s.name === score.away_team)?.score || "0"
        );

        const { data: game } = await supabase
          .from("games")
          .update({
            status: "final",
            home_score: homeScore,
            away_score: awayScore,
            last_updated: new Date().toISOString(),
          })
          .eq("external_id", score.id)
          .neq("status", "final")
          .select()
          .single();

        if (!game) continue;

        const { data: activeBets } = await supabase
          .from("bets")
          .select("*, market:markets(*), counterparties:bet_counterparties(*)")
          .eq("game_id", game.id)
          .eq("status", "active");

        if (!activeBets) continue;

        for (const bet of activeBets) {
          const result = determineBetResult(bet, game);
          await settleSingleBet(supabase, bet, result);
        }
      }
    } catch (e) {
      console.error(`Error settling ${sport}:`, e);
    }
  }
}

async function backupLedger(supabase: any, env: Env) {
  if (!env.LEDGER_BACKUP) return;
  try {
    const { data: ledgerData } = await supabase
      .from("ledger")
      .select("*")
      .order("created_at", { ascending: true });

    if (ledgerData) {
      const timestamp = new Date().toISOString().split("T")[0];
      const json = JSON.stringify(ledgerData, null, 2);
      await env.LEDGER_BACKUP.put(`ledger-backup-${timestamp}.json`, json);
    }
  } catch (e) {
    console.error("Ledger backup failed:", e);
  }
}

function buildMarketData(gameId: string, market: any) {
  const outcomes = market.outcomes;
  if (!outcomes || outcomes.length === 0) return null;

  if (market.key === "h2h") {
    if (outcomes.length < 2) return null;
    return {
      game_id: gameId,
      type: "moneyline",
      name: "Moneyline",
      line: null,
      home_odds: outcomes[0].price,
      away_odds: outcomes[1].price,
      is_live: false,
      last_updated: new Date().toISOString(),
    };
  }

  if (market.key === "spreads") {
    if (outcomes.length < 2) return null;
    return {
      game_id: gameId,
      type: "spread",
      name: `Spread ${outcomes[0].point > 0 ? "+" : ""}${outcomes[0].point}`,
      line: outcomes[0].point,
      home_odds: outcomes[0].price,
      away_odds: outcomes[1].price,
      is_live: false,
      last_updated: new Date().toISOString(),
    };
  }

  if (market.key === "totals") {
    if (outcomes.length < 2) return null;
    return {
      game_id: gameId,
      type: "over_under",
      name: `O/U ${outcomes[0].point}`,
      line: outcomes[0].point,
      home_odds: outcomes[0].price,
      away_odds: outcomes[1].price,
      over_odds: outcomes[0].price,
      under_odds: outcomes[1].price,
      is_live: false,
      last_updated: new Date().toISOString(),
    };
  }

  if (market.key === "outrights") {
    return outcomes.map((outcome: any) => ({
      game_id: gameId,
      type: "outright",
      name: outcome.name,
      line: null,
      home_odds: outcome.price,
      away_odds: 0,
      is_live: false,
      last_updated: new Date().toISOString(),
    }));
  }

  return null;
}

function determineBetResult(bet: any, game: any): "win" | "loss" | "push" {
  const market = bet.market;
  const homeWon = game.home_score > game.away_score;
  const totalPoints = game.home_score + game.away_score;

  if (market.type === "moneyline") {
    if (game.home_score === game.away_score) return "push";
    if (bet.pick === "home" && homeWon) return "win";
    if (bet.pick === "away" && !homeWon) return "win";
    return "loss";
  }

  if (market.type === "spread") {
    const adjustedScore =
      bet.pick === "home"
        ? game.home_score + Number(market.line)
        : game.away_score - Number(market.line);
    const opponentScore =
      bet.pick === "home" ? game.away_score : game.home_score;
    if (adjustedScore === opponentScore) return "push";
    if (adjustedScore > opponentScore) return "win";
    return "loss";
  }

  if (market.type === "over_under") {
    if (totalPoints === Number(market.line)) return "push";
    if (bet.pick === "over" && totalPoints > Number(market.line)) return "win";
    if (bet.pick === "under" && totalPoints < Number(market.line)) return "win";
    return "loss";
  }

  if (market.type === "outright") {
    return "loss";
  }

  return "loss";
}

async function settleSingleBet(
  supabase: any,
  bet: any,
  result: "win" | "loss" | "push"
) {
  const now = new Date().toISOString();

  await supabase
    .from("bets")
    .update({ status: "settled", result, settled_at: now })
    .eq("id", bet.id);

  const counterpartyResult =
    result === "win" ? "loss" : result === "loss" ? "win" : "push";

  for (const cp of bet.counterparties) {
    await supabase
      .from("bet_counterparties")
      .update({ result: counterpartyResult, payout: cp.share_amount })
      .eq("id", cp.id);
  }

  if (result === "win") {
    const profit =
      bet.wager_amount *
      (bet.odds_at_placement > 0
        ? bet.odds_at_placement / 100
        : 100 / Math.abs(bet.odds_at_placement));
    const perPerson = profit / 2;

    for (const cp of bet.counterparties) {
      await supabase.from("ledger").insert({
        bet_id: bet.id,
        from_user_id: cp.user_id,
        to_user_id: bet.user_id,
        amount: perPerson,
        type: "bet_settlement",
      });
    }
  } else if (result === "loss") {
    const perPerson = bet.wager_amount / 2;

    for (const cp of bet.counterparties) {
      await supabase.from("ledger").insert({
        bet_id: bet.id,
        from_user_id: bet.user_id,
        to_user_id: cp.user_id,
        amount: perPerson,
        type: "bet_settlement",
      });
    }
  }
}
