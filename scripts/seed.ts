import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { username: "player1", password: "changeme123!", displayName: "Player 1" },
  { username: "player2", password: "changeme123!", displayName: "Player 2" },
  { username: "player3", password: "changeme123!", displayName: "Player 3" },
];

async function seed() {
  console.log("Seeding users...");

  for (const user of USERS) {
    const email = `${user.username}@tulsa-king.local`;

    // Create auth user
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: user.password,
        email_confirm: true,
      });

    if (authError) {
      console.error(`Failed to create ${user.username}:`, authError.message);
      continue;
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      username: user.username,
      display_name: user.displayName,
    });

    if (profileError) {
      console.error(
        `Failed to create profile for ${user.username}:`,
        profileError.message
      );
      continue;
    }

    console.log(`Created user: ${user.username} (${authUser.user.id})`);
  }

  console.log("\nSeeding sample games...");

  const sampleGames = [
    {
      external_id: "sample-nfl-1",
      sport: "americanfootball_nfl",
      home_team: "Georgia Bulldogs",
      away_team: "Alabama Crimson Tide",
      start_time: new Date(Date.now() + 86400000).toISOString(),
      status: "upcoming",
    },
    {
      external_id: "sample-nba-1",
      sport: "basketball_nba",
      home_team: "Atlanta Hawks",
      away_team: "Boston Celtics",
      start_time: new Date(Date.now() + 3600000).toISOString(),
      status: "upcoming",
    },
    {
      external_id: "sample-mlb-1",
      sport: "baseball_mlb",
      home_team: "Atlanta Braves",
      away_team: "New York Mets",
      start_time: new Date(Date.now() + 7200000).toISOString(),
      status: "upcoming",
    },
  ];

  for (const game of sampleGames) {
    const { data: insertedGame, error: gameError } = await supabase
      .from("games")
      .insert(game)
      .select()
      .single();

    if (gameError) {
      console.error(`Failed to create game:`, gameError.message);
      continue;
    }

    console.log(
      `Created game: ${game.away_team} @ ${game.home_team}`
    );

    // Add markets for each game
    const markets = [
      {
        game_id: insertedGame.id,
        type: "moneyline",
        name: "Moneyline",
        line: null,
        home_odds: -150,
        away_odds: 130,
        is_live: false,
      },
      {
        game_id: insertedGame.id,
        type: "spread",
        name: "Spread -3.5",
        line: -3.5,
        home_odds: -110,
        away_odds: -110,
        is_live: false,
      },
      {
        game_id: insertedGame.id,
        type: "over_under",
        name: "O/U 45.5",
        line: 45.5,
        home_odds: -110,
        away_odds: -110,
        over_odds: -110,
        under_odds: -110,
        is_live: false,
      },
    ];

    const { error: marketsError } = await supabase
      .from("markets")
      .insert(markets);

    if (marketsError) {
      console.error(`Failed to create markets:`, marketsError.message);
    } else {
      console.log(`  Added 3 markets`);
    }
  }

  console.log("\nSeed complete!");
  console.log("\nLogin credentials:");
  for (const user of USERS) {
    console.log(`  ${user.username} / ${user.password}`);
  }
}

seed().catch(console.error);
