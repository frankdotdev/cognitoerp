"""Add check constraints — database-level integrity beyond FK/uniqueness

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-07

Fills the gap flagged in review: nothing at the database layer previously
stopped amount_paid > total_amount, a negative score, a payslip's net
exceeding gross, or an invalid attendance/ticket/request status — only
application code checked these. Application-level validation stays (better
error messages, checked before a query even runs), but these constraints
mean a bug in application code, a direct psql UPDATE, or a future
integration writing straight to the database can\'t silently corrupt data
past what the schema itself allows.
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_CONSTRAINTS = [
    ("invoices", "ck_invoice_paid_not_exceed_total", "amount_paid <= total_amount"),
    ("invoices", "ck_invoice_amounts_non_negative", "total_amount >= 0 AND amount_paid >= 0 AND discount_amount >= 0"),
    ("payments", "ck_payment_amount_positive", "amount > 0"),
    ("score_entries", "ck_score_non_negative", "score >= 0"),
    ("attendance_records", "ck_attendance_status_valid", "status IN ('present', 'absent', 'late', 'excused')"),
    ("payslips", "ck_payslip_net_not_exceed_gross", "net_salary <= gross_salary"),
    ("payslips", "ck_payslip_amounts_non_negative", "gross_salary >= 0 AND net_salary >= 0"),
    ("students", "ck_student_status_valid", "status IN ('active', 'graduated', 'withdrawn', 'suspended')"),
    ("teachers", "ck_teacher_status_valid", "status IN ('active', 'on_leave', 'left')"),
    ("staff_records", "ck_staff_status_valid", "status IN ('active', 'on_leave', 'terminated')"),
    ("inventory_items", "ck_inventory_quantity_non_negative", "quantity >= 0 AND reorder_level >= 0"),
    ("help_desk_tickets", "ck_ticket_status_valid", "status IN ('open', 'in_progress', 'resolved')"),
    ("purchase_requests", "ck_purchase_status_valid", "status IN ('pending', 'approved', 'rejected', 'fulfilled')"),
    ("purchase_requests", "ck_purchase_quantity_positive", "quantity_requested > 0"),
    ("leave_requests", "ck_leave_status_valid", "status IN ('pending', 'approved', 'rejected')"),
    ("leave_requests", "ck_leave_dates_ordered", "end_date >= start_date"),
    ("parent_student_links", "ck_parent_link_status_valid", "status IN ('pending', 'approved', 'rejected')"),
    ("notification_logs", "ck_notification_status_valid", "status IN ('queued', 'sent', 'failed')"),
    ("schools", "ck_school_plan_valid", "plan IN ('foundation', 'academy', 'excellence', 'enterprise')"),
    ("schools", "ck_school_student_limit_positive", "student_limit > 0"),
]


def upgrade() -> None:
    for table, name, condition in _CONSTRAINTS:
        op.execute(f"ALTER TABLE {table} ADD CONSTRAINT {name} CHECK ({condition})")


def downgrade() -> None:
    for table, name, _ in reversed(_CONSTRAINTS):
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name}")
