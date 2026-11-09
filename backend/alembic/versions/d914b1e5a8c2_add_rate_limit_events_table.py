"""add_rate_limit_events_table

Revision ID: d914b1e5a8c2
Revises: 3227f7cdafef
Create Date: 2026-11-08 19:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd914b1e5a8c2'
down_revision: Union[str, Sequence[str], None] = '3227f7cdafef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include rate_limit_events table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'rate_limit_events' not in tables:
        op.create_table(
            'rate_limit_events',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('key', sa.String(length=255), nullable=False),
            sa.Column('timestamp', sa.Float(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_rate_limit_events_key'), 'rate_limit_events', ['key'], unique=False)
        op.create_index(op.f('ix_rate_limit_events_timestamp'), 'rate_limit_events', ['timestamp'], unique=False)
        op.create_index('ix_rate_limit_key_ts', 'rate_limit_events', ['key', 'timestamp'], unique=False)


def downgrade() -> None:
    """Downgrade schema to remove rate_limit_events table."""
    op.drop_index('ix_rate_limit_key_ts', table_name='rate_limit_events')
    op.drop_index(op.f('ix_rate_limit_events_timestamp'), table_name='rate_limit_events')
    op.drop_index(op.f('ix_rate_limit_events_key'), table_name='rate_limit_events')
    op.drop_table('rate_limit_events')
