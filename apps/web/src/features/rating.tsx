import { Star } from "lucide-react";
import { getStarSelectionValues } from "../rating";

export function StarRatingInput({ value, onChange }: { value?: number; onChange: (rating: number | undefined) => void }) {
  return (
    <div className="starRating" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <span className="starChoice" key={rating}>
          <span className="starChoiceIcon">
            <Star size={25} />
            <span className="starChoiceFill" style={{ width: `${getStarFillPercent(value, rating)}%` }}><Star size={25} /></span>
          </span>
          {getStarSelectionValues(rating).map((nextRating) => (
            <button type="button" key={nextRating} className={nextRating % 1 === 0 ? "starHitArea right" : "starHitArea left"} aria-label={`${nextRating.toFixed(1)} star${nextRating === 1 ? "" : "s"}`} aria-checked={value === nextRating} role="radio" onClick={() => onChange(value === nextRating ? undefined : nextRating)} />
          ))}
        </span>
      ))}
      {value && <button type="button" className="clearRatingButton" onClick={() => onChange(undefined)}>Clear</button>}
    </div>
  );
}

export function RatingDisplay({ rating, compact = false }: { rating: number; compact?: boolean }) {
  return (
    <span className={compact ? "ratingDisplay compact" : "ratingDisplay"} aria-label={`${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span className="displayStar" key={star}>
          <Star size={compact ? 14 : 17} />
          <span className="displayStarFill" style={{ width: `${getStarFillPercent(rating, star)}%` }}><Star size={compact ? 14 : 17} /></span>
        </span>
      ))}
      {!compact && <span>{rating.toFixed(1)}</span>}
    </span>
  );
}

function getStarFillPercent(value: number | undefined, star: number) {
  if (!value || value <= star - 1) return 0;
  if (value >= star) return 100;
  return 50;
}
