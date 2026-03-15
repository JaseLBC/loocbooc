"""Avatar module — extended fields for body type, fit preferences, photo scan.

Revision ID: 003
Revises: 002
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend avatars table
    op.add_column('avatars', sa.Column('body_type', sa.String(50), nullable=True))
    op.add_column('avatars', sa.Column(
        'fit_preference',
        postgresql.JSONB(astext_type=sa.Text()),
        server_default='{}',
        nullable=False,
    ))
    op.add_column('avatars', sa.Column(
        'size_history',
        postgresql.JSONB(astext_type=sa.Text()),
        server_default='{}',
        nullable=False,
    ))

    # Extend avatar_measurements table
    op.add_column('avatar_measurements', sa.Column('arm_length_cm', sa.Float(), nullable=True))
    op.add_column('avatar_measurements', sa.Column('torso_length_cm', sa.Float(), nullable=True))
    op.add_column('avatar_measurements', sa.Column('body_type', sa.String(50), nullable=True))
    op.add_column('avatar_measurements', sa.Column(
        'measurement_source',
        sa.String(50),
        server_default='manual',
        nullable=False,
    ))
    op.add_column('avatar_measurements', sa.Column('confidence_score', sa.Float(), nullable=True))


def downgrade() -> None:
    # avatar_measurements
    op.drop_column('avatar_measurements', 'confidence_score')
    op.drop_column('avatar_measurements', 'measurement_source')
    op.drop_column('avatar_measurements', 'body_type')
    op.drop_column('avatar_measurements', 'torso_length_cm')
    op.drop_column('avatar_measurements', 'arm_length_cm')

    # avatars
    op.drop_column('avatars', 'size_history')
    op.drop_column('avatars', 'fit_preference')
    op.drop_column('avatars', 'body_type')
