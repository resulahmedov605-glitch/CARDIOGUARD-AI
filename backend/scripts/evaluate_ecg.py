"""Reproducible, limited record-100 annotation comparison; no clinical claim."""
import json

from app.schemas.analysis import AnalysisRequest
from app.services.analysis import analyze
from app.services.ecg import ECGService


def evaluate() -> dict:
    rows = []
    for channel in (0, 1):
        for start in (0, 30, 60, 300, 600, 900, 1200, 1500, 1770):
            result = analyze(AnalysisRequest(record_id="100", channel=channel,
                                            start_seconds=start, duration_seconds=30), ECGService())
            reference = result.reference_comparison
            if reference is None:
                raise RuntimeError("Install official reference annotations with scripts.download_mitbih --annotations")
            rows.append({"channel": channel, "start_seconds": start, "duration_seconds": 30,
                         "detected_count": len(result.detected_peaks), **reference.model_dump(exclude={
                             "source", "reference_sample_indices", "reference_timestamps_seconds"})})
    summaries = []
    for channel in (0, 1):
        subset = [row for row in rows if row["channel"] == channel]
        tp, fp, fn = (sum(row[key] for row in subset) for key in ("true_positives", "false_positives", "false_negatives"))
        summaries.append({"channel": channel, "evaluated_seconds": 270, "true_positives": tp,
                          "false_positives": fp, "false_negatives": fn,
                          "sensitivity": tp / (tp + fn), "positive_predictivity": tp / (tp + fp)})
    return {"record_id": "100", "parameters": AnalysisRequest(record_id="100", duration_seconds=30).model_dump(),
            "scope": "Nine non-overlapping 30-second windows per channel from one record; not clinical validation.",
            "matching": "Chronological one-to-one matching, all reference beats in each requested interval, including edges.",
            "summary": summaries, "windows": rows}


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2))
