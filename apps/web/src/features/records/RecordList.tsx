import type { CupThing } from "@cupthings/shared";
import { categoryLabels } from "../../constants";
import { formatDateTime } from "../../date";
import { RatingDisplay } from "../rating";

export function RecordList({ records, onOpen }: { records: CupThing[]; onOpen: (id: string) => void }) {
  return (
    <div className="recordList">
      {records.map((record) => (
        <button className="recordRow" key={record.id} onClick={() => onOpen(record.id)}>
          <span><strong>{record.name}</strong><small>{formatDateTime(record.consumedAt)}</small></span>
          <span className="rowMeta">
            <span className={`pill ${record.category}`}>{categoryLabels[record.category]}</span>
            {record.rating && <RatingDisplay rating={record.rating} compact />}
          </span>
        </button>
      ))}
    </div>
  );
}
