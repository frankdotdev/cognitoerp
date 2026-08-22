"""Students router — the reference pattern (doc 006) every other module's router follows."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.auth.identity_code import generate_identity_code, RolePrefix
from app.modules.schools.models import School
from app.modules.students.models import Student
from app.modules.students.repository import StudentRepository
from app.modules.students.schemas import StudentCreate, StudentUpdate, StudentOut, StudentListParams
from app.shared.schemas import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[StudentOut])
async def list_students(
    params: StudentListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.view")),
):
    repo = StudentRepository(db)
    rows, total = await repo.search(params)
    return PaginatedResponse.build(rows, page=params.page, page_size=params.page_size, total=total)


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.view")),
):
    return await StudentRepository(db).get_by_id(student_id)


@router.post("", response_model=StudentOut, status_code=201)
async def create_student(
    payload: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.create")),
):
    school = (
        await db.execute(
            select(School).where(School.id == current_user.school_id).execution_options(skip_tenant_filter=True)
        )
    ).scalar_one()
    identity_code = await generate_identity_code(
        db, school_code=school.school_code, role=RolePrefix.STUDENT, year=datetime.now().year
    )
    # Admission number: use the school's own official number if they
    # supplied one (real-world requirement — many schools already have a
    # registration-number scheme and shouldn't be forced onto Cognitio's),
    # otherwise auto-generate one the same way identity codes are issued.
    if payload.official_admission_number:
        existing = await db.execute(
            select(Student).where(Student.school_id == current_user.school_id, Student.admission_number == payload.official_admission_number)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "A student with that admission number already exists.")
        admission_number = payload.official_admission_number
    else:
        admission_number = await generate_identity_code(
            db, school_code=school.school_code, role=RolePrefix.ADMISSION, year=datetime.now().year
        )

    student = Student(
        school_id=current_user.school_id,
        identity_code=identity_code,
        admission_number=admission_number,
        created_by=current_user.user_id,
        **payload.model_dump(exclude={"official_admission_number"}),
    )
    saved = await StudentRepository(db).create(student)
    await db.commit()
    return saved


@router.patch("/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: uuid.UUID,
    payload: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.edit")),
):
    repo = StudentRepository(db)
    student = await repo.get_by_id(student_id)
    changes = payload.model_dump(exclude={"version"}, exclude_unset=True)
    updated = await repo.update_with_lock(student, payload.version, **changes)
    updated.updated_by = current_user.user_id
    await db.commit()
    return updated


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.delete")),
):
    repo = StudentRepository(db)
    student = await repo.get_by_id(student_id)
    await repo.soft_delete(student, deleted_by=current_user.user_id)
    await db.commit()


from fastapi import File, UploadFile
from app.modules.students.bulk_import import import_students_from_excel


@router.post("/bulk-import")
async def bulk_import_students(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.create")),
):
    """
    Upload an .xlsx roster — column headers are auto-mapped (doc 006), rows
    that fail validation are skipped with a reason rather than failing the
    whole import. This is the single highest-leverage onboarding feature
    per the original competitive research: a school migrating from Excel
    should be live in an hour, not a week of manual re-entry.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(422, "Please upload an Excel file (.xlsx).")

    file_bytes = await file.read()
    school = (await db.execute(select(School).where(School.id == current_user.school_id))).scalar_one()

    result = await import_students_from_excel(
        db,
        school_id=current_user.school_id,
        school_code=school.school_code,
        file_bytes=file_bytes,
        created_by=current_user.user_id,
    )
    await db.commit()
    return result


from datetime import date as date_type
from fastapi import Response
from app.modules.students import lifecycle
from app.modules.students import transcript as transcript_module


class StudentExitRequest(BaseModel):
    new_status: str  # graduated | withdrawn | suspended | transferred | deceased
    exit_date: date_type
    exit_reason: str | None = None


@router.post("/{student_id}/exit", response_model=StudentOut)
async def process_exit(
    student_id: uuid.UUID,
    payload: StudentExitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.edit")),
):
    """
    Graduation, transfer, withdrawal, suspension, or death — the real
    lifecycle events a student register lives through. Revokes login
    access; never deletes any record. See students/lifecycle.py.
    """
    student = await lifecycle.process_student_exit(
        db, school_id=current_user.school_id, student_id=student_id,
        new_status=payload.new_status, exit_date=payload.exit_date, exit_reason=payload.exit_reason,
    )
    await db.commit()
    return student


@router.post("/{student_id}/reactivate", response_model=StudentOut)
async def reactivate(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.edit")),
):
    student = await lifecycle.reactivate_student(db, school_id=current_user.school_id, student_id=student_id)
    await db.commit()
    return student


@router.get("/{student_id}/transcript.pdf")
async def download_transcript_pdf(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.view")),
):
    """The portable, printable record — see students/transcript.py's docstring on why this exists."""
    pdf_bytes = await transcript_module.generate_transcript_pdf(db, school_id=current_user.school_id, student_id=student_id)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "inline; filename=transcript.pdf"})


@router.get("/{student_id}/export")
async def download_portable_export(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.view")),
):
    """The machine-readable counterpart — same data, structured for a future school's import tooling."""
    return await transcript_module.generate_portable_export(db, school_id=current_user.school_id, student_id=student_id)


class PhotoUploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class PhotoConfirmRequest(BaseModel):
    object_key: str


@router.post("/{student_id}/photo/upload-url")
async def request_photo_upload_url(
    student_id: uuid.UUID,
    payload: PhotoUploadUrlRequest,
    current_user: CurrentUser = Depends(require_permission("students.edit")),
):
    """Same two-step presigned-upload pattern as school branding assets (schools/storage_router.py) — targeted at a student's own photo."""
    from app.core.storage import generate_upload_url
    return generate_upload_url(school_id=current_user.school_id, category="student-photos", filename=payload.filename, content_type=payload.content_type)


@router.post("/{student_id}/photo/confirm", response_model=StudentOut)
async def confirm_photo_upload(
    student_id: uuid.UUID,
    payload: PhotoConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.edit")),
):
    from app.core.storage import object_belongs_to_school
    if not object_belongs_to_school(object_key=payload.object_key, school_id=current_user.school_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That file doesn't belong to your school.")

    student = await StudentRepository(db).get_by_id(student_id)
    student.photo_url = payload.object_key
    await db.commit()
    return student
