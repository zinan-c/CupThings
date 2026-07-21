import { Plus } from "lucide-react";

export function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="statCard"><span>{label}</span><strong>{value}</strong></div>;
}

export function EmptyState({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return <section className="emptyState"><h2>{title}</h2><p>{body}</p>{actionLabel && onAction && <button className="primaryButton" onClick={onAction}><Plus size={18} /> {actionLabel}</button>}</section>;
}
