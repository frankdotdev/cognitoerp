"""
Generic repository every module's repository inherits from. This is where
soft-delete filtering, pagination, and optimistic-locking enforcement live
ONCE, instead of being reimplemented (and inevitably drifting) per module.
"""
import uuid
from typing import Generic, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base_model import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(self):
        # Every read excludes soft-deleted rows by default. Nothing outside
        # an explicit admin "restore" or "purge" flow should ever see these.
        return select(self.model).where(self.model.deleted_at.is_(None))

    async def get_by_id(self, id: uuid.UUID) -> ModelT:
        stmt = self._base_query().where(self.model.id == id)
        result = await self.db.execute(stmt)
        obj = result.scalar_one_or_none()
        if obj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{self.model.__name__} not found.")
        return obj

    async def paginate(self, *, page: int, page_size: int, filters=None, order_by=None):
        stmt = self._base_query()
        if filters is not None:
            stmt = stmt.where(*filters)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def create(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def update_with_lock(self, obj: ModelT, expected_version: int, **changes) -> ModelT:
        """
        Optimistic locking: the caller must supply the version they last read.
        If another request has modified this row since, we reject rather than
        silently overwrite — the client is told to refetch and retry.
        """
        if obj.version != expected_version:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This record was changed by someone else. Refresh and try again.",
            )
        for key, value in changes.items():
            if value is not None:
                setattr(obj, key, value)
        obj.version += 1
        await self.db.flush()
        return obj

    async def soft_delete(self, obj: ModelT, deleted_by: uuid.UUID) -> None:
        from datetime import datetime, timezone
        obj.deleted_at = datetime.now(timezone.utc)
        obj.deleted_by = deleted_by
        await self.db.flush()
