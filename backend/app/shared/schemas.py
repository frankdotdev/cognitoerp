"""Shared response envelopes — used by every paginated list endpoint so the frontend has one shape to handle everywhere."""
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int

    @classmethod
    def build(cls, items: list[T], *, page: int, page_size: int, total: int) -> "PaginatedResponse[T]":
        total_pages = max(1, (total + page_size - 1) // page_size)
        return cls(items=items, page=page, page_size=page_size, total=total, total_pages=total_pages)
