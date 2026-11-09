"""add_assigned_engineer_id_to_incidents

Revision ID: 3227f7cdafef
Revises: f76a49151901
Create Date: 2026-11-08 17:39:18.763844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3227f7cdafef'
down_revision: Union[str, Sequence[str], None] = 'f76a49151901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('incidents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('assigned_engineer_id', sa.String(), nullable=True))
        batch_op.create_index(batch_op.f('ix_incidents_assigned_engineer_id'), ['assigned_engineer_id'], unique=False)
        batch_op.create_foreign_key('fk_incidents_assigned_engineer_id_users', 'users', ['assigned_engineer_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('incidents', schema=None) as batch_op:
        batch_op.drop_constraint('fk_incidents_assigned_engineer_id_users', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_incidents_assigned_engineer_id'))
        batch_op.drop_column('assigned_engineer_id')
