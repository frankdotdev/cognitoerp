"""
Full student record export — the concrete answer to "the next school
should be able to import this, even if they're on a different ERP." Two
formats, deliberately:

  1. A PDF transcript — human-readable, printable, the document a parent
     or the student themselves would actually carry to a new school.
  2. A JSON export — structured, complete, and NOT tied to Cognitio's own
     database schema in its shape (field names are descriptive and
     generic — "subject_scores_by_term", not a dump of our internal
     column names) specifically so another system's import tooling has
     something reasonable to parse, whether or not that system is Cognitio.

Neither of these transmits anything automatically to another school's
system — there is no cross-institution API handshake here, because that
would require agreement with systems Cognitio doesn't control. What this
provides is the portable ARTIFACT: a complete, downloadable record the
family or the student controls and can hand to (or upload into) wherever
they go next.
"""
import io
import uuid
from datetime import datetime, timezone

from jinja2 import Template
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from weasyprint import HTML

from app.modules.students.models import Student
from app.modules.results.models import ReportCard
from app.modules.attendance.models import AttendanceRecord
from app.modules.schools.models import School, SchoolTheme

_TRANSCRIPT_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #14181F; font-size: 10.5pt; }
  .header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid {{ primary_color }}; padding-bottom: 16px; margin-bottom: 20px; }
  .header img { width: 48px; height: 48px; object-fit: contain; }
  .header .title { font-size: 15pt; font-weight: bold; color: {{ primary_color }}; }
  .meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 9.5pt; margin-bottom: 22px; }
  .meta div { min-width: 45%; }
  .meta .label { color: #98A1AD; }
  .term-block { margin-bottom: 18px; page-break-inside: avoid; }
  .term-title { font-weight: bold; font-size: 11pt; border-bottom: 1px solid #E5E8EA; padding-bottom: 4px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; border-bottom: 1px solid #14181F; padding: 4px; }
  td { padding: 4px; border-bottom: 1px solid #E5E8EA; }
  .right { text-align: right; }
  .summary-row { display: flex; justify-content: space-between; font-size: 9.5pt; padding-top: 4px; font-weight: bold; }
  .footer { display: flex; justify-content: space-between; font-size: 9pt; color: #98A1AD; border-top: 1px solid #E5E8EA; padding-top: 12px; margin-top: 24px; }
</style>
</head>
<body>
  <div class="header">
    {% if logo_url %}<img src="{{ logo_url }}" alt="logo">{% endif %}
    <div>
      <div class="title">{{ school_name }}</div>
      <div>Academic Transcript</div>
    </div>
  </div>

  <div class="meta">
    <div><span class="label">Student:</span> {{ student_name }}</div>
    <div><span class="label">Admission No:</span> {{ admission_number }}</div>
    <div><span class="label">Date of Birth:</span> {{ date_of_birth or "—" }}</div>
    <div><span class="label">Admitted:</span> {{ admission_date }}</div>
    <div><span class="label">Status:</span> {{ status }}{% if exit_date %} ({{ exit_date }}){% endif %}</div>
  </div>

  {% for card in report_cards %}
  <div class="term-block">
    <div class="term-title">{{ card.term }} — {{ card.class_name }}</div>
    <table>
      <thead><tr><th>Subject</th><th class="right">Score</th><th class="right">Grade</th></tr></thead>
      <tbody>
        {% for subject, s in card.subject_scores.items() %}
        <tr><td>{{ subject }}</td><td class="right">{{ s.total }}</td><td class="right">{{ s.grade }}</td></tr>
        {% endfor %}
      </tbody>
    </table>
    <div class="summary-row">
      <span>Average: {{ card.overall_average }}%</span>
      <span>{% if card.class_position %}Position {{ card.class_position }}{% endif %}</span>
    </div>
  </div>
  {% endfor %}

  {% if not report_cards %}
  <p>No published results on record.</p>
  {% endif %}

  <div class="footer">
    <span>Issued by {{ school_name }} via Cognitio ERP</span>
    <span>{{ generated_date }}</span>
  </div>
</body>
</html>
""")


async def _gather_student_record(db: AsyncSession, *, school_id: uuid.UUID, student_id: uuid.UUID) -> dict:
    student = (
        await db.execute(select(Student).where(Student.id == student_id, Student.school_id == school_id))
    ).scalar_one()
    school = (await db.execute(select(School).where(School.id == school_id))).scalar_one()
    theme = (await db.execute(select(SchoolTheme).where(SchoolTheme.school_id == school_id))).scalar_one_or_none()

    report_cards = (
        await db.execute(
            select(ReportCard).where(ReportCard.school_id == school_id, ReportCard.student_id == student_id, ReportCard.published.is_(True))
            .order_by(ReportCard.term)
        )
    ).scalars().all()

    attendance_total = (
        await db.execute(select(AttendanceRecord).where(AttendanceRecord.school_id == school_id, AttendanceRecord.student_id == student_id))
    ).scalars().all()
    present_count = sum(1 for a in attendance_total if a.status == "present")
    attendance_percent = round(100 * present_count / len(attendance_total), 1) if attendance_total else None

    return {
        "student": student, "school": school, "theme": theme,
        "report_cards": report_cards, "attendance_percent": attendance_percent,
    }


async def generate_transcript_pdf(db: AsyncSession, *, school_id: uuid.UUID, student_id: uuid.UUID) -> bytes:
    data = await _gather_student_record(db, school_id=school_id, student_id=student_id)
    student, school, theme = data["student"], data["school"], data["theme"]

    logo_url = None
    if theme and theme.logo_url:
        from app.core.storage import generate_download_url
        logo_url = generate_download_url(object_key=theme.logo_url)

    html_content = _TRANSCRIPT_TEMPLATE.render(
        school_name=school.name, logo_url=logo_url, primary_color=theme.primary_color if theme else "#0E7C4A",
        student_name=student.full_name, admission_number=student.admission_number,
        date_of_birth=student.date_of_birth.isoformat() if student.date_of_birth else None,
        admission_date=student.admission_date.isoformat(), status=student.status,
        exit_date=student.exit_date.isoformat() if student.exit_date else None,
        report_cards=[
            {"term": c.term, "class_name": student.class_name, "subject_scores": c.subject_scores,
             "overall_average": float(c.overall_average), "class_position": c.class_position}
            for c in data["report_cards"]
        ],
        generated_date=datetime.now(timezone.utc).strftime("%d %B %Y"),
    )
    buffer = io.BytesIO()
    HTML(string=html_content).write_pdf(buffer)
    return buffer.getvalue()


async def generate_portable_export(db: AsyncSession, *, school_id: uuid.UUID, student_id: uuid.UUID) -> dict:
    """
    The machine-readable counterpart — generic field names, not a dump of
    Cognitio's internal schema, so a receiving system (Cognitio or otherwise)
    has something reasonable to parse.
    """
    data = await _gather_student_record(db, school_id=school_id, student_id=student_id)
    student, school = data["student"], data["school"]

    return {
        "export_format": "cognitio-student-record-v1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "issuing_school": {"name": school.name, "school_code": school.school_code},
        "student": {
            "full_name": student.full_name,
            "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
            "gender": student.gender,
            "admission_number": student.admission_number,
            "admission_date": student.admission_date.isoformat(),
            "exit_date": student.exit_date.isoformat() if student.exit_date else None,
            "exit_status": student.status,
            "guardian_name": student.guardian_name,
            "guardian_phone": student.guardian_phone,
            "guardian_email": student.guardian_email,
        },
        "academic_record": [
            {
                "term": c.term, "class_name": student.class_name, "subject_scores": c.subject_scores,
                "overall_average": float(c.overall_average), "class_position": c.class_position,
            }
            for c in data["report_cards"]
        ],
        "attendance_summary": {"overall_percent": data["attendance_percent"]},
    }
