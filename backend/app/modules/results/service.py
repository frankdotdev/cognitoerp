"""
Two responsibilities kept deliberately separate:
  1. record_score — validates a single score against the school's active
     grading scheme BEFORE it's saved (doc 011's "prevent a teacher entering
     85/70 for a CA capped at 20" requirement).
  2. compile_report_card — a batch operation a Class Teacher (or the system,
     on a schedule) runs once all subjects' scores exist for a term. This is
     where class_position is computed, across the WHOLE class at once —
     ranking one student in isolation is meaningless.
"""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.results.models import GradingScheme, ScoreEntry, ReportCard
from app.modules.students.models import Student


async def _get_active_scheme(db: AsyncSession, school_id: uuid.UUID) -> GradingScheme:
    stmt = select(GradingScheme).where(GradingScheme.school_id == school_id, GradingScheme.is_active.is_(True))
    scheme = (await db.execute(stmt)).scalar_one_or_none()
    if scheme is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "This school hasn't configured a grading scheme yet — set one up in Settings first.",
        )
    return scheme


def _grade_for_score(total: float, boundaries: list[dict]) -> str:
    for band in boundaries:
        if band["min"] <= total <= band["max"]:
            return band["grade"]
    return "N/A"


async def record_score(
    db: AsyncSession, *, school_id: uuid.UUID, student_id: uuid.UUID, subject: str, term: str,
    component: str, score: float, entered_by: uuid.UUID,
) -> ScoreEntry:
    scheme = await _get_active_scheme(db, school_id)
    max_for_component = scheme.component_weights.get(component)
    if max_for_component is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"'{component}' isn't part of this school's grading scheme.")
    if not (0 <= score <= max_for_component):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{component} for {subject} is capped at {max_for_component}, got {score}.",
        )

    stmt = pg_insert(ScoreEntry).values(
        id=uuid.uuid4(), school_id=school_id, student_id=student_id, subject=subject,
        term=term, component=component, score=score, entered_by=entered_by,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_score_entry", set_={"score": stmt.excluded.score, "entered_by": stmt.excluded.entered_by}
    )
    await db.execute(stmt)
    result = await db.execute(
        select(ScoreEntry).where(
            ScoreEntry.school_id == school_id, ScoreEntry.student_id == student_id,
            ScoreEntry.subject == subject, ScoreEntry.term == term, ScoreEntry.component == component,
        )
    )
    return result.scalar_one()


async def compile_class_report_cards(
    db: AsyncSession, *, school_id: uuid.UUID, class_name: str, term: str
) -> list[ReportCard]:
    """Compiles report cards for an ENTIRE class at once — ranking requires the full cohort."""
    scheme = await _get_active_scheme(db, school_id)

    students = (
        await db.execute(select(Student).where(Student.school_id == school_id, Student.class_name == class_name))
    ).scalars().all()

    student_averages: list[tuple[Student, dict, float]] = []

    for student in students:
        scores = (
            await db.execute(
                select(ScoreEntry).where(
                    ScoreEntry.school_id == school_id, ScoreEntry.student_id == student.id, ScoreEntry.term == term
                )
            )
        ).scalars().all()

        by_subject: dict[str, dict[str, float]] = {}
        for s in scores:
            by_subject.setdefault(s.subject, {})[s.component] = float(s.score)

        subject_results = {}
        subject_totals = []
        for subject, components in by_subject.items():
            total = sum(components.values())
            grade = _grade_for_score(total, scheme.grade_boundaries)
            subject_results[subject] = {"total": total, "grade": grade}
            subject_totals.append(total)

        overall_average = sum(subject_totals) / len(subject_totals) if subject_totals else 0.0
        student_averages.append((student, subject_results, overall_average))

    # Rank within this class/term, highest average first.
    student_averages.sort(key=lambda row: row[2], reverse=True)

    report_cards = []
    for position, (student, subject_results, overall_average) in enumerate(student_averages, start=1):
        stmt = pg_insert(ReportCard).values(
            id=uuid.uuid4(), school_id=school_id, student_id=student.id, term=term,
            subject_scores=subject_results, overall_average=overall_average, class_position=position,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_report_card_term",
            set_={
                "subject_scores": stmt.excluded.subject_scores,
                "overall_average": stmt.excluded.overall_average,
                "class_position": stmt.excluded.class_position,
            },
        )
        await db.execute(stmt)
        report_cards.append(student.id)

    result = await db.execute(
        select(ReportCard).where(ReportCard.school_id == school_id, ReportCard.student_id.in_(report_cards), ReportCard.term == term)
    )
    return result.scalars().all()


async def generate_report_card_pdf(db: AsyncSession, *, school_id: uuid.UUID, report_card_id: uuid.UUID) -> str:
    """
    Renders the PDF and uploads it to R2, saving the resulting object key
    on the ReportCard row. Requires the card to already be published (doc
    011: nothing generated or shared before the school has explicitly
    reviewed and released it) — generating a PDF of an unpublished card
    would let a printed/downloaded copy leak scores before the school
    intended them to be visible.
    """
    from datetime import datetime, timezone
    from app.modules.results.models import ReportCard
    from app.modules.students.models import Student
    from app.modules.schools.models import School, SchoolTheme
    from app.modules.results.pdf import render_report_card_pdf
    from app.core.storage import upload_bytes, generate_download_url

    card = (
        await db.execute(select(ReportCard).where(ReportCard.id == report_card_id, ReportCard.school_id == school_id))
    ).scalar_one_or_none()
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report card not found.")
    if not card.published:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Publish this report card before generating a PDF.")

    student = (await db.execute(select(Student).where(Student.id == card.student_id))).scalar_one()
    school = (await db.execute(select(School).where(School.id == school_id))).scalar_one()
    theme = (await db.execute(select(SchoolTheme).where(SchoolTheme.school_id == school_id))).scalar_one_or_none()

    logo_download_url = None
    if theme and theme.logo_url:
        logo_download_url = generate_download_url(object_key=theme.logo_url)

    pdf_bytes = render_report_card_pdf(
        school_name=school.name,
        logo_url=logo_download_url,
        primary_color=theme.primary_color if theme else "#0E7C4A",
        student_name=student.full_name,
        admission_number=student.admission_number,
        class_name=student.class_name,
        term=card.term,
        subject_scores=card.subject_scores,
        overall_average=float(card.overall_average),
        class_position=card.class_position,
        attendance_percent=float(card.attendance_percent) if card.attendance_percent is not None else None,
        teacher_comment=card.teacher_comment,
        generated_date=datetime.now(timezone.utc).strftime("%d %B %Y"),
    )

    object_key = upload_bytes(
        school_id=school_id, category="report-cards", filename=f"{student.admission_number}-{card.term}.pdf",
        content=pdf_bytes, content_type="application/pdf",
    )

    card.pdf_url = object_key
    await db.flush()
    return object_key


async def publish_report_cards(db: AsyncSession, *, school_id: uuid.UUID, report_card_ids: list[uuid.UUID]) -> int:
    """
    Explicit publish step — nothing is visible to parents/students until this
    runs, per doc 011 ("nothing is visible until published, so a school can
    review before release"). Triggers the notification pipeline (doc 013)
    once that module exists.
    """
    result = await db.execute(select(ReportCard).where(ReportCard.id.in_(report_card_ids), ReportCard.school_id == school_id))
    cards = result.scalars().all()
    for card in cards:
        card.published = True
        card.published_at = datetime.now(timezone.utc)
    await db.flush()
    return len(cards)
