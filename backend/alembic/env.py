import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure backend root is on sys.path for module resolution
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import application configuration and models
from app.config import settings
from app.database import Base, normalize_database_url

# Explicitly import all SQLAlchemy model definitions to populate Base.metadata
import app.models.user
import app.models.incident
import app.models.ai_analysis
import app.models.workflow
import app.models.report
import app.models.rate_limit

# This is the Alembic Config object, which provides access to .ini values
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata for autogenerate support
target_metadata = Base.metadata


def get_url() -> str:
    """
    Returns normalized database connection string via CivicSense URL normalization.
    Respects explicit sqlalchemy.url from Alembic config (e.g. tests or CLI options)
    and falls back safely to application settings.DATABASE_URL.
    Never exposes raw secrets in logs.
    """
    url_from_config = config.get_main_option("sqlalchemy.url")
    if url_from_config and url_from_config != "driver://user:pass@localhost/dbname":
        raw_url = url_from_config
    else:
        raw_url = settings.DATABASE_URL or "sqlite:///./civicsense.db"
    return normalize_database_url(raw_url)


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    Configures the context with a URL without initializing an active connection engine.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=url.startswith("sqlite"),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    Creates an Engine and associates an active database connection with the context.
    """
    db_url = get_url()
    configuration = config.get_section(config.config_ini_section, {}) or {}
    configuration["sqlalchemy.url"] = db_url

    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=db_url.startswith("sqlite"),
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
