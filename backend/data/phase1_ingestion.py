"""Phase 1 ingestion pipeline for NTES and CRS data sources."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from backend.data.crs_parser import CRSParser
from backend.data.ntes_connector import NTESConnector


@dataclass
class IngestionResult:
    """Normalized ingestion result returned by each source."""

    source: str
    timestamp_utc: str
    records_received: int
    records_valid: int
    records_invalid: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "timestamp_utc": self.timestamp_utc,
            "records_received": self.records_received,
            "records_valid": self.records_valid,
            "records_invalid": self.records_invalid,
        }


class Phase1IngestionPipeline:
    """Coordinates ingestion for Phase 1 data sources."""

    def __init__(
        self,
        ntes_connector: NTESConnector | None = None,
        crs_parser: CRSParser | None = None,
    ) -> None:
        self.ntes_connector = ntes_connector or NTESConnector()
        self.crs_parser = crs_parser or CRSParser()

    @staticmethod
    def _now_utc_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    async def ingest_ntes_once(self) -> IngestionResult:
        """Poll NTES once and validate all train states."""
        trains = await self.ntes_connector.poll_ntes()
        valid = sum(1 for t in trains if self.ntes_connector.validate_train_state(t))
        received = len(trains)
        return IngestionResult(
            source="ntes",
            timestamp_utc=self._now_utc_iso(),
            records_received=received,
            records_valid=valid,
            records_invalid=received - valid,
        )

    def ingest_crs_once(self) -> IngestionResult:
        """Load and validate CRS corpus records once."""
        records = self.crs_parser.get_corpus()
        valid = sum(1 for r in records if self.crs_parser.validate_record(r))
        received = len(records)
        return IngestionResult(
            source="crs",
            timestamp_utc=self._now_utc_iso(),
            records_received=received,
            records_valid=valid,
            records_invalid=received - valid,
        )

    async def run_once(self) -> dict[str, Any]:
        """Run one ingestion cycle for all Phase 1 sources."""
        ntes_result, crs_result = await asyncio.gather(
            self.ingest_ntes_once(),
            asyncio.to_thread(self.ingest_crs_once),
        )

        return {
            "phase": 1,
            "pipeline": "data_ingestion",
            "timestamp_utc": self._now_utc_iso(),
            "results": [ntes_result.to_dict(), crs_result.to_dict()],
        }

    @staticmethod
    def persist_snapshot(snapshot: dict[str, Any], output_path: str | Path) -> Path:
        """Persist one ingestion snapshot as JSON."""
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        return output


async def _main() -> None:
    pipeline = Phase1IngestionPipeline()
    snapshot = await pipeline.run_once()
    out = Phase1IngestionPipeline.persist_snapshot(snapshot, "data/phase1_ingestion_snapshot.json")
    print(f"Phase 1 ingestion completed. Snapshot written to: {out}")


if __name__ == "__main__":
    asyncio.run(_main())
