"""Add school_classes table

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-07

The missing backing data for class/section management, found when building
the Settings > Classes screen — every other table's class_name was
previously free text with no table defining which classes a school
actually has.
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE school_classes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by UUID,
            updated_by UUID,
            deleted_at TIMESTAMPTZ,
            deleted_by UUID,
            version INTEGER NOT NULL DEFAULT 1,
            school_id UUID NOT NULL REFERENCES schools(id),
            name VARCHAR(50) NOT NULL,
            sections JSONB NOT NULL DEFAULT '[]',
            display_order INTEGER NOT NULL DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX idx_school_classes_school_id ON school_classes(school_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS school_classes CASCADE")
