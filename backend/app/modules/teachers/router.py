"""Teachers router — same CRUD pattern as Students (doc 006), plus class assignment."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.auth.identity_code import generate_identity_code, RolePrefix
from app.modules.schools.models import School
from app.modules.teachers.models import Teacher, TeacherClassAssignment
from app.modules.teachers.repository import TeacherRepository
from app.modules.teachers.schemas import TeacherCreate, TeacherUpdate, TeacherOut, ClassAssignmentCreate

router = APIRouter()


@router.get("", response_model=list[TeacherOut])
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.view")),
):
    rows, _ = await TeacherRepository(db).paginate(page=1, page_size=100, order_by=Teacher.full_name)
    return rows


@router.post("", response_model=TeacherOut, status_code=201)
async def create_teacher(
    payload: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    school = (await db.execute(select(School).where(School.id == current_user.school_id))).scalar_one()
    identity_code = await generate_identity_code(
        db, school_code=school.school_code, role=RolePrefix.TEACHER, year=datetime.now().year
    )
    teacher = Teacher(
        school_id=current_user.school_id,
        identity_code=identity_code,
        staff_id=identity_code,
        created_by=current_user.user_id,
        **payload.model_dump(),
    )
    saved = await TeacherRepository(db).create(teacher)
    await db.commit()
    return saved


@router.patch("/{teacher_id}", response_model=TeacherOut)
async def update_teacher(
    teacher_id: uuid.UUID,
    payload: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    repo = TeacherRepository(db)
    teacher = await repo.get_by_id(teacher_id)
    changes = payload.model_dump(exclude={"version"}, exclude_unset=True)
    updated = await repo.update_with_lock(teacher, payload.version, **changes)
    await db.commit()
    return updated


@router.get("/me/assignments")
async def my_class_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("attendance.mark")),
):
    """
    A teacher's own class assignments — looked up via their linked Teacher
    record (Teacher.user_id), not via current_user.user_id directly, since
    the Teacher and User rows are separate (see teachers/models.py's
    docstring on why HR/Teacher/User are kept distinct).
    """
    teacher_stmt = select(Teacher).where(Teacher.user_id == current_user.user_id)
    teacher = (await db.execute(teacher_stmt)).scalar_one_or_none()
    if teacher is None:
        return []

    assignments_stmt = select(TeacherClassAssignment).where(TeacherClassAssignment.teacher_id == teacher.id)
    return (await db.execute(assignments_stmt)).scalars().all()


@router.post("/assignments", status_code=201)
async def assign_class(
    payload: ClassAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    assignment = TeacherClassAssignment(school_id=current_user.school_id, **payload.model_dump())
    db.add(assignment)
    await db.commit()
    return {"status": "assigned"}


from pydantic import BaseModel
from app.modules.teachers import service as teacher_service


class OffboardTeacherRequest(BaseModel):
    reason: str = "resigned"  # resigned | terminated | other
    reassign_to_teacher_id: uuid.UUID | None = None


@router.post("/{teacher_id}/offboard")
async def offboard_teacher(
    teacher_id: uuid.UUID,
    payload: OffboardTeacherRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    """
    Revokes the teacher's login immediately (deactivates the account,
    revokes every refresh token — signs them out everywhere), and
    optionally reassigns their class assignments to a named replacement.
    Every record they historically touched (scores entered, attendance
    marked) is left exactly as-is — see teachers/service.py's docstring.
    """
    result = await teacher_service.offboard_teacher(
        db, school_id=current_user.school_id, teacher_id=teacher_id, reason=payload.reason,
        reassign_to_teacher_id=payload.reassign_to_teacher_id,
    )
    await db.commit()
    return result


@router.get("/unassigned-classes")
async def unassigned_classes(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    return await teacher_service.get_unassigned_classes(db, school_id=current_user.school_id)


class TeacherPhotoUploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class TeacherPhotoConfirmRequest(BaseModel):
    object_key: str


@router.post("/{teacher_id}/photo/upload-url")
async def request_teacher_photo_upload_url(
    teacher_id: uuid.UUID,
    payload: TeacherPhotoUploadUrlRequest,
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    from app.core.storage import generate_upload_url
    return generate_upload_url(school_id=current_user.school_id, category="teacher-photos", filename=payload.filename, content_type=payload.content_type)


@router.post("/{teacher_id}/photo/confirm", response_model=TeacherOut)
async def confirm_teacher_photo_upload(
    teacher_id: uuid.UUID,
    payload: TeacherPhotoConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("teachers.edit")),
):
    from app.core.storage import object_belongs_to_school
    if not object_belongs_to_school(object_key=payload.object_key, school_id=current_user.school_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That file doesn't belong to your school.")

    teacher = await TeacherRepository(db).get_by_id(teacher_id)
    teacher.photo_url = payload.object_key
    await db.commit()
    return teacher
