import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { CupThingCategory, ReviewResponse } from "@cupthings/shared";
import { categoryOptions } from "../../constants";
import { formatDate, startOfLocalDayIso, endOfLocalDayIso, todayDateInputValue } from "../../date";
import { getReview } from "../../api";
import { RecordList } from "../records/RecordList";
import { EmptyState, StatCard } from "../../shared/Feedback";

export function ReviewView({ onOpen }: { onOpen: (id: string) => void }) {
  const [from, setFrom] = useState(todayDateInputValue());
  const [to, setTo] = useState(todayDateInputValue());
  const [category, setCategory] = useState<"" | CupThingCategory>("");
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const requestIdRef = useRef(0);

  async function loadReview() {
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    requestRef.current = { controller, id: requestId };
    setLoading(true);
    setError("");
    try {
      const result = await getReview(startOfLocalDayIso(from), endOfLocalDayIso(to), category || undefined, { signal: controller.signal });
      if (requestRef.current?.id === requestId) setReview(result);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Could not load review");
    } finally {
      if (requestRef.current?.id === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    void loadReview();
    return () => requestRef.current?.controller.abort();
  }, []);

  return (
    <section className="viewStack">
      <div className="filters">
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value as "" | CupThingCategory)}><option value="">All</option>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="primaryButton" onClick={loadReview} disabled={loading}><CalendarDays size={18} /> Review</button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading review...</p>}
      {review && <>
        <div className="statsGrid">
          <StatCard label="Total records" value={String(review.stats.totalCount)} />
          {category && <StatCard label="Average rating" value={review.stats.averageRating == null ? "None" : review.stats.averageRating.toFixed(1)} />}
          {categoryOptions.map(([item, label]) => <StatCard key={item} label={label} value={String(review.stats.countByCategory[item])} />)}
        </div>
        {review.records.length ? <RecordList records={review.records} onOpen={onOpen} /> : <EmptyState title="No records in this period" body={`${formatDate(startOfLocalDayIso(from))} to ${formatDate(endOfLocalDayIso(to))} has no CupThings yet.`} />}
      </>}
    </section>
  );
}
