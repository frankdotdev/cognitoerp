from app.modules.inventory.models import InventoryItem
from app.shared.base_repository import BaseRepository


class InventoryRepository(BaseRepository[InventoryItem]):
    model = InventoryItem
