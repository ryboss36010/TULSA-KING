"use client";

import { useState } from "react";
import SportIcon from "./SportIcon";

interface TeamLogoProps {
  teamName: string;
  sport: string;
  className?: string;
}

// NFL team name → logo filename
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

// NBA team name → logo filename
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

// NHL team name → logo filename
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

// NCAA team name → logo filename (covers both NCAAF and NCAAB — same logos)
const NCAA_TEAMS: Record<string, string> = {
  // Major programs — handles common Odds API name variants
  "Alabama Crimson Tide": "alabama", "Alabama": "alabama",
  "Ohio State Buckeyes": "ohio-state", "Ohio State": "ohio-state",
  "Georgia Bulldogs": "georgia", "Georgia": "georgia",
  "Michigan Wolverines": "michigan", "Michigan": "michigan",
  "Clemson Tigers": "clemson", "Clemson": "clemson",
  "Texas Longhorns": "texas", "Texas": "texas",
  "LSU Tigers": "lsu", "LSU": "lsu",
  "Oklahoma Sooners": "oklahoma", "Oklahoma": "oklahoma",
  "USC Trojans": "usc", "USC": "usc",
  "Penn State Nittany Lions": "penn-state", "Penn State": "penn-state",
  "Florida Gators": "florida", "Florida": "florida",
  "Oregon Ducks": "oregon", "Oregon": "oregon",
  "Notre Dame Fighting Irish": "notre-dame", "Notre Dame": "notre-dame",
  "Auburn Tigers": "auburn", "Auburn": "auburn",
  "Tennessee Volunteers": "tennessee", "Tennessee": "tennessee",
  "Michigan State Spartans": "michigan-state", "Michigan State": "michigan-state",
  "Wisconsin Badgers": "wisconsin", "Wisconsin": "wisconsin",
  "Miami Hurricanes": "miami-fl", "Miami (FL)": "miami-fl", "Miami FL": "miami-fl",
  "Florida State Seminoles": "florida-state", "Florida State": "florida-state",
  "Texas A&M Aggies": "texas-am", "Texas A&M": "texas-am",
  "Iowa Hawkeyes": "iowa", "Iowa": "iowa",
  "Washington Huskies": "washington", "Washington": "washington",
  "Oklahoma State Cowboys": "oklahoma-state", "Oklahoma State": "oklahoma-state",
  "Ole Miss Rebels": "ole-miss", "Ole Miss": "ole-miss",
  "Nebraska Cornhuskers": "nebraska", "Nebraska": "nebraska",
  "NC State Wolfpack": "nc-state", "NC State": "nc-state",
  "North Carolina Tar Heels": "north-carolina", "North Carolina": "north-carolina", "UNC": "north-carolina",
  "Baylor Bears": "baylor", "Baylor": "baylor",
  "Utah Utes": "utah", "Utah": "utah",
  "Arkansas Razorbacks": "arkansas", "Arkansas": "arkansas",
  "Arizona State Sun Devils": "arizona-state", "Arizona State": "arizona-state",
  "Colorado Buffaloes": "colorado", "Colorado": "colorado",
  "Kentucky Wildcats": "kentucky", "Kentucky": "kentucky",
  "Mississippi State Bulldogs": "mississippi-state", "Mississippi State": "mississippi-state",
  "Pittsburgh Panthers": "pittsburgh", "Pittsburgh": "pittsburgh", "Pitt": "pittsburgh",
  "West Virginia Mountaineers": "west-virginia", "West Virginia": "west-virginia",
  "Stanford Cardinal": "stanford", "Stanford": "stanford",
  "Kansas Jayhawks": "kansas", "Kansas": "kansas",
  "Kansas State Wildcats": "kansas-state", "Kansas State": "kansas-state",
  "Iowa State Cyclones": "iowa-state", "Iowa State": "iowa-state",
  "Minnesota Golden Gophers": "minnesota", "Minnesota": "minnesota",
  "Indiana Hoosiers": "indiana", "Indiana": "indiana",
  "South Carolina Gamecocks": "south-carolina", "South Carolina": "south-carolina",
  "Maryland Terrapins": "maryland", "Maryland": "maryland",
  "Texas Tech Red Raiders": "texas-tech", "Texas Tech": "texas-tech",
  "Louisville Cardinals": "louisville", "Louisville": "louisville",
  "Duke Blue Devils": "duke", "Duke": "duke",
  "BYU Cougars": "byu", "BYU": "byu",
  "Cincinnati Bearcats": "cincinnati", "Cincinnati": "cincinnati",
  "UCF Knights": "ucf", "UCF": "ucf",
  "TCU Horned Frogs": "tcu", "TCU": "tcu",
  "Purdue Boilermakers": "purdue", "Purdue": "purdue",
  "Illinois Fighting Illini": "illinois", "Illinois": "illinois",
  "Oregon State Beavers": "oregon-state", "Oregon State": "oregon-state",
  "Washington State Cougars": "washington-state", "Washington State": "washington-state",
  "Georgia Tech Yellow Jackets": "georgia-tech", "Georgia Tech": "georgia-tech",
  "Boston College Eagles": "boston-college", "Boston College": "boston-college",
  "Wake Forest Demon Deacons": "wake-forest", "Wake Forest": "wake-forest",
  "Virginia Cavaliers": "virginia", "Virginia": "virginia",
  "Syracuse Orange": "syracuse", "Syracuse": "syracuse",
  "Rutgers Scarlet Knights": "rutgers", "Rutgers": "rutgers",
  "Northwestern Wildcats": "northwestern", "Northwestern": "northwestern",
  "Arizona Wildcats": "arizona", "Arizona": "arizona",
  "California Golden Bears": "california", "California": "california", "Cal": "california",
  "Missouri Tigers": "missouri", "Missouri": "missouri",
  "Vanderbilt Commodores": "vanderbilt", "Vanderbilt": "vanderbilt",
  "SMU Mustangs": "smu", "SMU": "smu",
  "Houston Cougars": "houston",
  "Army Black Knights": "army", "Army": "army",
  "Navy Midshipmen": "navy", "Navy": "navy",
  "Air Force Falcons": "air-force", "Air Force": "air-force",
  "Memphis Tigers": "memphis", "Memphis": "memphis",
  "Tulane Green Wave": "tulane", "Tulane": "tulane",
  // NCAAB-specific
  "Gonzaga Bulldogs": "gonzaga", "Gonzaga": "gonzaga",
  "UConn Huskies": "uconn", "UConn": "uconn", "Connecticut": "uconn",
  "Villanova Wildcats": "villanova", "Villanova": "villanova",
  "UCLA Bruins": "ucla", "UCLA": "ucla",
  "Creighton Bluejays": "creighton", "Creighton": "creighton",
  "Marquette Golden Eagles": "marquette", "Marquette": "marquette",
  "St. John's Red Storm": "st-johns", "St. John's": "st-johns",
  "Providence Friars": "providence", "Providence": "providence",
  "Seton Hall Pirates": "seton-hall", "Seton Hall": "seton-hall",
  "Xavier Musketeers": "xavier", "Xavier": "xavier",
  "Butler Bulldogs": "butler", "Butler": "butler",
  "Dayton Flyers": "dayton", "Dayton": "dayton",
  "San Diego State Aztecs": "san-diego-state", "San Diego State": "san-diego-state", "SDSU": "san-diego-state",
  "Boise State Broncos": "boise-state", "Boise State": "boise-state",
  "Nevada Wolf Pack": "nevada", "Nevada": "nevada",
  "New Mexico Lobos": "new-mexico", "New Mexico": "new-mexico",
  "Colorado State Rams": "colorado-state", "Colorado State": "colorado-state",
  "Wyoming Cowboys": "wyoming", "Wyoming": "wyoming",
  "Fresno State Bulldogs": "fresno-state", "Fresno State": "fresno-state",
  "Utah State Aggies": "utah-state", "Utah State": "utah-state",
  "UNLV Rebels": "unlv", "UNLV": "unlv",
};

function getLogoPath(teamName: string, sport: string): string | null {
  if (sport.startsWith("americanfootball_nfl") || sport.includes("super_bowl")) {
    const abbr = NFL_TEAMS[teamName];
    return abbr ? `/logos/nfl/${abbr}.png` : null;
  }
  if (sport.startsWith("basketball_nba") || sport.includes("nba_championship")) {
    const abbr = NBA_TEAMS[teamName];
    return abbr ? `/logos/nba/${abbr}.png` : null;
  }
  if (sport.startsWith("icehockey_nhl") || sport.includes("nhl_championship")) {
    const abbr = NHL_TEAMS[teamName];
    return abbr ? `/logos/nhl/${abbr}.png` : null;
  }
  if (sport.startsWith("americanfootball_ncaaf") || sport.includes("ncaaf_championship")) {
    const file = NCAA_TEAMS[teamName];
    return file ? `/logos/ncaaf/${file}.png` : null;
  }
  if (sport.startsWith("basketball_ncaab")) {
    const file = NCAA_TEAMS[teamName];
    return file ? `/logos/ncaab/${file}.png` : null;
  }
  return null;
}

export default function TeamLogo({ teamName, sport, className = "w-5 h-5" }: TeamLogoProps) {
  const [imgError, setImgError] = useState(false);
  const logoPath = getLogoPath(teamName, sport);

  if (!logoPath || imgError) {
    return <SportIcon sport={sport} className={className} />;
  }

  return (
    <img
      src={logoPath}
      alt={teamName}
      className={`${className} object-contain`}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  );
}
