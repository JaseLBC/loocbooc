"""Manufacturer marketplace — profiles, ratings, connections

Adds three new tables to support the manufacturer marketplace module:
  - manufacturers          — account-level entities
  - manufacturer_profiles  — rich public marketplace listings (1:1 with manufacturers)
  - manufacturer_ratings   — brand reviews (1 per brand per profile, upsert-friendly)
  - brand_manufacturer_connections — enquiry/connection lifecycle

Also creates the connection_status_enum PostgreSQL ENUM type.

Revision ID: 002
Revises: 001
Create Date: 2026-03-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ENUM ──────────────────────────────────────────────────────────────────
    connection_status = postgresql.ENUM(
        "ENQUIRY",
        "RESPONDED",
        "CONNECTED",
        "DECLINED",
        "INACTIVE",
        name="connection_status_enum",
    )
    connection_status.create(op.get_bind(), checkfirst=True)

    # ── manufacturers ─────────────────────────────────────────────────────────
    op.create_table(
        "manufacturers",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("owner_user_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_manufacturers_owner_user_id", "manufacturers", ["owner_user_id"])

    # ── manufacturer_profiles ─────────────────────────────────────────────────
    op.create_table(
        "manufacturer_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column(
            "manufacturer_id",
            postgresql.UUID(as_uuid=False),
            nullable=False,
        ),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("hero_image_url", sa.String(1000), nullable=True),
        sa.Column(
            "gallery_image_urls",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("video_url", sa.String(1000), nullable=True),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("year_established", sa.Integer(), nullable=True),
        sa.Column("employee_count", sa.String(50), nullable=True),
        sa.Column("monthly_capacity_min", sa.Integer(), nullable=True),
        sa.Column("monthly_capacity_max", sa.Integer(), nullable=True),
        sa.Column("moq_min", sa.Integer(), nullable=False),
        sa.Column("moq_max", sa.Integer(), nullable=True),
        sa.Column("sample_lead_time_days", sa.Integer(), nullable=False),
        sa.Column("bulk_lead_time_days", sa.Integer(), nullable=False),
        sa.Column(
            "specialisations",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "materials",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "certifications",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "export_markets",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("price_tier", sa.String(20), nullable=False),
        sa.Column(
            "tech_pack_formats",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "languages",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("response_time_hours", sa.Float(), nullable=True),
        sa.Column("rating_avg", sa.Float(), nullable=True),
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("manufacturer_id", name="uq_manufacturer_profile_manufacturer_id"),
        sa.UniqueConstraint("slug", name="uq_manufacturer_profile_slug"),
        sa.ForeignKeyConstraint(
            ["manufacturer_id"],
            ["manufacturers.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_manufacturer_profiles_slug", "manufacturer_profiles", ["slug"])
    op.create_index("ix_manufacturer_profiles_country", "manufacturer_profiles", ["country"])
    op.create_index("ix_manufacturer_profiles_price_tier", "manufacturer_profiles", ["price_tier"])
    op.create_index("ix_manufacturer_profiles_is_verified", "manufacturer_profiles", ["is_verified"])
    op.create_index("ix_manufacturer_profiles_is_featured", "manufacturer_profiles", ["is_featured"])
    op.create_index(
        "ix_manufacturer_profiles_manufacturer_id",
        "manufacturer_profiles",
        ["manufacturer_id"],
    )

    # GIN index on array columns for fast overlap (&&) queries
    op.create_index(
        "ix_manufacturer_profiles_specialisations_gin",
        "manufacturer_profiles",
        ["specialisations"],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_manufacturer_profiles_certifications_gin",
        "manufacturer_profiles",
        ["certifications"],
        postgresql_using="gin",
    )

    # ── manufacturer_ratings ──────────────────────────────────────────────────
    op.create_table(
        "manufacturer_ratings",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column(
            "manufacturer_profile_id",
            postgresql.UUID(as_uuid=False),
            nullable=False,
        ),
        sa.Column("brand_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("brand_name", sa.String(255), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("quality_score", sa.Integer(), nullable=False),
        sa.Column("communication_score", sa.Integer(), nullable=False),
        sa.Column("timeliness_score", sa.Integer(), nullable=False),
        sa.Column("review", sa.Text(), nullable=True),
        sa.Column("orders_completed", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_verified_purchase", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "manufacturer_profile_id",
            "brand_id",
            name="uq_manufacturer_rating_brand",
        ),
        sa.ForeignKeyConstraint(
            ["manufacturer_profile_id"],
            ["manufacturer_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["brand_id"],
            ["brands.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_manufacturer_ratings_profile_id",
        "manufacturer_ratings",
        ["manufacturer_profile_id"],
    )
    op.create_index("ix_manufacturer_ratings_brand_id", "manufacturer_ratings", ["brand_id"])

    # ── brand_manufacturer_connections ────────────────────────────────────────
    op.create_table(
        "brand_manufacturer_connections",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("brand_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column(
            "manufacturer_profile_id",
            postgresql.UUID(as_uuid=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "ENQUIRY",
                "RESPONDED",
                "CONNECTED",
                "DECLINED",
                "INACTIVE",
                name="connection_status_enum",
                create_type=False,  # already created above
            ),
            nullable=False,
            server_default="ENQUIRY",
        ),
        sa.Column("enquiry_message", sa.Text(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "brand_id",
            "manufacturer_profile_id",
            name="uq_connection_brand_profile",
        ),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["manufacturer_profile_id"],
            ["manufacturer_profiles.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_brand_manufacturer_connections_brand_id",
        "brand_manufacturer_connections",
        ["brand_id"],
    )
    op.create_index(
        "ix_brand_manufacturer_connections_profile_id",
        "brand_manufacturer_connections",
        ["manufacturer_profile_id"],
    )


def downgrade() -> None:
    op.drop_table("brand_manufacturer_connections")
    op.drop_table("manufacturer_ratings")
    op.drop_table("manufacturer_profiles")
    op.drop_table("manufacturers")

    # Drop the ENUM type
    connection_status = postgresql.ENUM(name="connection_status_enum")
    connection_status.drop(op.get_bind(), checkfirst=True)
