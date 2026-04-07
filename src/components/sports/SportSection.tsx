import type { Game, Market } from "@/lib/types";
import { SPORT_LABELS } from "@/lib/types";
import GameCard from "./GameCard";

interface SportSectionProps {
  sport: string;
  games: Game[];
  markets: Market[];
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function SportSection({
  sport,
  games,
  markets,
  onSelectBet,
}: SportSectionProps) {
  if (games.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-white px-1">
        {SPORT_LABELS[sport] || sport}
      </h2>
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          markets={markets.filter((m) => m.game_id === game.id)}
          onSelectBet={onSelectBet}
        />
      ))}
    </section>
  );
}
