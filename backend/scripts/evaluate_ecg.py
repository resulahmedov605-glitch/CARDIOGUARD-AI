"""Reproducible, limited record-100 annotation comparison; no clinical claim."""
import argparse
import json
import math

from app.schemas.analysis import AnalysisRequest
from app.services.analysis import analyze
from app.services.ecg import ECGService


def evaluate(full_record: bool = False) -> dict:
    service = ECGService()
    duration = service.metadata("100").duration_seconds
    starts = range(0, math.ceil(duration), 30) if full_record else (0, 30, 60, 300, 600, 900, 1200, 1500, 1770)
    rows = []
    for channel in (0, 1):
        for start in starts:
            window_duration = min(30, duration - start)
            result = analyze(AnalysisRequest(record_id="100", channel=channel,
                                            start_seconds=start, duration_seconds=window_duration), service)
            reference = result.reference_comparison
            if reference is None:
                raise RuntimeError("Install official reference annotations with scripts.download_mitbih --annotations")
            rows.append({"channel": channel, "start_seconds": start, "duration_seconds": window_duration,
                         "detected_count": len(result.detected_peaks), **reference.model_dump(exclude={
                             "source", "reference_sample_indices", "reference_timestamps_seconds"})})
    summaries = []
    for channel in (0, 1):
        subset = [row for row in rows if row["channel"] == channel]
        tp, fp, fn = (sum(row[key] for row in subset) for key in ("true_positives", "false_positives", "false_negatives"))
        summaries.append({"channel": channel, "evaluated_seconds": sum(row["duration_seconds"] for row in subset), "true_positives": tp,
                          "false_positives": fp, "false_negatives": fn,
                          "sensitivity": tp / (tp + fn), "positive_predictivity": tp / (tp + fp)})
    return {"record_id": "100", "parameters": AnalysisRequest(record_id="100", duration_seconds=30).model_dump(),
            "scope": ("Whole record in consecutive, non-overlapping windows of at most 30 seconds per channel; not clinical validation."
                      if full_record else "Nine non-overlapping 30-second windows per channel from one record; not clinical validation."),
            "matching": "Chronological one-to-one matching, all reference beats in each requested interval, including edges.",
            "summary": summaries, "windows": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full-record", action="store_true", help="Evaluate all of record 100 in consecutive windows")
    print(json.dumps(evaluate(parser.parse_args().full_record), indent=2))
