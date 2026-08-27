"""Tabular (CSV) ingestion for the NLP service.

Parses delimited files into rows, classifies columns (numeric / datetime /
text / categorical), suggests free-text columns for analysis, and builds
row-indexed analysis units with provenance (rowIndex + columnName).

Design decisions (WP-1 spec, .kilocode/work-packages/wp-1-csv-analysis.md):
* stdlib csv + csv.Sniffer over the candidate delimiters , ; \\t |
* encoding ladder: utf-8-sig (BOM) -> utf-8 -> latin-1 (reported, never fails)
* ragged rows are rejected with the 1-based record number ("Excel row")
* rowIndex/columnName use Excel-style record numbers: header = row 1
* caps: MAX_CSV_ROWS rows, MAX_CELL_CHARS per cell, MAX_UNITS evidence units
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple

MAX_CSV_ROWS = 5_000
MAX_CELL_CHARS = 1_000
MAX_UNITS = 2_000
MIN_UNIT_CHARS = 15

_CANDIDATE_DELIMITERS = [",", ";", "\t", "|"]

_DATE_PATTERNS = [
    re.compile(r"^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?Z?$"),
    re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4}$"),
    re.compile(r"^\d{1,2}-\d{1,2}-\d{2,4}$"),
    re.compile(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}$", re.I),
]


class TabularError(ValueError):
    """Raised for structural CSV problems; message cites the 1-based row."""


@dataclass
class RawTable:
    header: List[str]
    rows: List[List[str]]
    delimiter: str
    encoding: str
    truncated: bool
    total_data_rows: int  # before the cap was applied


@dataclass
class ColumnMeta:
    index: int
    name: str
    type: str  # "numeric" | "datetime" | "text" | "categorical"
    meanLength: float
    distinctRatio: float
    alphaRatio: float
    emptyRatio: float
    isText: bool


@dataclass
class AnalysisUnit:
    text: str
    rowIndex: int  # Excel-style record number (header = row 1)
    columnName: str

    def as_dict(self) -> Dict[str, object]:
        return {"text": self.text, "rowIndex": self.rowIndex, "columnName": self.columnName}


def _decode(content: bytes) -> Tuple[str, str]:
    """Encoding ladder. Returns (text, encoding-name)."""
    if content.startswith(b"\xef\xbb\xbf"):
        return content.decode("utf-8-sig"), "utf-8-sig"
    try:
        return content.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        return content.decode("latin-1"), "latin-1"


def _sniff_delimiter(text: str) -> str:
    sample = "\n".join(text.splitlines()[:50])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters="".join(_CANDIDATE_DELIMITERS))
        if dialect.delimiter in _CANDIDATE_DELIMITERS:
            return dialect.delimiter
    except csv.Error:
        pass
    # Fallback: candidate occurring most often in the header line wins.
    header = next((ln for ln in text.splitlines() if ln.strip()), "")
    counts = {d: header.count(d) for d in _CANDIDATE_DELIMITERS}
    best = max(counts.values(), default=0)
    if best > 0:
        for d in _CANDIDATE_DELIMITERS:
            if counts[d] == best:
                return d
    return ","


def _dedupe_header(header: List[str]) -> List[str]:
    """Stable names: strip blanks, deduplicate case-insensitively with suffixes."""
    seen: Dict[str, int] = {}
    out: List[str] = []
    for i, raw in enumerate(header):
        name = (raw or "").strip() or f"column_{i + 1}"
        key = name.lower()
        seen[key] = seen.get(key, 0) + 1
        out.append(name if seen[key] == 1 else f"{name} ({seen[key]})")
    return out


def read_tabular(content: bytes) -> RawTable:
    text, encoding = _decode(content)
    delimiter = _sniff_delimiter(text)

    rows_iter = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header_record = next(rows_iter, None)
    except csv.Error as e:
        raise TabularError(f"Could not parse CSV header: {e}") from e
    if header_record is None or not any((c or "").strip() for c in header_record):
        raise TabularError("File is empty or has no header row")

    width = len(header_record)
    data_rows: List[List[str]] = []
    truncated = False
    total_data_rows = 0
    for record_num, record in enumerate(rows_iter, start=2):  # Excel row numbers
        if all(not (c or "").strip() for c in record):
            continue  # blank line
        if len(record) != width:
            raise TabularError(
                f"Malformed row {record_num}: {len(record)} fields, expected {width}"
            )
        total_data_rows += 1
        if len(data_rows) >= MAX_CSV_ROWS:
            truncated = True
            continue
        data_rows.append([(c or "")[:MAX_CELL_CHARS] for c in record])

    return RawTable(
        header=_dedupe_header(header_record),
        rows=data_rows,
        delimiter=delimiter,
        encoding=encoding,
        truncated=truncated,
        total_data_rows=total_data_rows,
    )


def _looks_numeric(cell: str) -> bool:
    t = cell.replace(",", "").replace("%", "").strip()
    if not t:
        return False
    try:
        float(t)
        return True
    except ValueError:
        return False


def _looks_datetime(cell: str) -> bool:
    return any(p.match(cell.strip()) for p in _DATE_PATTERNS)


def classify_columns(table: RawTable) -> List[ColumnMeta]:
    """Score each column over up to 1,000 data rows; suggest text columns."""
    sample = table.rows[:1000]
    n = len(sample)
    metas: List[ColumnMeta] = []
    for idx, name in enumerate(table.header):
        cells = [(row[idx] if idx < len(row) else "").strip() for row in sample]
        non_empty = [c for c in cells if c]
        count = len(non_empty)
        if count == 0:
            metas.append(ColumnMeta(idx, name, "categorical", 0.0, 0.0, 0.0, 1.0, False))
            continue
        mean_length = sum(len(c) for c in non_empty) / count
        distinct_ratio = len({c for c in non_empty}) / count
        alpha_ratio = sum(
            sum(ch.isalpha() for ch in c) / max(len(c), 1) for c in non_empty
        ) / count
        numeric_ratio = sum(1 for c in non_empty if _looks_numeric(c)) / count
        datetime_ratio = sum(1 for c in non_empty if _looks_datetime(c)) / count
        empty_ratio = 1.0 - count / max(n, 1)

        is_text = (
            mean_length >= 25
            and alpha_ratio >= 0.70
            and distinct_ratio >= 0.50
            and datetime_ratio < 0.50
            and numeric_ratio < 0.50
        )
        if is_text:
            col_type = "text"
        elif numeric_ratio >= 0.90:
            col_type = "numeric"
        elif datetime_ratio >= 0.80:
            col_type = "datetime"
        else:
            col_type = "categorical"
        metas.append(
            ColumnMeta(
                index=idx,
                name=name,
                type=col_type,
                meanLength=round(mean_length, 1),
                distinctRatio=round(distinct_ratio, 3),
                alphaRatio=round(alpha_ratio, 3),
                emptyRatio=round(empty_ratio, 3),
                isText=is_text,
            )
        )
    return metas


def suggested_text_columns(metas: List[ColumnMeta]) -> List[int]:
    """Text columns ordered by mean length (longest first = richest first)."""
    return [m.index for m in sorted(metas, key=lambda m: -m.meanLength) if m.isText]


def build_units(
    table: RawTable, text_column_indices: List[int]
) -> Tuple[List[AnalysisUnit], int]:
    """One unit per data row: selected cells joined with '; '.

    Cells shorter than MIN_UNIT_CHARS are skipped (counted); a row whose every
    selected cell is skipped yields no unit. rowIndex is the Excel-style record
    number (header = row 1).
    """
    if not text_column_indices:
        raise TabularError(
            "No free-text column detected or selected; pick at least one response column"
        )
    valid_idx = [i for i in text_column_indices if 0 <= i < len(table.header)]
    if not valid_idx:
        raise TabularError("Selected text columns are out of range")
    column_names = [table.header[i] for i in valid_idx]
    joined_name = "; ".join(column_names)

    units: List[AnalysisUnit] = []
    skipped = 0
    for row_num, row in enumerate(table.rows, start=2):
        parts: List[str] = []
        for i in valid_idx:
            cell = (row[i] if i < len(row) else "").strip()
            if len(cell) >= MIN_UNIT_CHARS:
                parts.append(cell[:MAX_CELL_CHARS])
            else:
                # Includes empty cells: all skipped material is disclosed.
                skipped += 1
        if parts:
            units.append(AnalysisUnit("; ".join(parts), row_num, joined_name))
    if not units:
        raise TabularError(
            "Selected columns contain no response text long enough to analyze"
        )
    kept = units[:MAX_UNITS]
    dropped_by_cap = len(units) - len(kept)
    return kept, skipped + dropped_by_cap
