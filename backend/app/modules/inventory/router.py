"""Inventory router. Low-stock is a computed flag on read (quantity <= reorder_level), not a stored state
that could drift out of sync with quantity changes."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.inventory.models import InventoryItem, PurchaseRequest
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemOut, PurchaseRequestCreate, PurchaseRequestOut,
)

router = APIRouter()


@router.get("/items", response_model=list[InventoryItemOut])
async def list_items(
    low_stock_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.view")),
):
    repo = InventoryRepository(db)
    filters = [InventoryItem.quantity <= InventoryItem.reorder_level] if low_stock_only else None
    rows, _ = await repo.paginate(page=1, page_size=200, filters=filters, order_by=InventoryItem.name)
    return rows


@router.post("/items", response_model=InventoryItemOut, status_code=201)
async def create_item(
    payload: InventoryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.edit")),
):
    item = InventoryItem(school_id=current_user.school_id, created_by=current_user.user_id, **payload.model_dump())
    saved = await InventoryRepository(db).create(item)
    await db.commit()
    return saved


@router.patch("/items/{item_id}", response_model=InventoryItemOut)
async def update_item(
    item_id: uuid.UUID,
    payload: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.edit")),
):
    repo = InventoryRepository(db)
    item = await repo.get_by_id(item_id)
    changes = payload.model_dump(exclude={"version"}, exclude_unset=True)
    updated = await repo.update_with_lock(item, payload.version, **changes)
    await db.commit()
    return updated


@router.get("/purchase-requests", response_model=list[PurchaseRequestOut])
async def list_purchase_requests(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.view")),
):
    stmt = select(PurchaseRequest).order_by(PurchaseRequest.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.post("/purchase-requests", response_model=PurchaseRequestOut, status_code=201)
async def create_purchase_request(
    payload: PurchaseRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.view")),  # any staff can request, not just editors
):
    request = PurchaseRequest(school_id=current_user.school_id, requested_by=current_user.user_id, **payload.model_dump())
    db.add(request)
    await db.commit()
    return request


@router.post("/purchase-requests/{request_id}/approve", response_model=PurchaseRequestOut)
async def approve_purchase_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.edit")),
):
    result = await db.execute(select(PurchaseRequest).where(PurchaseRequest.id == request_id))
    request = result.scalar_one()
    request.status = "approved"
    request.approved_by = current_user.user_id
    await db.commit()
    return request


@router.post("/purchase-requests/{request_id}/reject", response_model=PurchaseRequestOut)
async def reject_purchase_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("inventory.edit")),
):
    result = await db.execute(select(PurchaseRequest).where(PurchaseRequest.id == request_id))
    request = result.scalar_one()
    request.status = "rejected"
    request.approved_by = current_user.user_id
    await db.commit()
    return request
