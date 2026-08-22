-- Cognitio ERP — complete database schema.
-- Hand-written to match every SQLAlchemy model exactly, since no live
-- Postgres was available in the build environment to autogenerate against
-- (see docs/020). This file is the source of truth for the schema; the
-- Alembic migration (0001_initial_schema.py) executes it verbatim.
--
-- Ordering matters: tables are created in dependency order so every
-- REFERENCES clause points at a table that already exists.
--
-- Every AuditMixin table repeats the same 7 columns (id, created_at,
-- updated_at, created_by, updated_by, deleted_at, deleted_by, version) —
-- intentionally not abstracted into a Postgres inheritance/template
-- mechanism, since explicit columns are easier to reason about in
-- migrations than inherited ones, at the cost of some repetition here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- ============================================================
-- PLATFORM-LEVEL TABLES (NOT tenant-scoped — these ARE the tenant)
-- ============================================================

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    name VARCHAR(150) NOT NULL,
    school_code VARCHAR(10) NOT NULL UNIQUE,
    motto VARCHAR(200),
    address VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(150),
    principal_name VARCHAR(150),

    plan VARCHAR(20) NOT NULL DEFAULT 'foundation',
    student_limit INTEGER NOT NULL DEFAULT 200,
    billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly',

    subdomain VARCHAR(50) NOT NULL UNIQUE,
    custom_domain VARCHAR(150) UNIQUE,

    current_session_start DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    trial_ends_at TIMESTAMPTZ
);
CREATE INDEX idx_schools_school_code ON schools(school_code);
CREATE INDEX idx_schools_subdomain ON schools(subdomain);

CREATE TABLE school_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL UNIQUE REFERENCES schools(id),
    primary_color VARCHAR(7) NOT NULL DEFAULT '#0E7C4A',
    secondary_color VARCHAR(7) NOT NULL DEFAULT '#12161F',
    accent_color VARCHAR(7) NOT NULL DEFAULT '#12A25C',
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    stamp_url VARCHAR(500),
    signature_url VARCHAR(500),
    report_card_template VARCHAR(30) NOT NULL DEFAULT 'standard',
    certificate_template VARCHAR(30) NOT NULL DEFAULT 'standard',
    dark_mode_enabled BOOLEAN NOT NULL DEFAULT false,
    theme_version INTEGER NOT NULL DEFAULT 1
);

-- Keyed by school_code (denormalized string), not school_id — the identity
-- code generator runs before a full User necessarily exists. See doc 003.
CREATE TABLE identity_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_code VARCHAR(20) NOT NULL,
    role VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    last_value INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_identity_sequence UNIQUE (school_code, role, year)
);
CREATE INDEX idx_identity_sequences_school_code ON identity_sequences(school_code);

-- ============================================================
-- AUTH / RBAC (tenant-scoped)
-- ============================================================

CREATE TABLE roles (
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
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_roles_school_id ON roles(school_id);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    identity_code VARCHAR(40) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),

    password_hash VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    google_sub VARCHAR(255) UNIQUE,

    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,

    delegated_role_id UUID REFERENCES roles(id),
    delegation_expires_at TIMESTAMPTZ,

    CONSTRAINT uq_user_identity_code UNIQUE (school_id, identity_code)
);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_identity_code ON users(identity_code);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE refresh_token_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    user_id UUID NOT NULL REFERENCES users(id),
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_reason VARCHAR(100)
);
CREATE INDEX idx_refresh_token_families_user_id ON refresh_token_families(user_id);

CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    identity_code VARCHAR(40) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255),
    successful BOOLEAN NOT NULL
);
CREATE INDEX idx_login_attempts_identity_code ON login_attempts(identity_code);

-- ============================================================
-- STUDENTS
-- ============================================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    identity_code VARCHAR(40) NOT NULL,
    user_id UUID REFERENCES users(id),

    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),

    class_name VARCHAR(50) NOT NULL,
    section VARCHAR(20),
    admission_number VARCHAR(40) NOT NULL,
    admission_date DATE NOT NULL,

    guardian_name VARCHAR(150),
    guardian_phone VARCHAR(20),
    guardian_email VARCHAR(150),

    status VARCHAR(20) NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_identity_code ON students(identity_code);
CREATE INDEX idx_students_admission_number ON students(admission_number);
CREATE INDEX idx_students_class_name ON students(school_id, class_name);

-- ============================================================
-- TEACHERS
-- ============================================================

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    identity_code VARCHAR(40) NOT NULL,
    user_id UUID REFERENCES users(id),

    full_name VARCHAR(150) NOT NULL,
    staff_id VARCHAR(40) NOT NULL,
    qualification VARCHAR(150),
    employment_date DATE NOT NULL,
    subjects TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_teachers_school_id ON teachers(school_id);
CREATE INDEX idx_teachers_identity_code ON teachers(identity_code);
CREATE INDEX idx_teachers_staff_id ON teachers(staff_id);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);

CREATE TABLE teacher_class_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    class_name VARCHAR(50) NOT NULL,
    subject VARCHAR(50),
    is_class_teacher BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_tca_school_id ON teacher_class_assignments(school_id);
CREATE INDEX idx_tca_teacher_id ON teacher_class_assignments(teacher_id);

-- ============================================================
-- FINANCE
-- ============================================================

CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    class_name VARCHAR(50) NOT NULL,
    term VARCHAR(20) NOT NULL,
    fee_category VARCHAR(50) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    due_date DATE NOT NULL
);
CREATE INDEX idx_fee_structures_school_id ON fee_structures(school_id);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    student_id UUID NOT NULL REFERENCES students(id),
    term VARCHAR(20) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
);
CREATE INDEX idx_invoices_school_id ON invoices(school_id);
CREATE INDEX idx_invoices_student_id ON invoices(student_id);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    idempotency_key VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    method VARCHAR(20) NOT NULL,
    paystack_reference VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    receipt_number VARCHAR(40) NOT NULL,
    paid_at TIMESTAMPTZ,
    CONSTRAINT uq_payment_idempotency UNIQUE (school_id, idempotency_key)
);
CREATE INDEX idx_payments_school_id ON payments(school_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_receipt_number ON payments(receipt_number);

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    student_id UUID NOT NULL REFERENCES students(id),
    class_name VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(10) NOT NULL,
    marked_by UUID NOT NULL REFERENCES users(id),
    marked_at_device TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ,
    CONSTRAINT uq_attendance_student_day UNIQUE (school_id, student_id, date)
);
CREATE INDEX idx_attendance_school_id ON attendance_records(school_id);
CREATE INDEX idx_attendance_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);

-- ============================================================
-- RESULTS
-- ============================================================

CREATE TABLE grading_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    name VARCHAR(50) NOT NULL DEFAULT 'Default',
    component_weights JSONB NOT NULL,
    grade_boundaries JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_grading_schemes_school_id ON grading_schemes(school_id);

CREATE TABLE score_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    student_id UUID NOT NULL REFERENCES students(id),
    subject VARCHAR(50) NOT NULL,
    term VARCHAR(20) NOT NULL,
    component VARCHAR(20) NOT NULL,
    score NUMERIC(5, 2) NOT NULL,
    entered_by UUID NOT NULL REFERENCES users(id),
    CONSTRAINT uq_score_entry UNIQUE (school_id, student_id, subject, term, component)
);
CREATE INDEX idx_score_entries_school_id ON score_entries(school_id);
CREATE INDEX idx_score_entries_student_id ON score_entries(student_id);

CREATE TABLE report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    student_id UUID NOT NULL REFERENCES students(id),
    term VARCHAR(20) NOT NULL,
    subject_scores JSONB NOT NULL,
    overall_average NUMERIC(5, 2) NOT NULL,
    class_position INTEGER,
    attendance_percent NUMERIC(5, 2),
    teacher_comment TEXT,
    published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    pdf_url TEXT,
    CONSTRAINT uq_report_card_term UNIQUE (school_id, student_id, term)
);
CREATE INDEX idx_report_cards_school_id ON report_cards(school_id);
CREATE INDEX idx_report_cards_student_id ON report_cards(student_id);

-- ============================================================
-- PARENT PORTAL
-- ============================================================

CREATE TABLE parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    parent_user_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_parent_student_link UNIQUE (school_id, parent_user_id, student_id)
);
CREATE INDEX idx_psl_school_id ON parent_student_links(school_id);
CREATE INDEX idx_psl_parent_user_id ON parent_student_links(parent_user_id);
CREATE INDEX idx_psl_student_id ON parent_student_links(student_id);

-- ============================================================
-- COMMUNICATION
-- ============================================================

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    posted_by UUID NOT NULL REFERENCES users(id),
    target_classes JSONB
);
CREATE INDEX idx_announcements_school_id ON announcements(school_id);

CREATE TABLE help_desk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    raised_by UUID NOT NULL REFERENCES users(id),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id)
);
CREATE INDEX idx_tickets_school_id ON help_desk_tickets(school_id);
CREATE INDEX idx_tickets_raised_by ON help_desk_tickets(raised_by);

CREATE TABLE ticket_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    ticket_id UUID NOT NULL REFERENCES help_desk_tickets(id),
    author_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL
);
CREATE INDEX idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    user_id UUID NOT NULL REFERENCES users(id),
    category VARCHAR(30) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app',
    digest VARCHAR(10) NOT NULL DEFAULT 'immediate',
    enabled BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_notification_pref UNIQUE (school_id, user_id, category)
);
CREATE INDEX idx_notif_prefs_user_id ON notification_preferences(user_id);

CREATE TABLE school_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL UNIQUE REFERENCES schools(id),
    sms_allowed_categories JSONB NOT NULL DEFAULT '[]',
    sms_enabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    category VARCHAR(30) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    subject VARCHAR(200),
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    sent_at TIMESTAMPTZ,
    CONSTRAINT uq_notification_idempotency UNIQUE (school_id, idempotency_key)
);
CREATE INDEX idx_notif_logs_recipient ON notification_logs(recipient_user_id);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    reorder_level INTEGER NOT NULL DEFAULT 0,
    location VARCHAR(100),
    unit_cost NUMERIC(12, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_inventory_school_id ON inventory_items(school_id);

CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    item_name VARCHAR(150) NOT NULL,
    quantity_requested INTEGER NOT NULL,
    reason VARCHAR(255),
    requested_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id)
);
CREATE INDEX idx_purchase_requests_school_id ON purchase_requests(school_id);

-- ============================================================
-- HR / PAYROLL
-- ============================================================

CREATE TABLE staff_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    user_id UUID REFERENCES users(id),
    full_name VARCHAR(150) NOT NULL,
    staff_id VARCHAR(40) NOT NULL,
    role_title VARCHAR(100) NOT NULL,
    employment_date DATE NOT NULL,
    monthly_salary NUMERIC(12, 2) NOT NULL,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_staff_records_school_id ON staff_records(school_id);
CREATE INDEX idx_staff_records_staff_id ON staff_records(staff_id);

CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    staff_record_id UUID NOT NULL REFERENCES staff_records(id),
    month VARCHAR(7) NOT NULL,
    gross_salary NUMERIC(12, 2) NOT NULL,
    deductions JSONB NOT NULL DEFAULT '{}',
    net_salary NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'generated',
    pdf_url TEXT
);
CREATE INDEX idx_payslips_staff_record_id ON payslips(staff_record_id);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1,

    school_id UUID NOT NULL REFERENCES schools(id),
    staff_record_id UUID NOT NULL REFERENCES staff_records(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id)
);
CREATE INDEX idx_leave_requests_staff_record_id ON leave_requests(staff_record_id);

-- ============================================================
-- End of schema. 29 tables total.
-- ============================================================

-- ============================================================
-- SCHOOL CLASSES (added post-launch-scope-review: the missing backing
-- data for class/section management — every other table's class_name
-- was previously free text with nothing defining what classes exist)
-- ============================================================

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
);
CREATE INDEX idx_school_classes_school_id ON school_classes(school_id);
