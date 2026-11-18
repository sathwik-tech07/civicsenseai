"""add_whatsapp_allowed_numbers_table

Revision ID: f629d830a2c3
Revises: e518c729f1b4
Create Date: 2026-11-17 19:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f629d830a2c3'
down_revision: Union[str, Sequence[str], None] = 'e518c729f1b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include whatsapp_allowed_numbers table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'whatsapp_allowed_numbers' not in tables:
        op.create_table(
            'whatsapp_allowed_numbers',
            sa.Column('phone', sa.String(length=32), nullable=False),
            sa.Column('label', sa.String(length=128), nullable=True),
            sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('phone')
        )
        op.create_index(op.f('ix_whatsapp_allowed_numbers_phone'), 'whatsapp_allowed_numbers', ['phone'], unique=False)


def downgrade() -> None:
    """Downgrade schema to remove whatsapp_allowed_numbers table."""
    op.drop_index(op.f('ix_whatsapp_allowed_numbers_phone'), table_name='whatsapp_allowed_numbers')
    op.drop_table('whatsapp_allowed_numbers')
