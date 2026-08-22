"""
Alembic environment, wired for async SQLAlchemy. Imports every module's
models so autogenerate can see the full metadata — as new modules are built,
add their model imports here, or autogenerate will silently miss their tables.
"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.core.config import settings
from app.db.base_model import Base

# Import every module's models here so Base.metadata knows about all tables.
from app.modules.auth import models as auth_models          # noqa: F401
from app.modules.schools import models as schools_models    # noqa: F401
from app.modules.students import models as students_models  # noqa: F401
from app.modules.finance import models as finance_models    # noqa: F401
from app.modules.attendance import models as attendance_models  # noqa: F401
from app.modules.teachers import models as teachers_models  # noqa: F401
from app.modules.results import models as results_models    # noqa: F401
from app.modules.parents import models as parents_models    # noqa: F401
from app.modules.communication import models as communication_models  # noqa: F401
from app.modules.notifications import models as notifications_models  # noqa: F401
from app.modules.inventory import models as inventory_models  # noqa: F401
from app.modules.hr import models as hr_models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
