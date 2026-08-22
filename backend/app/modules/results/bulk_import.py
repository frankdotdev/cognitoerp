"""
Bulk historical results import — "the school should be able to upload all
past results that were done manually or scattered in various Excel files
and everything syncs automatically." Same column-auto-mapping,
continue-on-error design as students/bulk_import.py, matching existing
students by admission number rather than creating new ones.

Supports two real-world spreadsheet shapes, auto-detected:

  - WIDE format (the common case for a school's own gradebook export):
    one row per student, with a pair of columns per subject per
    component — "Mathematics CA1", "Mathematics Exam", "English CA1", etc.
    Subject/component pairs are detected against the school's ACTIVE
    grading scheme's component names, so this only works once a grading
    scheme is configured (same requirement score entry already has).

  - LONG format: one row per (student, subject, component) with explicit
    "Subject", "Component", "Score" columns — matches how a school might
    export from a simpler system.

Every row that can't be matched to an existing student, an unrecognized
component, or an out-of-range score is skipped with a reason, not fatal
to the whole import — identical philosophy to the student roster import.
"""
import io
import uuid
from datetime import datetime

import openpyxl
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.results.models import GradingScheme
from app.modules.results.service import record_score
from app.modules.students.models import Student

_MAX_ROWS = 5000  # historical imports can span years — a higher cap than the roster import

_CORE_ALIASES = {
    "admission_number": ["admission number", "admission no", "admission no.", "reg number", "registration number"],
    "term": ["term", "session/term", "academic term"],
    "subject": ["subject"],
    "component": ["component", "assessment"],
    "score": ["score", "marks", "mark"],
}


def _normalize(h) -> str:
    return str(h).strip().lower() if h is not None else ""


async def _get_active_component_names(db: AsyncSession, school_id: uuid.UUID) -> list[str]:
    scheme = (
        await db.execute(select(GradingScheme).where(GradingScheme.school_id == school_id, GradingScheme.is_active.is_(True)))
    ).scalar_one_or_none()
    if scheme is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Set up a grading scheme (Settings > Grading Scheme) before importing historical results — scores are validated against it.",
        )
    return list(scheme.component_weights.keys())


def _detect_format(headers: list[str], component_names: list[str]) -> tuple[str, dict]:
    """Returns ('long', mapping) or ('wide', mapping) — mapping is column_index -> field or (subject, component)."""
    normalized = [_normalize(h) for h in headers]

    core_map: dict[int, str] = {}
    for idx, h in enumerate(normalized):
        for field, aliases in _CORE_ALIASES.items():
            if h in aliases:
                core_map[idx] = field
                break

    if "subject" in core_map.values() and "score" in core_map.values():
        return "long", core_map

    # Wide format: any column not already core-mapped is checked for a
    # "{Subject} {Component}" pattern against the active scheme's components.
    wide_map: dict[int, tuple[str, str]] = {}
    for idx, raw_header in enumerate(headers):
        if idx in core_map:
            continue
        h = _normalize(raw_header)
        for component in component_names:
            comp_norm = component.lower()
            if h.endswith(comp_norm) and len(h) > len(comp_norm):
                subject = raw_header[: -(len(component))].strip()
                if subject:
                    wide_map[idx] = (subject, component)
                    break
    return "wide", {**core_map, **{k: v for k, v in wide_map.items()}}


async def import_results_from_excel(db: AsyncSession, *, school_id: uuid.UUID, file_bytes: bytes, entered_by: uuid.UUID) -> dict:
    component_names = await _get_active_component_names(db, school_id)

    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That doesn't look like a valid Excel file (.xlsx).")

    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The file is empty.")

    header_row, *data_rows = rows
    headers = list(header_row)
    fmt, column_map = _detect_format(headers, component_names)

    admission_col = next((idx for idx, f in column_map.items() if f == "admission_number"), None)
    term_col = next((idx for idx, f in column_map.items() if f == "term"), None)
    if admission_col is None or term_col is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Couldn't find both an Admission Number column and a Term column — these are required.",
        )

    if len(data_rows) > _MAX_ROWS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"This file has {len(data_rows)} rows — imports are capped at {_MAX_ROWS} at a time.")

    recorded = 0
    errors: list[dict] = []

    for row_num, row in enumerate(data_rows, start=2):
        if row is None or all(cell is None for cell in row):
            continue

        admission_number = str(row[admission_col]).strip() if admission_col < len(row) and row[admission_col] is not None else None
        term = str(row[term_col]).strip() if term_col < len(row) and row[term_col] is not None else None

        if not admission_number or not term:
            errors.append({"row": row_num, "reason": "Missing admission number or term"})
            continue

        student = (
            await db.execute(select(Student).where(Student.school_id == school_id, Student.admission_number == admission_number))
        ).scalar_one_or_none()
        if student is None:
            errors.append({"row": row_num, "reason": f"No student found with admission number '{admission_number}'"})
            continue

        if fmt == "long":
            subject_col = next((idx for idx, f in column_map.items() if f == "subject"), None)
            component_col = next((idx for idx, f in column_map.items() if f == "component"), None)
            score_col = next((idx for idx, f in column_map.items() if f == "score"), None)

            subject = str(row[subject_col]).strip() if subject_col is not None and subject_col < len(row) and row[subject_col] else None
            component = str(row[component_col]).strip() if component_col is not None and component_col < len(row) and row[component_col] else None
            raw_score = row[score_col] if score_col is not None and score_col < len(row) else None

            if not subject or not component or raw_score is None:
                errors.append({"row": row_num, "reason": f"'{admission_number}' — missing subject, component, or score"})
                continue

            try:
                await record_score(db, school_id=school_id, student_id=student.id, subject=subject, term=term, component=component, score=float(raw_score), entered_by=entered_by)
                recorded += 1
            except HTTPException as e:
                errors.append({"row": row_num, "reason": f"'{admission_number}' {subject} — {e.detail}"})
            except (ValueError, TypeError):
                errors.append({"row": row_num, "reason": f"'{admission_number}' — score isn't a number"})

        else:  # wide format — one row can produce many score entries
            for idx, mapping in column_map.items():
                if not isinstance(mapping, tuple):
                    continue
                subject, component = mapping
                raw_score = row[idx] if idx < len(row) else None
                if raw_score is None or raw_score == "":
                    continue  # blank cell for this subject/component — not an error, just nothing to record
                try:
                    await record_score(db, school_id=school_id, student_id=student.id, subject=subject, term=term, component=component, score=float(raw_score), entered_by=entered_by)
                    recorded += 1
                except HTTPException as e:
                    errors.append({"row": row_num, "reason": f"'{admission_number}' {subject} {component} — {e.detail}"})
                except (ValueError, TypeError):
                    errors.append({"row": row_num, "reason": f"'{admission_number}' {subject} {component} — score isn't a number"})

    return {
        "format_detected": fmt,
        "total_rows": len(data_rows),
        "scores_recorded": recorded,
        "skipped": len(errors),
        "errors": errors[:100],
    }
