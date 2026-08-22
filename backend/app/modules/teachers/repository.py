from app.modules.teachers.models import Teacher
from app.shared.base_repository import BaseRepository


class TeacherRepository(BaseRepository[Teacher]):
    model = Teacher
