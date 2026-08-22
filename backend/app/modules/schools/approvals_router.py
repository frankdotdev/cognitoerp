"""
Aggregates every pending-approval type across the platform into one feed —
pending parent-child links, purchase requests, and leave requests. Lives
under /schools rather than a new top-level module since it's a read-only
view composed from other modules' tables, not a domain of its own.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.parents.models import ParentStudentLink
from app.modules.inventory.models import PurchaseRequest
from app.modules.hr.models import LeaveRequest

router = APIRouter()


class ApprovalItem(BaseModel):
    id: str
    type: str  # "parent_link" | "purchase_request" | "leave_request"
    summary: str
    created_at: str


@router.get("/me/approvals", response_model=list[ApprovalItem])
async def pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    items: list[ApprovalItem] = []

    links = (
        await db.execute(select(ParentStudentLink).where(ParentStudentLink.school_id == current_user.school_id, ParentStudentLink.status == "pending"))
    ).scalars().all()
    for link in links:
        items.append(ApprovalItem(
            id=str(link.id), type="parent_link",
            summary=f"Parent link request — needs verification",
            created_at=link.created_at.isoformat(),
        ))

    purchases = (
        await db.execute(select(PurchaseRequest).where(PurchaseRequest.school_id == current_user.school_id, PurchaseRequest.status == "pending"))
    ).scalars().all()
    for p in purchases:
        items.append(ApprovalItem(
            id=str(p.id), type="purchase_request",
            summary=f"{p.item_name} × {p.quantity_requested}",
            created_at=p.created_at.isoformat(),
        ))

    leaves = (
        await db.execute(select(LeaveRequest).where(LeaveRequest.school_id == current_user.school_id, LeaveRequest.status == "pending"))
    ).scalars().all()
    for l in leaves:
        items.append(ApprovalItem(
            id=str(l.id), type="leave_request",
            summary=f"Leave request: {l.start_date} to {l.end_date}",
            created_at=l.created_at.isoformat(),
        ))

    items.sort(key=lambda i: i.created_at, reverse=True)
    return items
