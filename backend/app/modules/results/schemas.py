import uuid
from pydantic import BaseModel, ConfigDict, Field


class GradingSchemeCreate(BaseModel):
    name: str = "Default"
    component_weights: dict[str, float]  # e.g. {"CA1": 20, "CA2": 20, "Exam": 60}
    grade_boundaries: list[dict]  # e.g. [{"grade": "A", "min": 70, "max": 100}, ...]


class GradingSchemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    component_weights: dict
    grade_boundaries: list
    is_active: bool


class ScoreEntryRequest(BaseModel):
    student_id: uuid.UUID
    subject: str
    term: str
    component: str
    score: float = Field(ge=0)


class CompileReportCardsRequest(BaseModel):
    class_name: str
    term: str


class PublishReportCardsRequest(BaseModel):
    report_card_ids: list[uuid.UUID]


class ReportCardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    student_id: uuid.UUID
    term: str
    subject_scores: dict
    overall_average: float
    class_position: int | None
    published: bool
