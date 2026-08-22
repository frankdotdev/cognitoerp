"""
Async SQLAlchemy engine and session factory.
One engine per process, connection-pooled. Every request gets a scoped session
via the get_db dependency — never import a global session and reuse it across requests.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,  # avoids stale-connection errors after idle periods
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db():
    """
    FastAPI dependency. Yields a session scoped to a single request and
    guarantees it is closed, even on exception.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
