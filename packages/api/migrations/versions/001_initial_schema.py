"""Initial schema — all tables

Revision ID: 001
Revises: 
Create Date: 2026-03-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- brands ---
    op.create_table(
        "brands",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("brand_code", sa.String(4), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("settings", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("brand_code"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_brands_brand_code", "brands", ["brand_code"])
    op.create_index("ix_brands_slug", "brands", ["slug"])

    # --- api_keys ---
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("brand_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash"),
    )
    op.create_index("ix_api_keys_brand_id", "api_keys", ["brand_id"])

    # --- brand_integrations ---
    op.create_table(
        "brand_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("brand_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("integration_type", sa.String(50), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- fabric_physics ---
    op.create_table(
        "fabric_physics",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("composition_hash", sa.String(64), nullable=False),
        sa.Column("composition_raw", sa.Text(), nullable=False),
        sa.Column("composition_normalized", sa.String(500), nullable=False),
        sa.Column("fibre_breakdown", postgresql.JSONB(), nullable=False),
        sa.Column("drape_coefficient", sa.Float(), nullable=False),
        sa.Column("stretch_x", sa.Float(), nullable=False),
        sa.Column("stretch_y", sa.Float(), nullable=False),
        sa.Column("recovery_rate", sa.Float(), nullable=False),
        sa.Column("weight_gsm", sa.Float(), nullable=False),
        sa.Column("sheen_level", sa.Float(), nullable=False),
        sa.Column("heat_response", sa.Float(), nullable=False),
        sa.Column("pilling_resistance", sa.Float(), nullable=False),
        sa.Column("breathability", sa.Float(), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("is_estimated", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("composition_hash"),
    )
    op.create_index("ix_fabric_physics_composition_hash", "fabric_physics", ["composition_hash"])
    op.create_index("ix_fabric_physics_drape", "fabric_physics", ["drape_coefficient"])

    # --- garments ---
    op.create_table(
        "garments",
        sa.Column("id", sa.String(50), nullable=False),  # UGI is the primary key
        sa.Column("brand_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "processing", "active", "archived", name="garmentstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "category",
            sa.Enum(
                "tops", "bottoms", "dresses", "outerwear", "underwear",
                "swimwear", "activewear", "footwear", "accessories", "bags", "hats", "other",
                name="garmentcategory",
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sku", sa.String(200), nullable=True),
        sa.Column("fabric_physics_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("dpp_data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("size_chart", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["fabric_physics_id"], ["fabric_physics.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_garments_id", "garments", ["id"])
    op.create_index("ix_garments_brand_id", "garments", ["brand_id"])
    op.create_index("ix_garments_status", "garments", ["status"])
    op.create_index("ix_garments_category", "garments", ["category"])
    op.create_index("ix_garments_sku", "garments", ["sku"])

    # --- garment_versions ---
    op.create_table(
        "garment_versions",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("garment_id", sa.String(50), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("changed_by", sa.String(255), nullable=True),
        sa.Column("change_type", sa.String(50), nullable=False),
        sa.Column("diff", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["garment_id"], ["garments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_garment_versions_garment_id", "garment_versions", ["garment_id"])

    # --- garment_files ---
    op.create_table(
        "garment_files",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("garment_id", sa.String(50), nullable=False),
        sa.Column(
            "file_type",
            sa.Enum(
                "photo", "video", "pattern_ai", "pattern_dxf", "clo3d",
                "marvelous", "model_3d", "tech_pack", "other",
                name="garmentfiletype",
            ),
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("storage_key", sa.String(1000), nullable=False),
        sa.Column("storage_url", sa.String(2000), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("width_px", sa.Integer(), nullable=True),
        sa.Column("height_px", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("processing_status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("processing_metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["garment_id"], ["garments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_garment_files_garment_id", "garment_files", ["garment_id"])
    op.create_index("ix_garment_files_file_type", "garment_files", ["file_type"])

    # --- avatars ---
    op.create_table(
        "avatars",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=True),
        sa.Column("name", sa.String(200), nullable=False, server_default="My Avatar"),
        sa.Column("gender", sa.String(50), nullable=True),
        sa.Column("age_range", sa.String(20), nullable=True),
        sa.Column("scan_source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("scan_data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("style_profile", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_avatars_user_id", "avatars", ["user_id"])

    # --- avatar_measurements ---
    op.create_table(
        "avatar_measurements",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("avatar_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("chest_cm", sa.Float(), nullable=True),
        sa.Column("waist_cm", sa.Float(), nullable=True),
        sa.Column("hips_cm", sa.Float(), nullable=True),
        sa.Column("inseam_cm", sa.Float(), nullable=True),
        sa.Column("shoulder_width_cm", sa.Float(), nullable=True),
        sa.Column("sleeve_length_cm", sa.Float(), nullable=True),
        sa.Column("neck_cm", sa.Float(), nullable=True),
        sa.Column("thigh_cm", sa.Float(), nullable=True),
        sa.Column("extended_measurements", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["avatar_id"], ["avatars.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_avatar_measurements_avatar_id", "avatar_measurements", ["avatar_id"])

    # --- try_ons ---
    op.create_table(
        "try_ons",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("garment_id", sa.String(50), nullable=False),
        sa.Column("avatar_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("size", sa.String(20), nullable=True),
        sa.Column("scoring_method", sa.String(50), nullable=False, server_default="rule_based"),
        sa.Column("consumer_feedback", sa.String(20), nullable=True),
        sa.Column("consumer_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["garment_id"], ["garments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["avatar_id"], ["avatars.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_try_ons_garment_id", "try_ons", ["garment_id"])
    op.create_index("ix_try_ons_avatar_id", "try_ons", ["avatar_id"])

    # --- fit_scores ---
    op.create_table(
        "fit_scores",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("try_on_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("overall", sa.Float(), nullable=False),
        sa.Column("chest_fit", sa.String(30), nullable=True),
        sa.Column("waist_fit", sa.String(30), nullable=True),
        sa.Column("hips_fit", sa.String(30), nullable=True),
        sa.Column("length_fit", sa.String(30), nullable=True),
        sa.Column("shoulder_fit", sa.String(30), nullable=True),
        sa.Column("sleeve_fit", sa.String(30), nullable=True),
        sa.Column("recommendation", sa.String(50), nullable=True),
        sa.Column("measurement_deltas", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("raw_scores", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["try_on_id"], ["try_ons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("try_on_id"),
    )
    op.create_index("ix_fit_scores_try_on_id", "fit_scores", ["try_on_id"])


def downgrade() -> None:
    op.drop_table("fit_scores")
    op.drop_table("try_ons")
    op.drop_table("avatar_measurements")
    op.drop_table("avatars")
    op.drop_table("garment_files")
    op.drop_table("garment_versions")
    op.drop_table("garments")
    op.drop_table("fabric_physics")
    op.drop_table("brand_integrations")
    op.drop_table("api_keys")
    op.drop_table("brands")
    op.execute("DROP TYPE IF EXISTS garmentstatus")
    op.execute("DROP TYPE IF EXISTS garmentcategory")
    op.execute("DROP TYPE IF EXISTS garmentfiletype")
