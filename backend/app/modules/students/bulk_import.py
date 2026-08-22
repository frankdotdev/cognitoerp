"""
Bulk student import from Excel (doc 006's single highest-leverage feature
per the competitive research — schools fear losing data when switching
systems, and a school that can go from a spreadsheet to a working roster
in minutes, not days, is the whole pitch).

Design:
  1. Column auto-mapping — a registrar's spreadsheet header row rarely
     matches our field names exactly ("Student Name" vs "Full Name" vs
     "Name"). _COLUMN_ALIASES maps common variants to the real field.
  2. Row-by-row validation that CONTINUES on error rather than failing the
     whole import — a school with 400 students and 3 malformed rows should
     get 397 students imported and a clear list of what to fix, not a
     single stack trace and nothing imported.
  3. Identity codes and admission numbers are generated per valid row,
     sequentially, inside one transaction — this reuses the exact same
     generate_identity_code() function (and its row-level locking) that
     single-student creation uses, so a bulk import can never produce
     colliding codes with each other OR with students added one at a time
     before/after the import.
  4. Synchronous for now, not a Celery background task — capped at
     _MAX_ROWS (2,000, comfortably above any single Nigerian school's
     roll) to keep worst-case request time bounded. A school large enough
     to exceed that cap is an Enterprise/multi-campus case that warrants
     revisiting this as an async job with a progress/status endpoint
     rather than scaling the synchronous path further — noted here rather
     than silently built as if it already handles that case.
"""
import io
import uuid
from datetime import date, datetime

import openpyxl
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.identity_code import generate_identity_code, RolePrefix
from app.modules.students.models import Student

_MAX_ROWS = 2000

_COLUMN_ALIASES: dict[str, list[str]] = {
    "full_name": ["full name", "student name", "name", "fullname"],
    "class_name": ["class", "class name", "classname"],
    "section": ["section", "arm"],
    "date_of_birth": ["date of birth", "dob", "birthdate", "birth date"],
    "gender": ["gender", "sex"],
    "admission_date": ["admission date", "date of admission", "enrolled date"],
    "guardian_name": ["guardian name", "parent name", "father's name", "father name"],
    "guardian_phone": ["guardian phone", "parent phone", "phone", "phone number"],
    "guardian_email": ["guardian email", "parent email", "email"],
}


def _normalize_header(header: str) -> str:
    return str(header).strip().lower()


def _map_headers(header_row: list) -> dict[int, str]:
    """Returns {column_index: field_name} for every header we recognize — unrecognized columns are ignored, not errors."""
    mapping: dict[int, str] = {}
    for idx, raw_header in enumerate(header_row):
        if raw_header is None:
            continue
        normalized = _normalize_header(raw_header)
        for field, aliases in _COLUMN_ALIASES.items():
            if normalized in aliases or normalized == field:
                mapping[idx] = field
                break
    return mapping


def _parse_date_cell(value) -> date | None:
    """Excel dates can arrive as datetime objects (openpyxl parses them) or as plain strings — handle both."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
    return None


async def import_students_from_excel(
    db: AsyncSession, *, school_id: uuid.UUID, school_code: str, file_bytes: bytes, created_by: uuid.UUID
) -> dict:
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That doesn't look like a valid Excel file (.xlsx).")

    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The file is empty.")

    header_row, *data_rows = rows
    column_map = _map_headers(list(header_row))

    if "full_name" not in column_map.values():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Couldn't find a name column — make sure one column is headed 'Full Name', 'Student Name', or similar.",
        )

    if len(data_rows) > _MAX_ROWS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"This file has {len(data_rows)} rows — imports are capped at {_MAX_ROWS} at a time. Split it into smaller files.",
        )

    created_count = 0
    errors: list[dict] = []
    current_year = datetime.now().year

    for row_num, row in enumerate(data_rows, start=2):  # row 1 is the header
        if row is None or all(cell is None for cell in row):
            continue  # skip fully blank rows rather than erroring on them

        record: dict = {}
        for col_idx, field in column_map.items():
            if col_idx < len(row):
                record[field] = row[col_idx]

        full_name = str(record.get("full_name") or "").strip()
        class_name = str(record.get("class_name") or "").strip()

        if not full_name:
            errors.append({"row": row_num, "reason": "Missing student name"})
            continue
        if not class_name:
            errors.append({"row": row_num, "reason": f"'{full_name}' — missing class"})
            continue

        admission_date = _parse_date_cell(record.get("admission_date")) or date.today()

        try:
            identity_code = await generate_identity_code(db, school_code=school_code, role=RolePrefix.STUDENT, year=current_year)
            admission_number = await generate_identity_code(db, school_code=school_code, role=RolePrefix.ADMISSION, year=current_year)
        except Exception:
            errors.append({"row": row_num, "reason": f"'{full_name}' — couldn't generate an ID for this row"})
            continue

        student = Student(
            school_id=school_id,
            identity_code=identity_code,
            admission_number=admission_number,
            full_name=full_name,
            class_name=class_name,
            section=str(record["section"]).strip() if record.get("section") else None,
            date_of_birth=_parse_date_cell(record.get("date_of_birth")),
            gender=str(record["gender"]).strip().lower() if record.get("gender") else None,
            admission_date=admission_date,
            guardian_name=str(record["guardian_name"]).strip() if record.get("guardian_name") else None,
            guardian_phone=str(record["guardian_phone"]).strip() if record.get("guardian_phone") else None,
            guardian_email=str(record["guardian_email"]).strip() if record.get("guardian_email") else None,
            created_by=created_by,
        )
        db.add(student)
        created_count += 1

    await db.flush()

    return {
        "total_rows": len(data_rows),
        "created": created_count,
        "skipped": len(errors),
        "errors": errors[:100],  # cap the error list in the response — the summary counts stay accurate either way
    }
