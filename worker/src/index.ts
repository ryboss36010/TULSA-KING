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
  "baseball_ncaa",
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

// Player prop markets to fetch per sport (Odds API v4 event-level endpoint)
const PLAYER_PROP_MARKETS: Record<string, string[]> = {
  basketball_nba: [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_points_rebounds_assists",
  ],
  basketball_ncaab: [
    "player_points",
    "player_rebounds",
    "player_assists",
  ],
  americanfootball_nfl: [
    "player_pass_tds",
    "player_pass_yds",
    "player_rush_yds",
    "player_reception_yds",
    "player_receptions",
    "player_anytime_td",
  ],
  americanfootball_ncaaf: [
    "player_pass_tds",
    "player_pass_yds",
    "player_rush_yds",
  ],
  baseball_mlb: [
    "pitcher_strikeouts",
    "batter_home_runs",
    "batter_hits",
    "batter_total_bases",
    "batter_rbis",
  ],
  baseball_ncaa: [
    "pitcher_strikeouts",
    "batter_home_runs",
    "batter_hits",
    "batter_total_bases",
  ],
  icehockey_nhl: [
    "player_points",
    "player_goals",
    "player_assists",
    "player_shots_on_goal",
  ],
};

// Sports that have scores API for settlement
const SETTLEMENT_SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "baseball_ncaa",
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

    // Trigger ESPN schedule sync on demand
    if (path === "/sync-schedules") {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
      await syncESPNSchedules(supabase);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ESPN live stats proxy — returns live game data from ESPN
    if (path.startsWith("/espn-live/")) {
      const parts = path.split("/").filter(Boolean);
      const sport = parts[1]; // e.g., "basketball_nba"
      const espnPath = ESPN_SCHEDULE_MAP[sport];
      if (!espnPath) {
        return new Response(JSON.stringify({ error: "Sport not mapped to ESPN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Optional: pass home_team and away_team as query params to match the right game
      const homeTeam = url.searchParams.get("home_team") || "";
      const awayTeam = url.searchParams.get("away_team") || "";

      try {
        const resp = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/scoreboard`
        );
        const data: any = await resp.json();
        const events = data.events || [];

        // Find matching event by team names
        let match = null;
        for (const ev of events) {
          const comp = ev.competitions?.[0];
          if (!comp) continue;
          const teams = comp.competitors?.map((c: any) => c.team?.displayName?.toLowerCase()) || [];
          if (
            (homeTeam && teams.some((t: string) => t.includes(homeTeam.toLowerCase()))) ||
            (awayTeam && teams.some((t: string) => t.includes(awayTeam.toLowerCase())))
          ) {
            match = ev;
            break;
          }
        }

        if (!match) {
          return new Response(JSON.stringify({ found: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const comp = match.competitions[0];
        const status = comp.status || {};
        const homeComp = comp.competitors?.find((c: any) => c.homeAway === "home");
        const awayComp = comp.competitors?.find((c: any) => c.homeAway === "away");

        const result: any = {
          found: true,
          status: status.type?.name,
          detail: status.type?.shortDetail || status.type?.detail,
          clock: status.displayClock,
          period: status.period,
          home: {
            team: homeComp?.team?.displayName,
            score: homeComp?.score,
            linescores: homeComp?.linescores?.map((ls: any) => ls.value) || [],
            leaders: (homeComp?.leaders || []).map((l: any) => ({
              category: l.name,
              player: l.leaders?.[0]?.athlete?.displayName,
              value: l.leaders?.[0]?.displayValue,
            })),
          },
          away: {
            team: awayComp?.team?.displayName,
            score: awayComp?.score,
            linescores: awayComp?.linescores?.map((ls: any) => ls.value) || [],
            leaders: (awayComp?.leaders || []).map((l: any) => ({
              category: l.name,
              player: l.leaders?.[0]?.athlete?.displayName,
              value: l.leaders?.[0]?.displayValue,
            })),
          },
        };

        // Baseball-specific: situation data
        if (comp.situation) {
          const sit = comp.situation;
          result.situation = {
            balls: sit.balls,
            strikes: sit.strikes,
            outs: sit.outs,
            onFirst: !!sit.onFirst,
            onSecond: !!sit.onSecond,
            onThird: !!sit.onThird,
            batter: sit.batter?.athlete?.displayName,
            pitcher: sit.pitcher?.athlete?.displayName,
          };
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // On-demand player props sync
    if (path === "/sync-props") {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
      await syncPlayerProps(supabase, env);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Every minute: refresh live scores from the scores API (cheap)
    await refreshLiveScores(supabase, env);
    await cleanupStaleGames(supabase);

    // Every 5 minutes: settle bets (uses scores API — separate calls)
    if (minute % 5 === 0) {
      await settleBets(supabase, env);
    }

    // Every 10 minutes: full sync of all primary sports odds
    if (minute % 10 === 0) {
      await syncPrimarySports(supabase, env);
    }

    // Every 30 minutes: sync ESPN schedules (7-day lookahead)
    if (minute % 30 === 0) {
      await syncESPNSchedules(supabase);
    }

    // Hourly: sync player props (expensive — 1 API call per event)
    if (minute === 15) {
      await syncPlayerProps(supabase, env);
    }

    // Nightly backup (5am UTC)
    if (hour === 5 && minute < 2) {
      await backupLedger(supabase, env);
    }
  },
};

// ESPN schedule API mappings — sport key → ESPN endpoint path
const ESPN_SCHEDULE_MAP: Record<string, string> = {
  americanfootball_nfl: "football/nfl",
  americanfootball_ncaaf: "football/college-football",
  basketball_nba: "basketball/nba",
  basketball_ncaab: "basketball/mens-college-basketball",
  baseball_mlb: "baseball/mlb",
  baseball_ncaa: "baseball/college-baseball",
  icehockey_nhl: "hockey/nhl",
};

// Sync schedules from ESPN for the next 7 days so games are searchable before odds are posted
async function syncESPNSchedules(supabase: any) {
  const today = new Date();

  for (const [sportKey, espnPath] of Object.entries(ESPN_SCHEDULE_MAP)) {
    try {
      // Fetch next 7 days
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

        const url = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/scoreboard?dates=${dateStr}`;
        const resp = await fetch(url);
        const data: any = await resp.json();

        if (!data.events || !Array.isArray(data.events)) continue;

        for (const event of data.events) {
          const competitions = event.competitions?.[0];
          if (!competitions) continue;

          const homeComp = competitions.competitors?.find((c: any) => c.homeAway === "home");
          const awayComp = competitions.competitors?.find((c: any) => c.homeAway === "away");
          if (!homeComp || !awayComp) continue;

          const homeTeam = homeComp.team?.displayName || homeComp.team?.name || "TBD";
          const awayTeam = awayComp.team?.displayName || awayComp.team?.name || "TBD";
          const startTime = event.date;
          const espnId = `espn_${event.id}`;

          // Determine status from ESPN data
          const espnStatus = competitions.status?.type?.name || "STATUS_SCHEDULED";
          let status = "upcoming";
          if (espnStatus === "STATUS_IN_PROGRESS" || espnStatus === "STATUS_HALFTIME") {
            status = "live";
          } else if (espnStatus === "STATUS_FINAL" || espnStatus === "STATUS_POSTPONED") {
            status = "final";
          }

          // Only insert if we don't already have this game (check by teams + start time match)
          // Use external_id = espn_{id} so we don't create duplicates
          // If an Odds API game exists for the same matchup, skip it
          const { data: existing } = await supabase
            .from("games")
            .select("id")
            .eq("sport", sportKey)
            .eq("home_team", homeTeam)
            .eq("away_team", awayTeam)
            .gte("start_time", new Date(new Date(startTime).getTime() - 3600000).toISOString())
            .lte("start_time", new Date(new Date(startTime).getTime() + 3600000).toISOString())
            .limit(1);

          if (existing && existing.length > 0) continue; // Already have this game

          // Also check by espn external_id
          const { data: existingEspn } = await supabase
            .from("games")
            .select("id")
            .eq("external_id", espnId)
            .limit(1);

          if (existingEspn && existingEspn.length > 0) {
            // Update status if changed
            if (status === "final" || status === "live") {
              const scores: any = {};
              if (homeComp.score) scores.home_score = parseInt(homeComp.score);
              if (awayComp.score) scores.away_score = parseInt(awayComp.score);
              await supabase
                .from("games")
                .update({ status, ...scores, last_updated: new Date().toISOString() })
                .eq("external_id", espnId);
            }
            continue;
          }

          // Insert new game from ESPN schedule
          await supabase.from("games").upsert(
            {
              external_id: espnId,
              sport: sportKey,
              home_team: homeTeam,
              away_team: awayTeam,
              start_time: startTime,
              status,
              last_updated: new Date().toISOString(),
            },
            { onConflict: "external_id" }
          );
        }
      }
    } catch (e) {
      console.error(`Error syncing ESPN schedule for ${sportKey}:`, e);
    }
  }
}

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

// Sync player props for today's games only — runs hourly to conserve API credits
// Each event costs 1 API call, so we cap at ~20 events total per cycle
async function syncPlayerProps(supabase: any, env: Env) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Get today's upcoming/live games that have Odds API external_ids (not ESPN-only)
  const { data: todayGames } = await supabase
    .from("games")
    .select("id, external_id, sport, start_time")
    .in("status", ["upcoming", "live"])
    .gte("start_time", startOfDay.toISOString())
    .lte("start_time", endOfDay.toISOString())
    .not("external_id", "like", "espn_%")
    .order("start_time", { ascending: true });

  if (!todayGames || todayGames.length === 0) return;

  let apiCalls = 0;
  const MAX_CALLS = 20; // Hard cap to conserve credits

  for (const game of todayGames) {
    if (apiCalls >= MAX_CALLS) break;

    const propMarketKeys = PLAYER_PROP_MARKETS[game.sport];
    if (!propMarketKeys || propMarketKeys.length === 0) continue;

    const marketsParam = propMarketKeys.join(",");

    try {
      const resp = await fetch(
        `https://api.the-odds-api.com/v4/sports/${game.sport}/events/${game.external_id}/odds?apiKey=${env.ODDS_API_KEY}&regions=us&markets=${marketsParam}&oddsFormat=american`
      );
      apiCalls++;

      const eventData: any = await resp.json();

      // Check for quota errors
      if (eventData?.error_code === "OUT_OF_USAGE_CREDITS") {
        console.error("Odds API quota exhausted — stopping prop sync");
        return;
      }

      if (!eventData?.bookmakers?.length) continue;

      const bookmaker = eventData.bookmakers[0];
      for (const market of bookmaker.markets) {
        const propRows = buildPlayerPropData(game.id, market);
        if (!propRows) continue;

        for (const row of propRows) {
          await supabase
            .from("markets")
            .upsert(row, { onConflict: "game_id,type,name" });
        }
      }
    } catch (e) {
      console.error(`Error fetching props for ${game.sport} event ${game.external_id}:`, e);
    }
  }

  console.log(`syncPlayerProps: ${apiCalls} API calls for ${todayGames.length} games`);
}

// Build market rows from a player prop market
// Outcomes have: name (player), description (Over/Under), price, point
function buildPlayerPropData(gameId: string, market: any) {
  const outcomes = market.outcomes;
  if (!outcomes || outcomes.length === 0) return null;

  // Map API market key to a readable label
  const PROP_LABELS: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes: "Threes",
    player_points_rebounds_assists: "Pts+Reb+Ast",
    player_points_rebounds: "Pts+Reb",
    player_points_assists: "Pts+Ast",
    player_rebounds_assists: "Reb+Ast",
    player_pass_tds: "Pass TDs",
    player_pass_yds: "Pass Yards",
    player_rush_yds: "Rush Yards",
    player_reception_yds: "Rec Yards",
    player_receptions: "Receptions",
    player_anytime_td: "Anytime TD",
    pitcher_strikeouts: "Strikeouts",
    batter_home_runs: "Home Runs",
    batter_hits: "Hits",
    batter_total_bases: "Total Bases",
    batter_rbis: "RBIs",
    player_goals: "Goals",
    player_shots_on_goal: "Shots on Goal",
  };

  const propLabel = PROP_LABELS[market.key] || market.key;

  // Group outcomes by player name
  const playerMap = new Map<
    string,
    { over?: any; under?: any; yes?: any }
  >();
  for (const o of outcomes) {
    const existing = playerMap.get(o.name) || {};
    const desc = (o.description || "").toLowerCase();
    if (desc === "over") existing.over = o;
    else if (desc === "under") existing.under = o;
    else if (desc === "yes") existing.yes = o;
    playerMap.set(o.name, existing);
  }

  const rows: any[] = [];
  for (const [playerName, sides] of playerMap.entries()) {
    if (sides.over && sides.under) {
      // Over/Under prop
      rows.push({
        game_id: gameId,
        type: "prop",
        name: `${playerName} - ${propLabel}`,
        line: sides.over.point ?? null,
        home_odds: sides.over.price,
        away_odds: sides.under.price,
        over_odds: sides.over.price,
        under_odds: sides.under.price,
        is_live: false,
        last_updated: new Date().toISOString(),
      });
    } else if (sides.yes) {
      // Yes/No prop (like Anytime TD)
      rows.push({
        game_id: gameId,
        type: "prop",
        name: `${playerName} - ${propLabel}`,
        line: null,
        home_odds: sides.yes.price,
        away_odds: 0,
        over_odds: null,
        under_odds: null,
        is_live: false,
        last_updated: new Date().toISOString(),
      });
    }
  }

  return rows.length > 0 ? rows : null;
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

      // NOTE: Do NOT call fetchAndSyncSport here — it burns API credits.
      // Odds sync happens every 5 min via syncPrimarySports. Scores are enough for live updates.
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
