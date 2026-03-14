/**
 * Manufacturer Profile Edit Page.
 *
 * Full CRUD for the manufacturer's public-facing profile.
 * On first visit, the form is pre-populated from any existing profile data.
 * On submit, it PATCHes /api/v1/manufacturers/profile.
 *
 * Sections:
 *  1. Basic info — display name, description
 *  2. Location — country, city
 *  3. Images — hero image URL, gallery URLs (up to 12)
 *  4. Production specs — MOQ (min/max), sample lead time, bulk lead time,
 *                        monthly capacity (min/max), price tier
 *  5. Specialisations — checkbox grid (garment categories)
 *  6. Materials — tag input
 *  7. Certifications — checkbox grid (standards)
 *  8. Export markets — tag input
 *  9. Company info — year established, employee count, languages
 * 10. Tech pack formats — checkboxes
 *
 * Validation: required fields + range checks + URL validation.
 * Feedback: inline field errors + success/error toast.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ProfileForm {
  displayName: string;
  description: string;
  heroImageUrl: string;
  galleryImageUrls: string[]; // up to 12
  videoUrl: string;
  country: string;
  city: string;
  yearEstablished: string;
  employeeCount: string;
  monthlyCapacityMin: string;
  monthlyCapacityMax: string;
  moqMin: string;
  moqMax: string;
  sampleLeadTimeDays: string;
  bulkLeadTimeDays: string;
  specialisations: string[];
  materials: string[];
  certifications: string[];
  exportMarkets: string[];
  priceTier: string;
  techPackFormats: string[];
  languages: string[];
}

type FormErrors = Partial<Record<keyof ProfileForm, string>>;

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SPECIALISATION_OPTIONS = [
  "Woven", "Knitwear", "Denim", "Leather", "Jersey", "Swimwear",
  "Activewear", "Lingerie", "Outerwear", "Tailoring", "Embroidery",
  "Prints & Dyeing", "Sportswear", "Casualwear", "Formalwear",
  "Childrenswear", "Accessories", "Footwear",
];

const CERTIFICATION_OPTIONS = [
  "GOTS", "OEKO-TEX Standard 100", "Fair Trade Certified", "BSCI",
  "ISO 9001", "WRAP", "SA8000", "Bluesign", "GRS (Global Recycled Standard)",
  "FSC", "Cradle to Cradle", "B Corp",
];

const TECH_PACK_FORMAT_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
  { value: "clo3d", label: "CLO 3D" },
  { value: "loocbooc_native", label: "Loocbooc Native" },
];

const PRICE_TIER_OPTIONS = [
  { value: "mass", label: "Mass market", desc: "High volume, cost-optimised" },
  { value: "mid", label: "Mid-market", desc: "Balance of quality and price" },
  { value: "premium", label: "Premium", desc: "High-quality, lower volume" },
  { value: "luxury", label: "Luxury", desc: "Bespoke, exceptional quality" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "Select country" },
  { value: "AU", label: "Australia" },
  { value: "BD", label: "Bangladesh" },
  { value: "CN", label: "China" },
  { value: "EG", label: "Egypt" },
  { value: "ET", label: "Ethiopia" },
  { value: "IN", label: "India" },
  { value: "ID", label: "Indonesia" },
  { value: "IT", label: "Italy" },
  { value: "MA", label: "Morocco" },
  { value: "MX", label: "Mexico" },
  { value: "PK", label: "Pakistan" },
  { value: "PE", label: "Peru" },
  { value: "PT", label: "Portugal" },
  { value: "KR", label: "South Korea" },
  { value: "LK", label: "Sri Lanka" },
  { value: "TW", label: "Taiwan" },
  { value: "TR", label: "Turkey" },
  { value: "US", label: "United States" },
  { value: "VN", label: "Vietnam" },
];

const EMPLOYEE_COUNT_OPTIONS = [
  { value: "", label: "Select range" },
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-100", label: "51–100 employees" },
  { value: "101-250", label: "101–250 employees" },
  { value: "251-500", label: "251–500 employees" },
  { value: "500+", label: "500+ employees" },
];

const LANGUAGE_OPTIONS = [
  "English", "Mandarin", "Cantonese", "Hindi", "Bengali", "Vietnamese",
  "Turkish", "Portuguese", "Spanish", "Italian", "Korean", "Japanese",
  "Arabic", "French", "German", "Thai", "Bahasa Indonesia",
];

const EMPTY_FORM: ProfileForm = {
  displayName: "",
  description: "",
  heroImageUrl: "",
  galleryImageUrls: [],
  videoUrl: "",
  country: "",
  city: "",
  yearEstablished: "",
  employeeCount: "",
  monthlyCapacityMin: "",
  monthlyCapacityMax: "",
  moqMin: "",
  moqMax: "",
  sampleLeadTimeDays: "",
  bulkLeadTimeDays: "",
  specialisations: [],
  materials: [],
  certifications: [],
  exportMarkets: [],
  priceTier: "mid",
  techPackFormats: [],
  languages: [],
};

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

function isUrl(val: string): boolean {
  if (!val) return true; // optional fields
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
}

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loocbooc_token") ?? "";
}

// ─────────────────────────────────────────────
// Form components
// ─────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
      {children}
      {required && <span className="text-[var(--color-error)] ml-1">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-error)]">{message}</p>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  error,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
}) {
  return (
    <>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 bg-[var(--surface-2)] border rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)] transition-shadow ${
          error ? "border-[var(--color-error)]" : "border-[var(--surface-3)]"
        }`}
      />
      <FieldError message={error} />
    </>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
}) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2.5 bg-[var(--surface-2)] border rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)] resize-none transition-shadow ${
          error ? "border-[var(--color-error)]" : "border-[var(--surface-3)]"
        }`}
      />
      <FieldError message={error} />
    </>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 bg-[var(--surface-2)] border rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)] appearance-none transition-shadow ${
          error ? "border-[var(--color-error)]" : "border-[var(--surface-3)]"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  error?: string;
}) {
  return (
    <>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        className={`w-full px-3 py-2.5 bg-[var(--surface-2)] border rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)] transition-shadow ${
          error ? "border-[var(--color-error)]" : "border-[var(--surface-3)]"
        }`}
      />
      <FieldError message={error} />
    </>
  );
}

function CheckboxGrid({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (updated: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer border transition-all text-sm ${
              checked
                ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] border-[var(--loocbooc-black)]"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--surface-3)] hover:border-[var(--text-tertiary)]"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
              className="sr-only"
            />
            {checked && <span className="text-xs">✓</span>}
            {opt}
          </label>
        );
      })}
    </div>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
  suggestions,
}: {
  tags: string[];
  onChange: (updated: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const add = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const filteredSuggestions = suggestions?.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s),
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] text-xs rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="hover:opacity-70 transition-opacity"
              aria-label={`Remove ${tag}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            }
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)]"
        />
        {showSuggestions && filteredSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] max-h-48 overflow-y-auto">
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => add(s)}
                className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">
        Press Enter or comma to add. {suggestions && "Start typing for suggestions."}
      </p>
    </div>
  );
}

function GalleryInput({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (updated: string[]) => void;
}) {
  const [inputVal, setInputVal] = useState("");
  const [urlError, setUrlError] = useState("");

  const add = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    if (!isUrl(trimmed)) {
      setUrlError("Must be a valid URL (https://…)");
      return;
    }
    if (urls.includes(trimmed)) {
      setUrlError("Already added");
      return;
    }
    if (urls.length >= 12) {
      setUrlError("Maximum 12 gallery images");
      return;
    }
    onChange([...urls, trimmed]);
    setInputVal("");
    setUrlError("");
  };

  const remove = (url: string) => onChange(urls.filter((u) => u !== url));

  return (
    <div>
      {/* Existing gallery */}
      {urls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {urls.map((url, i) => (
            <div
              key={url}
              className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--surface-2)] group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Gallery ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
              >
                ✕
              </button>
              <span className="absolute bottom-1 left-1 text-white text-xs bg-black/50 rounded px-1">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Add new */}
      {urls.length < 12 && (
        <div className="flex gap-2">
          <input
            type="url"
            value={inputVal}
            onChange={(e) => { setInputVal(e.target.value); setUrlError(""); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="https://cdn.example.com/image.jpg"
            className="flex-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--loocbooc-accent)]"
          />
          <button
            type="button"
            onClick={add}
            className="px-4 py-2 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
      )}
      {urlError && <p className="mt-1 text-xs text-[var(--color-error)]">{urlError}</p>}
      <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
        {urls.length}/12 images. Add production facility photos, machinery, and sample work.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--surface-3)] pb-8 mb-8 last:border-0 last:pb-0 last:mb-0">
      <div className="mb-5">
        <h2 className="font-semibold text-lg text-[var(--text-primary)]">{title}</h2>
        {description && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

function Toast({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] text-sm font-medium ${
        type === "success"
          ? "bg-[#22C55E] text-white"
          : "bg-[var(--color-error)] text-white"
      }`}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

function validate(form: ProfileForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.displayName.trim()) {
    errors.displayName = "Display name is required";
  }
  if (!form.country) {
    errors.country = "Country is required";
  }
  if (form.moqMin && Number(form.moqMin) < 0) {
    errors.moqMin = "Must be 0 or more";
  }
  if (form.moqMax && Number(form.moqMax) <= 0) {
    errors.moqMax = "Must be greater than 0";
  }
  if (form.moqMin && form.moqMax && Number(form.moqMin) > Number(form.moqMax)) {
    errors.moqMax = "Max must be greater than min";
  }
  if (form.sampleLeadTimeDays && Number(form.sampleLeadTimeDays) <= 0) {
    errors.sampleLeadTimeDays = "Must be greater than 0";
  }
  if (form.bulkLeadTimeDays && Number(form.bulkLeadTimeDays) <= 0) {
    errors.bulkLeadTimeDays = "Must be greater than 0";
  }
  if (form.heroImageUrl && !isUrl(form.heroImageUrl)) {
    errors.heroImageUrl = "Must be a valid URL";
  }
  if (form.videoUrl && !isUrl(form.videoUrl)) {
    errors.videoUrl = "Must be a valid URL";
  }
  return errors;
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ManufacturerProfileEditPage() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load existing profile
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    fetch("/api/v1/manufacturers/my-profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { data?: Record<string, unknown> }) => {
        if (data.data) {
          const p = data.data;
          setForm({
            displayName: (p.displayName as string) ?? "",
            description: (p.description as string) ?? "",
            heroImageUrl: (p.heroImageUrl as string) ?? "",
            galleryImageUrls: (p.galleryImageUrls as string[]) ?? [],
            videoUrl: (p.videoUrl as string) ?? "",
            country: (p.country as string) ?? "",
            city: (p.city as string) ?? "",
            yearEstablished: p.yearEstablished ? String(p.yearEstablished) : "",
            employeeCount: (p.employeeCount as string) ?? "",
            monthlyCapacityMin: p.monthlyCapacityMin ? String(p.monthlyCapacityMin) : "",
            monthlyCapacityMax: p.monthlyCapacityMax ? String(p.monthlyCapacityMax) : "",
            moqMin: p.moqMin !== undefined ? String(p.moqMin) : "",
            moqMax: p.moqMax ? String(p.moqMax) : "",
            sampleLeadTimeDays: p.sampleLeadTimeDays ? String(p.sampleLeadTimeDays) : "",
            bulkLeadTimeDays: p.bulkLeadTimeDays ? String(p.bulkLeadTimeDays) : "",
            specialisations: (p.specialisations as string[]) ?? [],
            materials: (p.materials as string[]) ?? [],
            certifications: (p.certifications as string[]) ?? [],
            exportMarkets: (p.exportMarkets as string[]) ?? [],
            priceTier: (p.priceTier as string) ?? "mid",
            techPackFormats: (p.techPackFormats as string[]) ?? [],
            languages: (p.languages as string[]) ?? [],
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = useCallback(
    <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
      if (errors[key]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [errors],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to first error
      const firstErrorEl = document.querySelector("[data-field-error]");
      firstErrorEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    try {
      const token = getToken();
      const payload: Record<string, unknown> = {
        displayName: form.displayName,
        description: form.description || undefined,
        heroImageUrl: form.heroImageUrl || undefined,
        galleryImageUrls: form.galleryImageUrls,
        videoUrl: form.videoUrl || undefined,
        country: form.country,
        city: form.city || undefined,
        yearEstablished: form.yearEstablished ? Number(form.yearEstablished) : undefined,
        employeeCount: form.employeeCount || undefined,
        monthlyCapacityMin: form.monthlyCapacityMin ? Number(form.monthlyCapacityMin) : undefined,
        monthlyCapacityMax: form.monthlyCapacityMax ? Number(form.monthlyCapacityMax) : undefined,
        moqMin: form.moqMin ? Number(form.moqMin) : 0,
        moqMax: form.moqMax ? Number(form.moqMax) : undefined,
        sampleLeadTimeDays: form.sampleLeadTimeDays ? Number(form.sampleLeadTimeDays) : 14,
        bulkLeadTimeDays: form.bulkLeadTimeDays ? Number(form.bulkLeadTimeDays) : 45,
        specialisations: form.specialisations,
        materials: form.materials,
        certifications: form.certifications,
        exportMarkets: form.exportMarkets,
        priceTier: form.priceTier,
        techPackFormats: form.techPackFormats,
        languages: form.languages,
      };

      const res = await fetch("/api/v1/manufacturers/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed to save profile");
      }

      setToast({ type: "success", message: "Profile saved successfully" });
      setIsDirty(false);
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="h-8 bg-[var(--surface-2)] rounded w-48 mb-2 animate-pulse" />
        <div className="h-4 bg-[var(--surface-2)] rounded w-64 mb-10 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-8">
            <div className="h-5 bg-[var(--surface-2)] rounded w-32 mb-4 animate-pulse" />
            <div className="h-10 bg-[var(--surface-2)] rounded mb-3 animate-pulse" />
            <div className="h-10 bg-[var(--surface-2)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/manufacturer/dashboard"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
        <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">Edit profile</h1>
        <p className="text-[var(--text-secondary)]">
          Your profile is your first impression. Make it complete.
        </p>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>

        {/* ── Section 1: Basic info ── */}
        <Section
          title="Basic information"
          description="Brands search and filter by these details first."
        >
          <div className="space-y-4">
            <div>
              <Label required>Display name</Label>
              <TextInput
                value={form.displayName}
                onChange={(v) => set("displayName", v)}
                placeholder="e.g. Shenzhen Premium Apparel Co."
                error={errors.displayName}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(v) => set("description", v)}
                rows={5}
                placeholder="Tell brands who you are, what you specialise in, and what makes working with you exceptional. Be specific — generic descriptions don't convert."
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                {form.description.length}/5000 — aim for at least 200 characters.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Location ── */}
        <Section title="Location">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Country</Label>
              <SelectInput
                value={form.country}
                onChange={(v) => set("country", v)}
                options={COUNTRY_OPTIONS}
                error={errors.country}
              />
            </div>
            <div>
              <Label>City</Label>
              <TextInput
                value={form.city}
                onChange={(v) => set("city", v)}
                placeholder="e.g. Guangzhou"
              />
            </div>
          </div>
        </Section>

        {/* ── Section 3: Images ── */}
        <Section
          title="Images"
          description="A strong hero image and gallery dramatically increase connection rates."
        >
          <div className="space-y-6">
            <div>
              <Label>Hero image URL</Label>
              <TextInput
                value={form.heroImageUrl}
                onChange={(v) => set("heroImageUrl", v)}
                placeholder="https://cdn.example.com/factory-hero.jpg"
                error={errors.heroImageUrl}
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Appears at the top of your profile. Recommended: 1600×900px or wider.
              </p>
            </div>
            <div>
              <Label>Gallery images</Label>
              <GalleryInput
                urls={form.galleryImageUrls}
                onChange={(v) => set("galleryImageUrls", v)}
              />
            </div>
            <div>
              <Label>Video URL</Label>
              <TextInput
                value={form.videoUrl}
                onChange={(v) => set("videoUrl", v)}
                placeholder="https://www.youtube.com/watch?v=..."
                error={errors.videoUrl}
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                YouTube or Vimeo link. A factory walkthrough video builds trust significantly.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Section 4: Production specs ── */}
        <Section
          title="Production capabilities"
          description="These fields drive the matching algorithm. Be accurate — wrong specs mean wrong matches."
        >
          <div className="space-y-5">
            {/* MOQ */}
            <div>
              <Label>Minimum order quantity (MOQ)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Min units per style</p>
                  <NumberInput
                    value={form.moqMin}
                    onChange={(v) => set("moqMin", v)}
                    placeholder="100"
                    min={0}
                    error={errors.moqMin}
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Max units (optional)</p>
                  <NumberInput
                    value={form.moqMax}
                    onChange={(v) => set("moqMax", v)}
                    placeholder="10,000"
                    min={1}
                    error={errors.moqMax}
                  />
                </div>
              </div>
            </div>

            {/* Lead times */}
            <div>
              <Label>Lead times</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Sample lead time (days)</p>
                  <NumberInput
                    value={form.sampleLeadTimeDays}
                    onChange={(v) => set("sampleLeadTimeDays", v)}
                    placeholder="14"
                    min={1}
                    error={errors.sampleLeadTimeDays}
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Bulk production lead time (days)</p>
                  <NumberInput
                    value={form.bulkLeadTimeDays}
                    onChange={(v) => set("bulkLeadTimeDays", v)}
                    placeholder="45"
                    min={1}
                    error={errors.bulkLeadTimeDays}
                  />
                </div>
              </div>
            </div>

            {/* Monthly capacity */}
            <div>
              <Label>Monthly production capacity (units)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Minimum capacity</p>
                  <NumberInput
                    value={form.monthlyCapacityMin}
                    onChange={(v) => set("monthlyCapacityMin", v)}
                    placeholder="5,000"
                    min={1}
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Maximum capacity</p>
                  <NumberInput
                    value={form.monthlyCapacityMax}
                    onChange={(v) => set("monthlyCapacityMax", v)}
                    placeholder="50,000"
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Price tier */}
            <div>
              <Label>Price tier</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PRICE_TIER_OPTIONS.map((tier) => (
                  <label
                    key={tier.value}
                    className={`flex flex-col gap-0.5 p-3 rounded-[var(--radius-md)] cursor-pointer border transition-all ${
                      form.priceTier === tier.value
                        ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] border-[var(--loocbooc-black)]"
                        : "bg-[var(--surface-2)] border-[var(--surface-3)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="priceTier"
                      value={tier.value}
                      checked={form.priceTier === tier.value}
                      onChange={() => set("priceTier", tier.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{tier.label}</span>
                    <span
                      className={`text-xs ${
                        form.priceTier === tier.value ? "text-white/70" : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {tier.desc}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 5: Specialisations ── */}
        <Section
          title="Specialisations"
          description="Select all garment categories you produce. These drive your match score with brands."
        >
          <CheckboxGrid
            options={SPECIALISATION_OPTIONS}
            selected={form.specialisations}
            onChange={(v) => set("specialisations", v)}
          />
          {form.specialisations.length > 0 && (
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              {form.specialisations.length} selected
            </p>
          )}
        </Section>

        {/* ── Section 6: Materials ── */}
        <Section
          title="Materials"
          description="List the fabric types and materials you work with."
        >
          <TagInput
            tags={form.materials}
            onChange={(v) => set("materials", v)}
            placeholder="e.g. Cotton, Polyester, Silk…"
          />
        </Section>

        {/* ── Section 7: Certifications ── */}
        <Section
          title="Certifications"
          description="Certifications are a strong filter signal for sustainability-focused brands."
        >
          <CheckboxGrid
            options={CERTIFICATION_OPTIONS}
            selected={form.certifications}
            onChange={(v) => set("certifications", v)}
          />
        </Section>

        {/* ── Section 8: Export markets ── */}
        <Section title="Export markets">
          <TagInput
            tags={form.exportMarkets}
            onChange={(v) => set("exportMarkets", v)}
            placeholder="e.g. Australia, USA, Europe…"
          />
        </Section>

        {/* ── Section 9: Company info ── */}
        <Section title="Company information">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <Label>Year established</Label>
              <NumberInput
                value={form.yearEstablished}
                onChange={(v) => set("yearEstablished", v)}
                placeholder="1998"
                min={1800}
              />
            </div>
            <div>
              <Label>Team size</Label>
              <SelectInput
                value={form.employeeCount}
                onChange={(v) => set("employeeCount", v)}
                options={EMPLOYEE_COUNT_OPTIONS}
              />
            </div>
          </div>
          <div>
            <Label>Languages spoken</Label>
            <TagInput
              tags={form.languages}
              onChange={(v) => set("languages", v)}
              placeholder="Add a language…"
              suggestions={LANGUAGE_OPTIONS}
            />
          </div>
        </Section>

        {/* ── Section 10: Tech pack formats ── */}
        <Section
          title="Tech pack formats accepted"
          description="Which formats can you receive tech packs in?"
        >
          <div className="flex flex-wrap gap-2">
            {TECH_PACK_FORMAT_OPTIONS.map((fmt) => {
              const checked = form.techPackFormats.includes(fmt.value);
              return (
                <label
                  key={fmt.value}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] cursor-pointer border transition-all text-sm ${
                    checked
                      ? "bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] border-[var(--loocbooc-black)]"
                      : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--surface-3)] hover:border-[var(--text-tertiary)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...form.techPackFormats, fmt.value]
                        : form.techPackFormats.filter((f) => f !== fmt.value);
                      set("techPackFormats", updated);
                    }}
                    className="sr-only"
                  />
                  {checked && <span className="text-xs">✓</span>}
                  {fmt.label}
                </label>
              );
            })}
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-[var(--loocbooc-white)] border-t border-[var(--surface-3)] flex items-center justify-between gap-4 mt-8">
          <div>
            {isDirty && (
              <p className="text-xs text-[var(--text-tertiary)]">
                You have unsaved changes.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/manufacturer/dashboard"
              className="px-5 py-2.5 border border-[var(--surface-3)] text-sm text-[var(--text-secondary)] rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[var(--loocbooc-black)] text-[var(--loocbooc-white)] rounded-[var(--radius-md)] text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
