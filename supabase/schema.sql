-- Loocbooc Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SHOPS (Merchants using Loocbooc)
-- ============================================
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) UNIQUE NOT NULL, -- mystore.myshopify.com
    access_token TEXT, -- Encrypted Shopify access token
    scopes TEXT,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uninstalled_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shops_domain ON shops(shop_domain);

-- ============================================
-- USERS (Loocbooc customer accounts)
-- ============================================
-- Note: Using Supabase Auth, this extends auth.users
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AVATARS (Customer body models)
-- ============================================
CREATE TABLE avatars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'measurements', 'photos', 'scan'
    
    -- Measurements (in cm)
    measurements JSONB NOT NULL DEFAULT '{}',
    -- {height, weight, bust, waist, hips, inseam, shoulders, armLength}
    
    body_type VARCHAR(50), -- hourglass, pear, apple, rectangle, inverted-triangle
    gender VARCHAR(20),
    
    -- 3D Model
    model_url TEXT,
    model_data JSONB, -- For client-side rendering
    
    -- AI confidence (for photo-based)
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_avatar UNIQUE (user_id)
);

CREATE INDEX idx_avatars_user ON avatars(user_id);

-- ============================================
-- GARMENTS (3D-ready products)
-- ============================================
CREATE TABLE garments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop VARCHAR(255) NOT NULL, -- shop domain
    shopify_product_id VARCHAR(50) NOT NULL,
    
    -- Product info
    title VARCHAR(500),
    product_type VARCHAR(255),
    images JSONB, -- Array of image URLs
    variants JSONB, -- Shopify variants
    
    -- 3D Model
    model_url TEXT,
    model_data JSONB,
    
    -- Size chart (measurements per size)
    size_chart JSONB,
    
    -- Status
    tryon_enabled BOOLEAN DEFAULT true,
    synced_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_shop_product UNIQUE (shop, shopify_product_id)
);

CREATE INDEX idx_garments_shop ON garments(shop);
CREATE INDEX idx_garments_product ON garments(shopify_product_id);
CREATE INDEX idx_garments_enabled ON garments(shop, tryon_enabled) WHERE tryon_enabled = true;

-- ============================================
-- TRY-ON RENDERS (Cached visualizations)
-- ============================================
CREATE TABLE tryon_renders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
    
    size VARCHAR(20),
    color VARCHAR(100),
    
    render_url TEXT,
    render_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_render UNIQUE (avatar_id, garment_id, size, color)
);

CREATE INDEX idx_renders_avatar ON tryon_renders(avatar_id);
CREATE INDEX idx_renders_garment ON tryon_renders(garment_id);

-- ============================================
-- ANALYTICS (Usage tracking)
-- ============================================
CREATE TABLE tryon_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    shop VARCHAR(255),
    garment_id UUID REFERENCES garments(id),
    
    event_type VARCHAR(50) NOT NULL, -- 'view', 'tryon', 'add_to_cart', 'purchase'
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_shop ON tryon_events(shop, created_at);
CREATE INDEX idx_events_garment ON tryon_events(garment_id, created_at);
CREATE INDEX idx_events_type ON tryon_events(event_type, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_events ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can only see/edit their own
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Avatars: Users can only manage their own
CREATE POLICY "Users can view own avatar" ON avatars
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own avatar" ON avatars
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own avatar" ON avatars
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own avatar" ON avatars
    FOR DELETE USING (auth.uid() = user_id);

-- Garments: Public read, shop owners can write
CREATE POLICY "Garments are publicly readable" ON garments
    FOR SELECT USING (tryon_enabled = true);

-- Renders: Users can only see their own
CREATE POLICY "Users can view own renders" ON tryon_renders
    FOR SELECT USING (
        avatar_id IN (SELECT id FROM avatars WHERE user_id = auth.uid())
    );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_avatars_updated_at BEFORE UPDATE ON avatars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_garments_updated_at BEFORE UPDATE ON garments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- WAITLIST (Early interest capture)
-- ============================================
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'customer', -- brand, customer, investor, cto
    company VARCHAR(255),
    monthly_orders INTEGER,
    source VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_type ON waitlist(type);
CREATE INDEX idx_waitlist_created ON waitlist(created_at);
