"use client";

/**
 * HomepageClient — client-side enhancements for the public homepage.
 *
 * Handles:
 * 1. NavBar scroll state (opacity/shadow on scroll)
 * 2. Section reveal animations (IntersectionObserver — CSS-driven)
 * 3. Smooth scroll for anchor links (#brands, #manufacturers, #how-it-works)
 * 4. Stats counter animation (hero numbers counting up)
 *
 * Kept minimal intentionally — the homepage is mostly server-rendered for SEO
 * and performance. Client JS only handles things that genuinely need it.
 */

import { useEffect } from "react";

export function HomepageClient() {
  useEffect(() => {
    // ── Smooth scroll for anchor links ──────────────────────────────
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement;
      const href = target.closest("a")?.getAttribute("href");
      if (!href?.startsWith("#")) return;

      const id = href.slice(1);
      const el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    document.addEventListener("click", handleAnchorClick);

    // ── NavBar scroll shadow ─────────────────────────────────────────
    const header = document.querySelector("header") as HTMLElement | null;

    const handleScroll = () => {
      if (!header) return;
      if (window.scrollY > 20) {
        header.style.boxShadow = "0 1px 24px rgba(0,0,0,0.08)";
      } else {
        header.style.boxShadow = "none";
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // ── Scroll-reveal animations ──────────────────────────────────────
    // Inject CSS for reveal animation
    const style = document.createElement("style");
    style.textContent = `
      .looc-reveal {
        opacity: 0;
        transform: translateY(24px);
        transition: opacity 600ms cubic-bezier(0, 0, 0.2, 1), transform 600ms cubic-bezier(0, 0, 0.2, 1);
      }
      .looc-reveal.looc-revealed {
        opacity: 1;
        transform: translateY(0);
      }
      .looc-reveal-delay-1 { transition-delay: 100ms; }
      .looc-reveal-delay-2 { transition-delay: 200ms; }
      .looc-reveal-delay-3 { transition-delay: 300ms; }
      .looc-reveal-delay-4 { transition-delay: 400ms; }
    `;
    document.head.appendChild(style);

    // Add reveal classes to section headings and cards
    const revealTargets = document.querySelectorAll("section h2, section h3");
    revealTargets.forEach((el, i) => {
      (el as HTMLElement).classList.add("looc-reveal");
      if (i % 3 === 1) (el as HTMLElement).classList.add("looc-reveal-delay-1");
      if (i % 3 === 2) (el as HTMLElement).classList.add("looc-reveal-delay-2");
    });

    // IntersectionObserver to trigger reveals
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("looc-revealed");
            observer.unobserve(entry.target); // Only animate once
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    document.querySelectorAll(".looc-reveal").forEach((el) => observer.observe(el));

    // ── Nav link hover styles (inline event handlers can't do pseudo-states) ──
    // Already handled via onMouseOver/onMouseOut in the server component

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      style.remove();
    };
  }, []);

  return null;
}
