"""Add addon product flags to schools

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-20

Stella AI, LMS, CBT gates — see schools/models.py's School class docstring
for the full reasoning. Each defaults to false; a school's plan tier or a
standalone addon purchase flips them on.
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE schools ADD COLUMN stella_ai_enabled BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE schools ADD COLUMN lms_enabled BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE schools ADD COLUMN cbt_enabled BOOLEAN NOT NULL DEFAULT false")


def downgrade() -> None:
    op.execute("ALTER TABLE schools DROP COLUMN IF EXISTS cbt_enabled")
    op.execute("ALTER TABLE schools DROP COLUMN IF EXISTS lms_enabled")
    op.execute("ALTER TABLE schools DROP COLUMN IF EXISTS stella_ai_enabled")
