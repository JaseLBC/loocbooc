/**
 * Manufacturer Marketplace — Service layer.
 *
 * All business logic lives here. Routes are thin wrappers.
 *
 * Key design decisions:
 * - Search is indexed on country, priceTier, isVerified for fast filtering
 * - Ratings are immutable after 24h (checked on update attempt)
 * - Match algorithm is in matching.ts — scoring weights never exposed to client
 * - Profile updates go through the manufacturer's own userId check
 */

import { prisma, Prisma } from "@loocbooc/database";

type ManufacturerProfile = Prisma.ManufacturerProfileGetPayload<Record<string, never>>;
type ManufacturerRating = Prisma.ManufacturerRatingGetPayload<Record<string, never>>;
import type {
  SearchManufacturersQuery,
  UpdateProfileInput,
  CreateEnquiryInput,
  RespondToEnquiryInput,
  SubmitRatingInput,
} from "./schema";
import type {
  AggregatedRatings,
  ManufacturerProfileSummary,
  ManufacturerProfileFull,
  PaginatedManufacturers,
  ConnectionResult,
  ReviewSummary,
} from "./types";

// ─────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// ─────────────────────────────────────────────
// Rating aggregation helper (exported for matching.ts)
// ─────────────────────────────────────────────

export function aggregateRatings(ratings: ManufacturerRating[]): AggregatedRatings {
  const verified = ratings.filter((r) => r.isVerifiedPurchase);
  if (verified.length === 0) {
    return { overall: 0, quality: 0, communication: 0, timeliness: 0, totalReviews: 0 };
  }
  const avg = (arr: number[]) =>
    Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;

  return {
    overall: avg(verified.map((r) => r.overallScore)),
    quality: avg(verified.map((r) => r.qualityScore)),
    communication: avg(verified.map((r) => r.communicationScore)),
    timeliness: avg(verified.map((r) => r.timelinessScore)),
    totalReviews: verified.length,
  };
}

// ─────────────────────────────────────────────
// Profile shape helpers
// ─────────────────────────────────────────────

function toSummary(
  profile: ManufacturerProfile & { ratings: ManufacturerRating[] },
): ManufacturerProfileSummary {
  return {
    id: profile.id,
    manufacturerId: profile.manufacturerId,
    displayName: profile.displayName,
    heroImageUrl: profile.heroImageUrl,
    country: profile.country,
    city: profile.city,
    moqMin: profile.moqMin,
    moqMax: profile.moqMax,
    sampleLeadTimeDays: profile.sampleLeadTimeDays,
    bulkLeadTimeDays: profile.bulkLeadTimeDays,
    specialisations: profile.specialisations,
    certifications: profile.certifications,
    priceTier: profile.priceTier,
    isVerified: profile.isVerified,
    isFeatured: profile.isFeatured,
    responseTimeHours: profile.responseTimeHours,
    ratings: aggregateRatings(profile.ratings),
  };
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────

export async function searchManufacturers(
  filters: SearchManufacturersQuery,
): Promise<PaginatedManufacturers> {
  const {
    country,
    specialisation,
    certifications,
    moqMin,
    moqMax,
    priceTier,
    capacityMin,
    isVerified,
    page,
    limit,
  } = filters;

  const offset = (page - 1) * limit;

  // Build where clause
  const where: Parameters<typeof prisma.manufacturerProfile.findMany>[0]["where"] = {
    manufacturer: { active: true },
  };

  if (country) where.country = country;
  if (priceTier) where.priceTier = priceTier;
  if (isVerified !== undefined) where.isVerified = isVerified;

  if (moqMin !== undefined) where.moqMin = { gte: moqMin };
  if (moqMax !== undefined) {
    where.moqMin = { ...(where.moqMin as object), lte: moqMax };
  }

  if (capacityMin !== undefined) {
    where.monthlyCapacityMin = { gte: capacityMin };
  }

  // Array-contains filters
  if (specialisation) {
    where.specialisations = { has: specialisation };
  }
  if (certifications) {
    const certs = certifications.split(",").map((c) => c.trim()).filter(Boolean);
    if (certs.length === 1) {
      where.certifications = { has: certs[0] };
    } else if (certs.length > 1) {
      where.certifications = { hasEvery: certs };
    }
  }

  const [total, profiles] = await Promise.all([
    prisma.manufacturerProfile.count({ where }),
    prisma.manufacturerProfile.findMany({
      where,
      include: { ratings: true },
      orderBy: [
        { isVerified: "desc" },
        { isFeatured: "desc" },
        { responseTimeHours: "asc" },
      ],
      skip: offset,
      take: limit,
    }),
  ]);

  // Sort verified-first within query result, then by weighted rating desc
  type ProfileWithRatings = typeof profiles[number];
  const sorted = profiles.sort((a: ProfileWithRatings, b: ProfileWithRatings) => {
    if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
    const rA = aggregateRatings(a.ratings).overall;
    const rB = aggregateRatings(b.ratings).overall;
    if (rA !== rB) return rB - rA;
    const rtA = a.responseTimeHours ?? Infinity;
    const rtB = b.responseTimeHours ?? Infinity;
    return rtA - rtB;
  });

  return {
    data: sorted.map(toSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─────────────────────────────────────────────
// Get single profile (full)
// ─────────────────────────────────────────────

export async function getManufacturerProfile(id: string): Promise<ManufacturerProfileFull> {
  const profile = await prisma.manufacturerProfile.findUnique({
    where: { id },
    include: {
      ratings: {
        where: { isVerifiedPurchase: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { brand: { select: { id: true, name: true } } },
      },
      manufacturer: true,
    },
  });

  if (!profile) {
    throw new ServiceError("MANUFACTURER_NOT_FOUND", "Manufacturer profile not found.", 404);
  }

  const ratingData = aggregateRatings(profile.ratings);

  type RatingWithBrand = typeof profile.ratings[number] & { brand: { id: string; name: string } };
  const recentReviews: ReviewSummary[] = profile.ratings.map((r: RatingWithBrand) => ({
    id: r.id,
    brandId: r.brandId,
    brandName: r.brand.name,
    overallScore: r.overallScore,
    qualityScore: r.qualityScore,
    communicationScore: r.communicationScore,
    timelinessScore: r.timelinessScore,
    review: r.review,
    ordersCompleted: r.ordersCompleted,
    createdAt: r.createdAt,
  }));

  // Related: same country + overlapping specialisations, max 4
  const related = await prisma.manufacturerProfile.findMany({
    where: {
      id: { not: id },
      country: profile.country,
      manufacturer: { active: true },
      specialisations: {
        hasSome: profile.specialisations.slice(0, 3),
      },
    },
    include: { ratings: true },
    take: 4,
    orderBy: { isVerified: "desc" },
  });

  return {
    id: profile.id,
    manufacturerId: profile.manufacturerId,
    displayName: profile.displayName,
    heroImageUrl: profile.heroImageUrl,
    country: profile.country,
    city: profile.city,
    moqMin: profile.moqMin,
    moqMax: profile.moqMax,
    sampleLeadTimeDays: profile.sampleLeadTimeDays,
    bulkLeadTimeDays: profile.bulkLeadTimeDays,
    specialisations: profile.specialisations,
    certifications: profile.certifications,
    priceTier: profile.priceTier,
    isVerified: profile.isVerified,
    isFeatured: profile.isFeatured,
    responseTimeHours: profile.responseTimeHours,
    ratings: ratingData,
    description: profile.description,
    galleryImageUrls: profile.galleryImageUrls,
    videoUrl: profile.videoUrl,
    yearEstablished: profile.yearEstablished,
    employeeCount: profile.employeeCount,
    monthlyCapacityMin: profile.monthlyCapacityMin,
    monthlyCapacityMax: profile.monthlyCapacityMax,
    materials: profile.materials,
    exportMarkets: profile.exportMarkets,
    techPackFormats: profile.techPackFormats,
    languages: profile.languages,
    verifiedAt: profile.verifiedAt,
    recentReviews,
    relatedManufacturers: related.map(toSummary),
  };
}

// ─────────────────────────────────────────────
// Featured manufacturers
// ─────────────────────────────────────────────

export async function getFeaturedManufacturers(): Promise<ManufacturerProfileSummary[]> {
  const profiles = await prisma.manufacturerProfile.findMany({
    where: {
      isFeatured: true,
      manufacturer: { active: true },
    },
    include: { ratings: true },
    orderBy: { isVerified: "desc" },
    take: 12,
  });
  return profiles.map(toSummary);
}

// ─────────────────────────────────────────────
// Enquiry / Connection
// ─────────────────────────────────────────────

export async function createEnquiry(
  brandId: string,
  manufacturerProfileId: string,
  input: CreateEnquiryInput,
): Promise<ConnectionResult> {
  // Check profile exists
  const profile = await prisma.manufacturerProfile.findUnique({
    where: { id: manufacturerProfileId },
  });
  if (!profile) {
    throw new ServiceError("MANUFACTURER_NOT_FOUND", "Manufacturer profile not found.", 404);
  }

  // Check for existing connection
  const existing = await prisma.brandManufacturerConnection.findUnique({
    where: { brandId_manufacturerProfileId: { brandId, manufacturerProfileId } },
  });
  if (existing) {
    throw new ServiceError(
      "CONNECTION_ALREADY_EXISTS",
      "You already have a connection or pending enquiry with this manufacturer.",
      409,
    );
  }

  const connection = await prisma.brandManufacturerConnection.create({
    data: {
      brandId,
      manufacturerProfileId,
      status: "ENQUIRY",
      enquiryMessage: input.message,
    },
  });

  return {
    id: connection.id,
    brandId: connection.brandId,
    manufacturerProfileId: connection.manufacturerProfileId,
    status: connection.status,
    enquiryMessage: connection.enquiryMessage,
    respondedAt: connection.respondedAt,
    connectedAt: connection.connectedAt,
    createdAt: connection.createdAt,
  };
}

export async function respondToEnquiry(
  connectionId: string,
  manufacturerUserId: string,
  input: RespondToEnquiryInput,
): Promise<ConnectionResult> {
  const connection = await prisma.brandManufacturerConnection.findUnique({
    where: { id: connectionId },
    include: { manufacturerProfile: { include: { manufacturer: true } } },
  });

  if (!connection) {
    throw new ServiceError("CONNECTION_NOT_FOUND", "Connection not found.", 404);
  }

  // Verify the responding user owns this manufacturer
  if (connection.manufacturerProfile.manufacturer.ownerUserId !== manufacturerUserId) {
    throw new ServiceError("FORBIDDEN", "You are not authorised to respond to this enquiry.", 403);
  }

  if (connection.status !== "ENQUIRY") {
    throw new ServiceError(
      "INVALID_STATUS",
      "This enquiry has already been responded to.",
      409,
    );
  }

  const now = new Date();
  const updated = await prisma.brandManufacturerConnection.update({
    where: { id: connectionId },
    data: {
      status: input.accept ? "CONNECTED" : "DECLINED",
      respondedAt: now,
      connectedAt: input.accept ? now : null,
    },
  });

  return {
    id: updated.id,
    brandId: updated.brandId,
    manufacturerProfileId: updated.manufacturerProfileId,
    status: updated.status,
    enquiryMessage: updated.enquiryMessage,
    respondedAt: updated.respondedAt,
    connectedAt: updated.connectedAt,
    createdAt: updated.createdAt,
  };
}

// ─────────────────────────────────────────────
// Brand's connections list
// ─────────────────────────────────────────────

export async function getBrandConnections(brandId: string): Promise<ConnectionResult[]> {
  const connections = await prisma.brandManufacturerConnection.findMany({
    where: { brandId },
    include: {
      manufacturerProfile: {
        include: { ratings: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type ConnectionWithProfile = typeof connections[number];
  return connections.map((c: ConnectionWithProfile) => ({
    id: c.id,
    brandId: c.brandId,
    manufacturerProfileId: c.manufacturerProfileId,
    status: c.status,
    enquiryMessage: c.enquiryMessage,
    respondedAt: c.respondedAt,
    connectedAt: c.connectedAt,
    createdAt: c.createdAt,
    manufacturerProfile: toSummary(c.manufacturerProfile as (ManufacturerProfile & { ratings: ManufacturerRating[] })),
  }));
}

// ─────────────────────────────────────────────
// Rating submission
// ─────────────────────────────────────────────

export async function submitRating(
  brandId: string,
  manufacturerProfileId: string,
  input: SubmitRatingInput,
): Promise<ManufacturerRating> {
  // Verify manufacturer profile exists
  const profile = await prisma.manufacturerProfile.findUnique({
    where: { id: manufacturerProfileId },
  });
  if (!profile) {
    throw new ServiceError("MANUFACTURER_NOT_FOUND", "Manufacturer profile not found.", 404);
  }

  // Must have a CONNECTED relationship to rate
  const connection = await prisma.brandManufacturerConnection.findUnique({
    where: { brandId_manufacturerProfileId: { brandId, manufacturerProfileId } },
  });
  if (!connection || connection.status !== "CONNECTED") {
    throw new ServiceError(
      "NOT_CONNECTED",
      "You must have a confirmed connection with this manufacturer before rating them.",
      403,
    );
  }

  // Check for existing rating — ratings are immutable after 24h
  const existing = await prisma.manufacturerRating.findUnique({
    where: {
      manufacturerProfileId_brandId: { manufacturerProfileId, brandId },
    },
  });
  if (existing) {
    const ageMs = Date.now() - existing.createdAt.getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (ageMs > TWENTY_FOUR_HOURS) {
      throw new ServiceError(
        "RATING_IMMUTABLE",
        "Ratings cannot be edited after 24 hours of submission.",
        409,
      );
    }
    // Within 24h — allow update
    return prisma.manufacturerRating.update({
      where: {
        manufacturerProfileId_brandId: { manufacturerProfileId, brandId },
      },
      data: {
        overallScore: input.overallScore,
        qualityScore: input.qualityScore,
        communicationScore: input.communicationScore,
        timelinessScore: input.timelinessScore,
        review: input.review,
        ordersCompleted: input.ordersCompleted,
      },
    });
  }

  return prisma.manufacturerRating.create({
    data: {
      manufacturerProfileId,
      brandId,
      overallScore: input.overallScore,
      qualityScore: input.qualityScore,
      communicationScore: input.communicationScore,
      timelinessScore: input.timelinessScore,
      review: input.review,
      ordersCompleted: input.ordersCompleted,
      isVerifiedPurchase: true,
    },
  });
}

// ─────────────────────────────────────────────
// Manufacturer's incoming connections (manufacturer POV)
// ─────────────────────────────────────────────

export interface IncomingConnection {
  id: string;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  brandCountry: string | null;
  status: string;
  enquiryMessage: string | null;
  respondedAt: Date | null;
  connectedAt: Date | null;
  createdAt: Date;
}

export async function getManufacturerIncomingConnections(
  manufacturerUserId: string,
): Promise<IncomingConnection[]> {
  // Resolve manufacturer profile via userId
  const manufacturer = await prisma.manufacturer.findFirst({
    where: { ownerUserId: manufacturerUserId },
    include: { profile: true },
  });

  if (!manufacturer?.profile) {
    return []; // No profile yet — no connections
  }

  const connections = await prisma.brandManufacturerConnection.findMany({
    where: { manufacturerProfileId: manufacturer.profile.id },
    include: {
      brand: {
        select: { id: true, name: true, logoUrl: true, country: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type RawConn = typeof connections[number];
  return connections.map((c: RawConn) => ({
    id: c.id,
    brandId: c.brandId,
    brandName: c.brand.name,
    brandLogoUrl: c.brand.logoUrl,
    brandCountry: c.brand.country,
    status: c.status,
    enquiryMessage: c.enquiryMessage,
    respondedAt: c.respondedAt,
    connectedAt: c.connectedAt,
    createdAt: c.createdAt,
  }));
}

export async function getManufacturerProfileForOwner(
  manufacturerUserId: string,
): Promise<ManufacturerProfileSummary | null> {
  const manufacturer = await prisma.manufacturer.findFirst({
    where: { ownerUserId: manufacturerUserId },
    include: {
      profile: {
        include: { ratings: true },
      },
    },
  });
  if (!manufacturer?.profile) return null;
  return toSummary(manufacturer.profile as (ManufacturerProfile & { ratings: ManufacturerRating[] }));
}

// ─────────────────────────────────────────────
// Profile management
// ─────────────────────────────────────────────

export async function updateProfile(
  manufacturerUserId: string,
  data: UpdateProfileInput,
): Promise<ManufacturerProfileSummary> {
  // Find this manufacturer's profile via their user ID
  const manufacturer = await prisma.manufacturer.findFirst({
    where: { ownerUserId: manufacturerUserId },
    include: { profile: true },
  });

  if (!manufacturer) {
    throw new ServiceError("MANUFACTURER_NOT_FOUND", "Manufacturer account not found.", 404);
  }

  let profile: ManufacturerProfile & { ratings: ManufacturerRating[] };

  if (!manufacturer.profile) {
    // Create profile if it doesn't exist yet
    const created = await prisma.manufacturerProfile.create({
      data: {
        manufacturerId: manufacturer.id,
        displayName: data.displayName ?? manufacturer.name,
        description: data.description,
        heroImageUrl: data.heroImageUrl,
        galleryImageUrls: data.galleryImageUrls ?? [],
        videoUrl: data.videoUrl,
        country: data.country ?? manufacturer.country,
        city: data.city,
        yearEstablished: data.yearEstablished,
        employeeCount: data.employeeCount,
        monthlyCapacityMin: data.monthlyCapacityMin,
        monthlyCapacityMax: data.monthlyCapacityMax,
        moqMin: data.moqMin ?? manufacturer.minOrderQty ?? 0,
        moqMax: data.moqMax,
        sampleLeadTimeDays: data.sampleLeadTimeDays ?? manufacturer.leadTimeDaysMin ?? 14,
        bulkLeadTimeDays: data.bulkLeadTimeDays ?? manufacturer.leadTimeDaysMax ?? 45,
        specialisations: data.specialisations ?? manufacturer.specialisations,
        materials: data.materials ?? [],
        certifications: data.certifications ?? manufacturer.certifications,
        exportMarkets: data.exportMarkets ?? [],
        priceTier: data.priceTier ?? manufacturer.priceTier ?? "mid",
        techPackFormats: data.techPackFormats ?? [],
        languages: data.languages ?? [],
      },
      include: { ratings: true },
    });
    profile = created;
  } else {
    const updated = await prisma.manufacturerProfile.update({
      where: { id: manufacturer.profile.id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.heroImageUrl !== undefined && { heroImageUrl: data.heroImageUrl }),
        ...(data.galleryImageUrls !== undefined && { galleryImageUrls: data.galleryImageUrls }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.yearEstablished !== undefined && { yearEstablished: data.yearEstablished }),
        ...(data.employeeCount !== undefined && { employeeCount: data.employeeCount }),
        ...(data.monthlyCapacityMin !== undefined && { monthlyCapacityMin: data.monthlyCapacityMin }),
        ...(data.monthlyCapacityMax !== undefined && { monthlyCapacityMax: data.monthlyCapacityMax }),
        ...(data.moqMin !== undefined && { moqMin: data.moqMin }),
        ...(data.moqMax !== undefined && { moqMax: data.moqMax }),
        ...(data.sampleLeadTimeDays !== undefined && { sampleLeadTimeDays: data.sampleLeadTimeDays }),
        ...(data.bulkLeadTimeDays !== undefined && { bulkLeadTimeDays: data.bulkLeadTimeDays }),
        ...(data.specialisations !== undefined && { specialisations: data.specialisations }),
        ...(data.materials !== undefined && { materials: data.materials }),
        ...(data.certifications !== undefined && { certifications: data.certifications }),
        ...(data.exportMarkets !== undefined && { exportMarkets: data.exportMarkets }),
        ...(data.priceTier !== undefined && { priceTier: data.priceTier }),
        ...(data.techPackFormats !== undefined && { techPackFormats: data.techPackFormats }),
        ...(data.languages !== undefined && { languages: data.languages }),
      },
      include: { ratings: true },
    });
    profile = updated;
  }

  return toSummary(profile);
}
