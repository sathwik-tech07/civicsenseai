"""add_whatsapp_pending_sessions_table

Revision ID: e518c729f1b4
Revises: d914b1e5a8c2
Create Date: 2026-11-12 15:00:00.000000

PRODUCTION NOTE:
Requires explicit deployment approval before running alembic upgrade head in production.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e518c729f1b4'
down_revision: Union[str, Sequence[str], None] = 'd914b1e5a8c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include whatsapp_pending_sessions table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'whatsapp_pending_sessions' not in tables:
        op.create_table(
            'whatsapp_pending_sessions',
            sa.Column('phone', sa.String(length=32), nullable=False),
            sa.Column('draft_data', sa.JSON(), nullable=False),
            sa.Column('expires_at', sa.Float(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('phone')
        )
        op.create_index(op.f('ix_whatsapp_pending_sessions_phone'), 'whatsapp_pending_sessions', ['phone'], unique=False)
        op.create_index(op.f('ix_whatsapp_pending_sessions_expires_at'), 'whatsapp_pending_sessions', ['expires_at'], unique=False)
        op.create_index('ix_whatsapp_sessions_phone_expires', 'whatsapp_pending_sessions', ['phone', 'expires_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema to remove whatsapp_pending_sessions table."""
    op.drop_index('ix_whatsapp_sessions_phone_expires', table_name='whatsapp_pending_sessions')
    op.drop_index(op.f('ix_whatsapp_pending_sessions_expires_at'), table_name='whatsapp_pending_sessions')
    op.drop_index(op.f('ix_whatsapp_pending_sessions_phone'), table_name='whatsapp_pending_sessions')
    op.drop_table('whatsapp_pending_sessions')
