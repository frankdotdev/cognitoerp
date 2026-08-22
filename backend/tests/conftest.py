"""
Shared pytest fixtures. Uses a real Postgres test database (not SQLite —
SQLite doesn't support the JSONB, ARRAY, and Postgres-specific upsert
syntax used throughout this codebase, so testing against it would verify
the wrong thing). Each test runs inside a transaction that's rolled back
at the end, so tests never leak state into each other regardless of order.

Requires TEST_DATABASE_URL (falls back to DATABASE_URL with a _test
suffix) — this is the first thing that needs a real Postgres instance
to actually execute, which nothing in this codebase has had access to
yet (see docs/020).
"""
import asyncio
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.db.base_model import Base
from app.db.tenant_guard import register_tenant_guard, set_current_tenant, clear_current_tenant

# Import every module's models so Base.metadata is complete for create_all.
from app.modules.auth import models as _auth_models  # noqa
from app.modules.schools import models as _schools_models  # noqa
from app.modules.students import models as _students_models  # noqa
from app.modules.teachers import models as _teachers_models  # noqa
from app.modules.finance import models as _finance_models  # noqa
from app.modules.attendance import models as _attendance_models  # noqa
from app.modules.results import models as _results_models  # noqa
from app.modules.parents import models as _parents_models  # noqa
from app.modules.communication import models as _communication_models  # noqa
from app.modules.notifications import models as _notifications_models  # noqa
from app.modules.inventory import models as _inventory_models  # noqa
from app.modules.hr import models as _hr_models  # noqa

_TEST_DB_URL = getattr(settings, "TEST_DATABASE_URL", None) or settings.DATABASE_URL.replace("/cognitio_erp", "/cognitio_erp_test")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(_TEST_DB_URL)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncSession:
    """
    Every test gets a fresh session wrapped in a transaction that's rolled
    back on teardown — so creating a school/student/etc. in one test never
    persists to affect another, without needing to manually clean up.
    """
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    register_tenant_guard(session_factory)
    async with session_factory() as session:
        async with session.begin():
            yield session
            await session.rollback()
    clear_current_tenant()


@pytest_asyncio.fixture
async def school_a(db) -> uuid.UUID:
    from app.modules.schools.models import School
    school = School(name="Test School A", school_code="TSA", subdomain="test-school-a")
    db.add(school)
    await db.flush()
    return school.id


@pytest_asyncio.fixture
async def school_b(db) -> uuid.UUID:
    from app.modules.schools.models import School
    school = School(name="Test School B", school_code="TSB", subdomain="test-school-b")
    db.add(school)
    await db.flush()
    return school.id
