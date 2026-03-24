# Avatar Generation APIs - Research Notes

## Overview
To generate accurate 3D body models from measurements or photos, we need to integrate with a body estimation API. This document outlines the options.

## Options to Evaluate

### 1. Meshcapade (formerly Body Labs)
**Website:** meshcapade.com
**Tech:** SMPL body model (industry standard)
**Offerings:**
- Measurements → SMPL body model
- Single photo → body estimation
- Body scan processing
**Pros:** Industry standard, high accuracy, scientific backing
**Cons:** Enterprise pricing, may need direct partnership
**API:** Yes, requires business account

### 2. Avaturn
**Website:** avaturn.me
**Tech:** 3D avatars from single selfie
**Offerings:**
- Photo → stylized 3D avatar
- Web SDK
- Unity/Unreal integration
**Pros:** Easy integration, free tier available
**Cons:** More stylized (game-like), not photorealistic
**API:** Yes, developer-friendly

### 3. Ready Player Me
**Website:** readyplayerme.com
**Tech:** Cross-platform avatar system
**Offerings:**
- Photo → avatar
- Customization tools
- Clothing integration
**Pros:** Widely used, good ecosystem
**Cons:** Stylized look, may not suit fashion accurate try-on
**API:** Yes, generous free tier

### 4. PIFuHD / Custom ML
**Source:** GitHub (Meta Research)
**Tech:** Single image → 3D reconstruction
**Offerings:**
- Open source
- Self-hosted
**Pros:** Free, customizable
**Cons:** Requires ML infrastructure, more work to productize
**API:** DIY

### 5. BodyBlock AI
**Tech:** Body measurements from photos
**Offerings:**
- Photo → measurements
- Size recommendation
**Pros:** Fashion-focused
**Cons:** Not full 3D avatar
**API:** Yes

### 6. 3DLOOK
**Website:** 3dlook.ai
**Tech:** Mobile body scanning
**Offerings:**
- Photo → measurements
- Size recommendation
- 3D avatar (YourFit)
**Pros:** Fashion industry focused, Shopify integration
**Cons:** Enterprise pricing
**API:** Yes

## Recommended Approach

### MVP (Now)
1. **Manual measurements only** - Already implemented
2. **Simple parametric body model** - Use predefined body types + Three.js

### Phase 2 (Post-funding)
1. **Integrate Avaturn or Ready Player Me** for quick avatar generation
2. **Add 3DLOOK or BodyBlock** for photo → measurements

### Phase 3 (Scale)
1. **Meshcapade partnership** for highest accuracy
2. **Custom ML pipeline** for proprietary scanning (ScanSuit)

## Technical Integration Notes

### Three.js Body Model
We can create parametric bodies in Three.js using:
- Morphing between body type presets
- Scaling based on measurements (bust/waist/hips ratios)
- Skinned mesh with adjustable bones

### SMPL Format
Industry standard for body models:
- Shape parameters (β) - body shape variation
- Pose parameters (θ) - joint rotations
- Translation (t) - global position

### File Formats
- GLB/GLTF - best for web (Three.js native)
- FBX - good for game engines
- OBJ - simple but no rigging

## Next Steps
1. [ ] Sign up for Avaturn developer account
2. [ ] Test Ready Player Me SDK
3. [ ] Contact Meshcapade for partnership pricing
4. [ ] Prototype parametric body in Three.js

---
*Last updated: March 24, 2026*
