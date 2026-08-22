"""
Celery application instance. Every background job in the system (imports,
PDF generation, notification delivery — see doc 013) is registered here.
Deliberately a thin file — task logic lives in app/tasks/<domain>.py, not here.
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "cognitio_erp",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.notifications"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,           # a worker crash mid-task re-queues it rather than losing it
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,   # avoid one slow worker hoarding a big batch of queued jobs
    task_default_retry_delay=30,
)
