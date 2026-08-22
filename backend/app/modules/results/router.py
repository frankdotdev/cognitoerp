from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.results import service
from app.modules.results.models import GradingScheme, ReportCard
from app.modules.results.schemas import (
    ScoreEntryRequest, CompileReportCardsRequest, PublishReportCardsRequest, ReportCardOut,
    GradingSchemeCreate, GradingSchemeOut,
)

router = APIRouter()


@router.get("/grading-scheme", response_model=GradingSchemeOut | None)
async def get_active_grading_scheme(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.view")),
):
    stmt = select(GradingScheme).where(GradingScheme.school_id == current_user.school_id, GradingScheme.is_active.is_(True))
    return (await db.execute(stmt)).scalar_one_or_none()


@router.post("/grading-scheme", response_model=GradingSchemeOut, status_code=201)
async def set_grading_scheme(
    payload: GradingSchemeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    """
    Deactivates any existing active scheme and creates a new one, rather
    than editing in place — keeps a school's grading-scheme history intact
    (a term graded under an old scheme should stay interpretable under the
    scheme that was active when it was graded, not silently reinterpreted
    if the school changes their grading later).
    """
    existing = (
        await db.execute(select(GradingScheme).where(GradingScheme.school_id == current_user.school_id, GradingScheme.is_active.is_(True)))
    ).scalars().all()
    for row in existing:
        row.is_active = False

    scheme = GradingScheme(school_id=current_user.school_id, created_by=current_user.user_id, **payload.model_dump())
    db.add(scheme)
    await db.commit()
    return scheme


@router.get("/report-cards/{student_id}", response_model=list[ReportCardOut])
async def get_student_report_cards(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.view")),
):
    stmt = select(ReportCard).where(ReportCard.school_id == current_user.school_id, ReportCard.student_id == student_id)
    return (await db.execute(stmt)).scalars().all()


@router.post("/scores")
async def enter_score(
    payload: ScoreEntryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.enter")),
):
    entry = await service.record_score(
        db, school_id=current_user.school_id, entered_by=current_user.user_id, **payload.model_dump()
    )
    await db.commit()
    return {"status": "recorded", "score_id": str(entry.id)}


@router.post("/report-cards/compile", response_model=list[ReportCardOut])
async def compile_report_cards(
    payload: CompileReportCardsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.publish")),
):
    cards = await service.compile_class_report_cards(
        db, school_id=current_user.school_id, class_name=payload.class_name, term=payload.term
    )
    await db.commit()
    return cards


@router.post("/report-cards/publish")
async def publish_report_cards(
    payload: PublishReportCardsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.publish")),
):
    count = await service.publish_report_cards(db, school_id=current_user.school_id, report_card_ids=payload.report_card_ids)
    await db.commit()
    return {"published": count}


@router.post("/report-cards/{report_card_id}/generate-pdf")
async def generate_pdf(
    report_card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.publish")),
):
    """Generates and stores the PDF (R2), returns a short-lived signed URL to it — the object itself is never public."""
    from app.core.storage import generate_download_url
    object_key = await service.generate_report_card_pdf(db, school_id=current_user.school_id, report_card_id=report_card_id)
    await db.commit()
    return {"download_url": generate_download_url(object_key=object_key)}


from fastapi import File, UploadFile
from app.modules.results.bulk_import import import_results_from_excel


@router.post("/bulk-import")
async def bulk_import_results(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("results.enter")),
):
    """Historical/manual results migration — see results/bulk_import.py for the wide/long format auto-detection."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(422, "Please upload an Excel file (.xlsx).")

    file_bytes = await file.read()
    result = await import_results_from_excel(db, school_id=current_user.school_id, file_bytes=file_bytes, entered_by=current_user.user_id)
    await db.commit()
    return result
