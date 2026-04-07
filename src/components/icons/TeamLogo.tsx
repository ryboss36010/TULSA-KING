"use client";

import { useState } from "react";
import SportIcon from "./SportIcon";

interface TeamLogoProps {
  teamName: string;
  sport: string;
  className?: string;
}

// ESPN logo CDN lookup — maps sport keys to ESPN league slugs and known team abbreviations
const ESPN_LEAGUES: Record<string, { league: string; sport: string }> = {
  americanfootball_nfl: { league: "nfl", sport: "football" },
  americanfootball_ncaaf: { league: "college-football", sport: "football" },
  basketball_nba: { league: "nba", sport: "basketball" },
  basketball_ncaab: { league: "mens-college-basketball", sport: "basketball" },
  baseball_mlb: { league: "mlb", sport: "baseball" },
  icehockey_nhl: { league: "nhl", sport: "hockey" },
  soccer_usa_mls: { league: "usa.1", sport: "soccer" },
  soccer_epl: { league: "eng.1", sport: "soccer" },
  soccer_uefa_champs_league: { league: "uefa.champions", sport: "soccer" },
};

// Known team name → ESPN team ID mappings for reliable logo lookups
// These are the most common teams. For unknown teams, we fall back to sport icon.
const NFL_TEAMS: Record<string, string> = {
  "Arizona Cardinals": "ari", "Atlanta Falcons": "atl", "Baltimore Ravens": "bal",
  "Buffalo Bills": "buf", "Carolina Panthers": "car", "Chicago Bears": "chi",
  "Cincinnati Bengals": "cin", "Cleveland Browns": "cle", "Dallas Cowboys": "dal",
  "Denver Broncos": "den", "Detroit Lions": "det", "Green Bay Packers": "gb",
  "Houston Texans": "hou", "Indianapolis Colts": "ind", "Jacksonville Jaguars": "jax",
  "Kansas City Chiefs": "kc", "Las Vegas Raiders": "lv", "Los Angeles Chargers": "lac",
  "Los Angeles Rams": "lar", "Miami Dolphins": "mia", "Minnesota Vikings": "min",
  "New England Patriots": "ne", "New Orleans Saints": "no", "New York Giants": "nyg",
  "New York Jets": "nyj", "Philadelphia Eagles": "phi", "Pittsburgh Steelers": "pit",
  "San Francisco 49ers": "sf", "Seattle Seahawks": "sea", "Tampa Bay Buccaneers": "tb",
  "Tennessee Titans": "ten", "Washington Commanders": "wsh",
};

const NBA_TEAMS: Record<string, string> = {
  "Atlanta Hawks": "atl", "Boston Celtics": "bos", "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha", "Chicago Bulls": "chi", "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal", "Denver Nuggets": "den", "Detroit Pistons": "det",
  "Golden State Warriors": "gs", "Houston Rockets": "hou", "Indiana Pacers": "ind",
  "Los Angeles Clippers": "lac", "Los Angeles Lakers": "lal", "Memphis Grizzlies": "mem",
  "Miami Heat": "mia", "Milwaukee Bucks": "mil", "Minnesota Timberwolves": "min",
  "New Orleans Pelicans": "no", "New York Knicks": "ny", "Oklahoma City Thunder": "okc",
  "Orlando Magic": "orl", "Philadelphia 76ers": "phi", "Phoenix Suns": "phx",
  "Portland Trail Blazers": "por", "Sacramento Kings": "sac", "San Antonio Spurs": "sa",
  "Toronto Raptors": "tor", "Utah Jazz": "uta", "Washington Wizards": "wsh",
};

const MLB_TEAMS: Record<string, string> = {
  "Arizona Diamondbacks": "ari", "Atlanta Braves": "atl", "Baltimore Orioles": "bal",
  "Boston Red Sox": "bos", "Chicago Cubs": "chc", "Chicago White Sox": "chw",
  "Cincinnati Reds": "cin", "Cleveland Guardians": "cle", "Colorado Rockies": "col",
  "Detroit Tigers": "det", "Houston Astros": "hou", "Kansas City Royals": "kc",
  "Los Angeles Angels": "laa", "Los Angeles Dodgers": "lad", "Miami Marlins": "mia",
  "Milwaukee Brewers": "mil", "Minnesota Twins": "min", "New York Mets": "nym",
  "New York Yankees": "nyy", "Oakland Athletics": "oak", "Philadelphia Phillies": "phi",
  "Pittsburgh Pirates": "pit", "San Diego Padres": "sd", "San Francisco Giants": "sf",
  "Seattle Mariners": "sea", "St. Louis Cardinals": "stl", "Tampa Bay Rays": "tb",
  "Texas Rangers": "tex", "Toronto Blue Jays": "tor", "Washington Nationals": "wsh",
};

const NHL_TEAMS: Record<string, string> = {
  "Anaheim Ducks": "ana", "Arizona Coyotes": "ari", "Boston Bruins": "bos",
  "Buffalo Sabres": "buf", "Calgary Flames": "cgy", "Carolina Hurricanes": "car",
  "Chicago Blackhawks": "chi", "Colorado Avalanche": "col", "Columbus Blue Jackets": "cbj",
  "Dallas Stars": "dal", "Detroit Red Wings": "det", "Edmonton Oilers": "edm",
  "Florida Panthers": "fla", "Los Angeles Kings": "la", "Minnesota Wild": "min",
  "Montreal Canadiens": "mtl", "Nashville Predators": "nsh", "New Jersey Devils": "nj",
  "New York Islanders": "nyi", "New York Rangers": "nyr", "Ottawa Senators": "ott",
  "Philadelphia Flyers": "phi", "Pittsburgh Penguins": "pit", "San Jose Sharks": "sj",
  "Seattle Kraken": "sea", "St. Louis Blues": "stl", "Tampa Bay Lightning": "tb",
  "Toronto Maple Leafs": "tor", "Utah Hockey Club": "uta",
  "Vancouver Canucks": "van", "Vegas Golden Knights": "vgk", "Washington Capitals": "wsh",
  "Winnipeg Jets": "wpg",
};

function getTeamAbbr(teamName: string, sport: string): string | null {
  if (sport.startsWith("americanfootball_nfl")) return NFL_TEAMS[teamName] || null;
  if (sport.startsWith("basketball_nba")) return NBA_TEAMS[teamName] || null;
  if (sport.startsWith("baseball_mlb")) return MLB_TEAMS[teamName] || null;
  if (sport.startsWith("icehockey_nhl")) return NHL_TEAMS[teamName] || null;
  return null;
}

function getLogoUrl(teamName: string, sport: string): string | null {
  const espn = ESPN_LEAGUES[sport];
  if (!espn) return null;

  const abbr = getTeamAbbr(teamName, sport);
  if (!abbr) return null;

  // ESPN CDN logo URL pattern
  if (espn.sport === "soccer") {
    return null; // Soccer team IDs are numeric, skip for now
  }

  return `https://a.espncdn.com/i/teamlogos/${espn.sport}/500/scoreboard/${abbr}.png`;
}

export default function TeamLogo({ teamName, sport, className = "w-5 h-5" }: TeamLogoProps) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = getLogoUrl(teamName, sport);

  if (!logoUrl || imgError) {
    return <SportIcon sport={sport} className={className} />;
  }

  return (
    <img
      src={logoUrl}
      alt={teamName}
      className={`${className} object-contain`}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  );
}
