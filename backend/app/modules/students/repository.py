from sqlalchemy import or_

from app.modules.students.models import Student
from app.shared.base_repository import BaseRepository


class StudentRepository(BaseRepository[Student]):
    model = Student

    async def search(self, params):
        filters = []
        if params.class_name:
            filters.append(Student.class_name == params.class_name)
        if params.status:
            filters.append(Student.status == params.status)
        if params.search:
            like = f"%{params.search}%"
            filters.append(or_(Student.full_name.ilike(like), Student.admission_number.ilike(like)))

        order_col = getattr(Student, params.sort_by, Student.full_name)
        order_by = order_col.desc() if params.sort_dir == "desc" else order_col.asc()

        return await self.paginate(
            page=params.page, page_size=params.page_size, filters=filters or None, order_by=order_by
        )
