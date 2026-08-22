"""Add student lifecycle fields and expand status/role coverage

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-15

Adds photo_url, exit_date, exit_reason to students (real-world lifecycle:
graduation, transfer, expulsion, death — each needs a date and a reason,
and a photo is part of "everything about admissions" per the product
requirement). Widens the student status CHECK constraint (0002) to cover
the fuller status set. Also adds photo_url to teachers for the same
"real ID, real record" reason.
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN photo_url VARCHAR(500)")
    op.execute("ALTER TABLE students ADD COLUMN exit_date DATE")
    op.execute("ALTER TABLE students ADD COLUMN exit_reason VARCHAR(255)")

    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS ck_student_status_valid")
    op.execute(
        "ALTER TABLE students ADD CONSTRAINT ck_student_status_valid "
        "CHECK (status IN ('active', 'graduated', 'withdrawn', 'suspended', 'transferred', 'deceased'))"
    )

    op.execute("ALTER TABLE teachers ADD COLUMN photo_url VARCHAR(500)")


def downgrade() -> None:
    op.execute("ALTER TABLE teachers DROP COLUMN IF EXISTS photo_url")
    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS ck_student_status_valid")
    op.execute(
        "ALTER TABLE students ADD CONSTRAINT ck_student_status_valid "
        "CHECK (status IN ('active', 'graduated', 'withdrawn', 'suspended'))"
    )
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS exit_reason")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS exit_date")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS photo_url")
