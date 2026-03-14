/**
 * Manufacturer Profile Page — Brand view
 *
 * Layout:
 * - Hero image + headline
 * - Gallery strip
 * - Description + specs table
 * - Certifications + export markets
 * - Aggregated ratings (overall + sub-scores)
 * - Verified reviews from brands
 * - "Connect" CTA — opens enquiry modal
 * - Related manufacturers sidebar
 *
 * Design: the manufacturer is the hero. The brand's only decision
 * on this page is whether to connect. Everything else serves that.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AggregatedRatings {
  overall: number;
  quality: number;
  communication: number;
  timeliness: number;
  totalReviews: number;
}

interface ReviewSummary {
  id: string;
  brandId: string;
  brandName: string;
  overallScore: number;
  qualityScore: number;
  communicationScore: number;
  timelinessScore: number;
  review: string | null;
  ordersCompleted: number;
  createdAt: string;
}

interface ManufacturerSummary {
  id: string;
  displayName: string;
  heroImageUrl: string | null;
  country: string;
  city: string | null;
  moqMin: number;
  moqMax: number | null;
  sampleLeadTimeDays: number;
  bulkLeadTimeDays: number;
  specialisations: string[];
  certifications: string[];
  priceTier: string;
  isVerified: boolean;
  isFeatured: boolean;
  responseTimeHours: number | null;
  ratings: AggregatedRatings;
}

interface ManufacturerProfileFull extends ManufacturerSummary {
  description: string | null;
  galleryImageUrls: string[];
  videoUrl: string | null;
  yearEstablished: number | null;
  employeeCount: string | null;
  monthlyCapacityMin: number | null;
  monthlyCapacityMax: number | null;
  materials: string[];
  exportMarkets: string[];
  techPackFormats: string[];
  languages: string[];
  verifiedAt: string | null;
  recentReviews: ReviewSummary[];
  relatedManufacturers: ManufacturerSummary[];
}

// ─────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────

function VerifiedBadge({ verifiedAt }: { verifiedAt: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 0L7.42 3.93L11.41 3.71L8.51 6.21L9.53 10.09L6 8.16L2.47 10.09L3.49 6.21L0.59 3.71L4.58 3.93L6 0Z" />
      </svg>
      Verified manufacturer
      {verifiedAt && (
        <span className="text-[#22C55E]/70 text-xs">
          · {new Date(verifiedAt).getFullYear()}
        </span>
      )}
    </span>
  );
}

function RatingBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--text-secondary)] w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-[var(--duration-slow)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-[var(--text-primary)] w-8 text-right shrink-0">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  const filled = Math.round(score);
  return (
    <div className="flex gap-1" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-lg ${i <= filled ? "text-amber-400" : "text-[var(--surface-3)]"}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function RelatedCard({ manufacturer }: { manufacturer: ManufacturerSummary }) {
  return (
    <Link
      href={`/manufacturers/${manufacturer.id}`}
      className="flex gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors group"
    >
      <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--surface-2)] overflow-hidden shrink-0 relative">
        {manufacturer.heroImageUrl ? (
          <Image
            src={manufacturer.heroImageUrl}
            alt={manufacturer.displayName}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xl">🏭</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--loocbooc-accent)] transition-colors">
          {manufacturer.displayName}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">{manufacturer.country}</p>
        <p className="text-xs text-[var(--text-tertiary)]">MOQ {manufacturer.moqMin.toLocaleString()}</p>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Enquiry modal
// ─────────────────────────────────────────────

function EnquiryModal({
  manufacturerName,
  onClose,
  onSubmit,
  submitting,
  success,
}: {
  manufacturerName: string;
  onClose: () => void;
  onSubmit: (message: string) => void;
  submitting: boolean;
  success: boolean;
}) {
  const [message, setMessage] = useState("");

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-8 max-w-md w-full text-center shadow-[var(--shadow-4)]">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="font-semibold text-xl text-[var(--text-primary)] mb-2">Enquiry sent</h3>
          <p className="text-[var(--text-secondary)]">
            Your enquiry has been sent to {manufacturerName}. They'll typically respond within{" "}
            <strong>24–48 hours</strong>.
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity w-full"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-8 max-w-lg w-full shadow-[var(--shadow-4)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        <h3 className="font-semibold text-xl text-[var(--text-primary)] mb-1">
          Connect with {manufacturerName}
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          Introduce yourself and describe what you're looking to produce.
          Be specific — better context gets faster, better responses.
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Hi, we're a women's fashion brand looking to produce [garment type]. Our typical MOQ is [qty] units per style. We're interested in your capabilities for [category]. Would love to connect…`}
          rows={6}
          className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)] resize-none"
        />

        <div className="flex items-center justify-between mt-2 mb-6">
          <span className={`text-xs ${message.length < 10 ? "text-[var(--color-error)]" : "text-[var(--text-tertiary)]"}`}>
            {message.length}/2000 characters
          </span>
        </div>

        <button
          onClick={() => onSubmit(message)}
          disabled={message.length < 10 || submitting}
          className="w-full py-3.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? "Sending…" : "Send enquiry"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page skeleton
// ─────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto px-8 py-10 animate-pulse">
      <div className="h-80 bg-[var(--surface-2)] rounded-[var(--radius-xl)] mb-8" />
      <div className="flex gap-8">
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-[var(--surface-2)] rounded w-1/2" />
          <div className="h-4 bg-[var(--surface-2)] rounded w-1/4" />
          <div className="h-32 bg-[var(--surface-2)] rounded" />
        </div>
        <div className="w-72 space-y-4">
          <div className="h-48 bg-[var(--surface-2)] rounded-[var(--radius-xl)]" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tech pack format labels
// ─────────────────────────────────────────────

const TECH_PACK_LABELS: Record<string, string> = {
  pdf: "PDF",
  excel: "Excel",
  clo3d: "CLO 3D",
  loocbooc_native: "Loocbooc Native",
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ManufacturerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [profile, setProfile] = useState<ManufacturerProfileFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeGalleryIdx, setActiveGalleryIdx] = useState(0);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/v1/manufacturers/${id}`)
      .then((res) => {
        if (res.status === 404) { setNotFound(true); return null; }
        return res.json() as Promise<ManufacturerProfileFull>;
      })
      .then((data) => { if (data) setProfile(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleEnquirySubmit = async (message: string) => {
    if (!profile) return;
    setEnquirySubmitting(true);
    setEnquiryError(null);
    try {
      const res = await fetch(`/api/v1/manufacturers/${profile.id}/enquire`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed to send enquiry");
      }
      setEnquirySuccess(true);
    } catch (err) {
      setEnquiryError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setEnquirySubmitting(false);
    }
  };

  if (loading) return <ProfileSkeleton />;

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[var(--loocbooc-white)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🏭</p>
          <h2 className="font-semibold text-xl text-[var(--text-primary)] mb-2">Manufacturer not found</h2>
          <p className="text-[var(--text-secondary)] mb-6">This manufacturer profile doesn't exist or has been removed.</p>
          <Link
            href="/manufacturers"
            className="px-6 py-3 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Browse manufacturers
          </Link>
        </div>
      </div>
    );
  }

  const galleryImages = [
    ...(profile.heroImageUrl ? [profile.heroImageUrl] : []),
    ...profile.galleryImageUrls,
  ].filter(Boolean);

  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const capacityLabel = profile.monthlyCapacityMin && profile.monthlyCapacityMax
    ? `${profile.monthlyCapacityMin.toLocaleString()}–${profile.monthlyCapacityMax.toLocaleString()} units/mo`
    : profile.monthlyCapacityMin
    ? `${profile.monthlyCapacityMin.toLocaleString()}+ units/mo`
    : "—";

  return (
    <div className="min-h-screen bg-[var(--loocbooc-white)]">

      {/* Breadcrumb */}
      <div className="max-w-screen-xl mx-auto px-8 pt-6">
        <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Link href="/manufacturers" className="hover:text-[var(--text-secondary)] transition-colors">
            Manufacturers
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)]">{profile.displayName}</span>
        </nav>
      </div>

      <div className="max-w-screen-xl mx-auto px-8 py-8">
        <div className="flex gap-8 items-start">

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div className="mb-8">
                {/* Main image */}
                <div className="relative aspect-[16/7] rounded-[var(--radius-xl)] overflow-hidden bg-[var(--surface-2)] mb-3">
                  <Image
                    src={galleryImages[activeGalleryIdx]}
                    alt={`${profile.displayName} — image ${activeGalleryIdx + 1}`}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1280px) 100vw, 900px"
                  />
                  {profile.isVerified && (
                    <div className="absolute top-4 left-4">
                      <VerifiedBadge verifiedAt={profile.verifiedAt} />
                    </div>
                  )}
                </div>
                {/* Thumbnail strip */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {galleryImages.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveGalleryIdx(i)}
                        className={`relative w-20 h-14 rounded-[var(--radius-md)] overflow-hidden shrink-0 transition-all ${
                          i === activeGalleryIdx
                            ? "ring-2 ring-[var(--loocbooc-black)]"
                            : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image src={src} alt="" fill className="object-cover" sizes="80px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Headline + badges */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl text-[var(--text-primary)] mb-2">
                    {profile.displayName}
                  </h1>
                  <p className="text-[var(--text-secondary)]">{location}</p>
                </div>
                {/* Mobile CTA */}
                <button
                  onClick={() => setShowEnquiryModal(true)}
                  className="lg:hidden px-5 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
                >
                  Connect
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {profile.specialisations.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 bg-[var(--surface-2)] text-[var(--text-secondary)] text-sm rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            {profile.description && (
              <div className="mb-8">
                <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-3">About</h2>
                <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {profile.description}
                </p>
              </div>
            )}

            {/* Specs table */}
            <div className="mb-8">
              <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-4">
                Production capabilities
              </h2>
              <div className="grid grid-cols-2 gap-px bg-[var(--surface-3)] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--surface-3)]">
                {[
                  ["Minimum order", `${profile.moqMin.toLocaleString()} units`],
                  ["Maximum order", profile.moqMax ? `${profile.moqMax.toLocaleString()} units` : "No limit"],
                  ["Sample lead time", `${profile.sampleLeadTimeDays} days`],
                  ["Bulk lead time", `${profile.bulkLeadTimeDays} days`],
                  ["Monthly capacity", capacityLabel],
                  ["Price tier", profile.priceTier.charAt(0).toUpperCase() + profile.priceTier.slice(1)],
                  ["Year established", profile.yearEstablished ? String(profile.yearEstablished) : "—"],
                  ["Team size", profile.employeeCount ?? "—"],
                  ["Languages", profile.languages.length > 0 ? profile.languages.join(", ") : "—"],
                  ["Tech pack formats", profile.techPackFormats.length > 0 ? profile.techPackFormats.map((f) => TECH_PACK_LABELS[f] ?? f).join(", ") : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[var(--surface-1)] px-4 py-3">
                    <p className="text-xs text-[var(--text-tertiary)] mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials */}
            {profile.materials.length > 0 && (
              <div className="mb-8">
                <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-3">Materials</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.materials.map((m) => (
                    <span key={m} className="px-3 py-1.5 bg-[var(--surface-2)] text-[var(--text-secondary)] text-sm rounded-full">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {profile.certifications.length > 0 && (
              <div className="mb-8">
                <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-3">Certifications</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#22C55E]/8 text-[#22C55E] text-sm font-medium rounded-full border border-[#22C55E]/20"
                    >
                      ✓ {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Export markets */}
            {profile.exportMarkets.length > 0 && (
              <div className="mb-8">
                <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-3">Export markets</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.exportMarkets.map((m) => (
                    <span key={m} className="px-3 py-1.5 bg-[var(--surface-2)] text-[var(--text-secondary)] text-sm rounded-full">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ratings */}
            {profile.ratings.totalReviews > 0 && (
              <div className="mb-8">
                <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-5">Ratings</h2>
                <div className="flex gap-8 items-start p-6 bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)]">
                  {/* Big score */}
                  <div className="text-center shrink-0">
                    <p className="font-display text-5xl text-[var(--text-primary)] leading-none mb-2">
                      {profile.ratings.overall.toFixed(1)}
                    </p>
                    <StarRating score={profile.ratings.overall} />
                    <p className="text-[var(--text-tertiary)] text-xs mt-2">
                      {profile.ratings.totalReviews} review{profile.ratings.totalReviews !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {/* Sub-scores */}
                  <div className="flex-1 space-y-3">
                    <RatingBar label="Quality" score={profile.ratings.quality} />
                    <RatingBar label="Communication" score={profile.ratings.communication} />
                    <RatingBar label="Timeliness" score={profile.ratings.timeliness} />
                  </div>
                </div>
              </div>
            )}

            {/* Reviews */}
            {profile.recentReviews.length > 0 && (
              <div className="mb-8">
                <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-5">
                  Reviews from brands
                  <span className="ml-2 text-sm font-normal text-[var(--text-tertiary)]">
                    (verified purchases only)
                  </span>
                </h2>
                <div className="space-y-4">
                  {profile.recentReviews.map((review) => (
                    <div key={review.id} className="p-5 bg-[var(--surface-1)] rounded-[var(--radius-xl)] shadow-[var(--shadow-1)]">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-medium text-[var(--text-primary)] text-sm">{review.brandName}</p>
                          <p className="text-[var(--text-tertiary)] text-xs mt-0.5">
                            {review.ordersCompleted} order{review.ordersCompleted !== 1 ? "s" : ""} completed
                            · {new Date(review.createdAt).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <StarRating score={review.overallScore} />
                      </div>
                      {review.review && (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {review.review}
                        </p>
                      )}
                      <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--surface-3)]">
                        {[
                          { label: "Quality", score: review.qualityScore },
                          { label: "Communication", score: review.communicationScore },
                          { label: "Timeliness", score: review.timelinessScore },
                        ].map(({ label, score }) => (
                          <div key={label} className="text-center">
                            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{score}/5</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — sticky CTA + related */}
          <aside className="w-80 shrink-0 hidden lg:block">
            <div className="sticky top-6 space-y-4">

              {/* Connect CTA card */}
              <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-2)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">Ready to connect?</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-5">
                  Send an enquiry and start the conversation. Connect now, and your tech packs are one click away.
                </p>

                {/* Quick specs */}
                <div className="space-y-2.5 mb-5 pb-5 border-b border-[var(--surface-3)]">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Min order</span>
                    <span className="font-medium text-[var(--text-primary)]">{profile.moqMin.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Sample lead time</span>
                    <span className="font-medium text-[var(--text-primary)]">{profile.sampleLeadTimeDays} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Bulk lead time</span>
                    <span className="font-medium text-[var(--text-primary)]">{profile.bulkLeadTimeDays} days</span>
                  </div>
                  {profile.responseTimeHours !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Avg response</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {profile.responseTimeHours < 24
                          ? `${Math.round(profile.responseTimeHours)}h`
                          : `${Math.round(profile.responseTimeHours / 24)}d`}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowEnquiryModal(true)}
                  className="w-full py-3.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] font-medium hover:opacity-90 transition-opacity"
                >
                  Connect with this manufacturer
                </button>

                {enquiryError && (
                  <p className="mt-3 text-xs text-[var(--color-error)] text-center">{enquiryError}</p>
                )}
              </div>

              {/* Related manufacturers */}
              {profile.relatedManufacturers.length > 0 && (
                <div className="bg-[var(--surface-1)] rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-1)]">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-3 text-sm">
                    Similar manufacturers
                  </h3>
                  <div className="space-y-1">
                    {profile.relatedManufacturers.map((m) => (
                      <RelatedCard key={m.id} manufacturer={m} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>

      {/* Enquiry modal */}
      {showEnquiryModal && (
        <EnquiryModal
          manufacturerName={profile.displayName}
          onClose={() => {
            setShowEnquiryModal(false);
            setEnquirySuccess(false);
            setEnquiryError(null);
          }}
          onSubmit={handleEnquirySubmit}
          submitting={enquirySubmitting}
          success={enquirySuccess}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}
