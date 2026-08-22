import uuid
from pydantic import BaseModel, ConfigDict, Field


class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    category: str = Field(pattern="^(furniture|ict|lab|stationery|other)$")
    quantity: int = Field(ge=0)
    unit: str = "pcs"
    reorder_level: int = Field(default=0, ge=0)
    location: str | None = None
    unit_cost: float | None = None


class InventoryItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    location: str | None = None
    status: str | None = None
    version: int


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    category: str
    quantity: int
    unit: str
    reorder_level: int
    location: str | None
    status: str
    version: int


class PurchaseRequestCreate(BaseModel):
    item_name: str = Field(min_length=2, max_length=150)
    quantity_requested: int = Field(gt=0)
    reason: str | None = None


class PurchaseRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    item_name: str
    quantity_requested: int
    status: str
