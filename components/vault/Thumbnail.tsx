"use client";

/**
 * @file components/vault/Thumbnail.tsx
 * @description Reusable thumbnail component for vault files.
 *
 * Renders image files as lazy-loaded <img> tags with signed URLs,
 * PDFs as document icons, and everything else as a generic file icon.
 * Uses IntersectionObserver for lazy loading and shows a grey
 * placeholder while the signed URL is being fetched.
 *
 * @module components/vault/Thumbnail
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { FileText, FileImage, File } from "lucide-react";
import { getThumbnailSignedUrl } from "@/lib/actions/vault";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThumbnailProps {
  /** Storage path from the files table (used to fetch signed URL). */
  storagePath: string;
  /** MIME type of the file. */
  mimeType: string;
  /** Display filename (used as alt text). */
  alt: string;
  /** Pixel size of the thumbnail (square). Default 160. */
  size?: number;
  /** Optional CSS class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a lazy-loaded thumbnail for a vault file.
 *
 * - Image files: rendered as <img> with signed URL from Supabase Storage,
 *   using object-fit: cover, loaded via IntersectionObserver.
 * - PDF files: rendered as a PDF document icon.
 * - Other files: rendered as a generic file icon.
 *
 * @param props — Thumbnail configuration.
 * @returns JSX.Element
 */
export function Thumbnail({
  storagePath,
  mimeType,
  alt,
  size = 160,
  className = "",
}: ThumbnailProps): JSX.Element {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isInView, setIsInView] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  // -------------------------------------------------------------------------
  // IntersectionObserver — only load the image when it enters the viewport
  // -------------------------------------------------------------------------

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px", // Start loading 200px before it enters view
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Fetch signed URL when the thumbnail comes into view
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isInView) return;
    if (!isImage) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchUrl() {
      try {
        const url = await getThumbnailSignedUrl(storagePath);
        if (!cancelled) {
          setSignedUrl(url);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [isInView, storagePath, isImage]);

  // -------------------------------------------------------------------------
  // Handle image load / error
  // -------------------------------------------------------------------------

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size === 160 ? 8 : 6,
    overflow: "hidden",
    backgroundColor: "#F0EFEA",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
  };

  // Loading placeholder
  if (isLoading && isImage && !signedUrl) {
    return (
      <div
        ref={containerRef}
        style={containerStyle}
        className={`thumbnail-placeholder ${className}`}
        aria-label={`Loading thumbnail for ${alt}`}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#E8E6E1",
            animation: "pulse 1.5s ease-in-out infinite",
            borderRadius: "inherit",
          }}
        />
      </div>
    );
  }

  // Image file — render with signed URL
  if (isImage && signedUrl && !hasError) {
    return (
      <div
        ref={containerRef}
        style={containerStyle}
        className={`thumbnail-image ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={alt}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: isLoading ? "none" : "block",
            borderRadius: "inherit",
          }}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#E8E6E1",
              animation: "pulse 1.5s ease-in-out infinite",
              borderRadius: "inherit",
            }}
          />
        )}
      </div>
    );
  }

  // PDF file — render PDF icon
  if (isPdf) {
    return (
      <div
        ref={containerRef}
        style={containerStyle}
        className={`thumbnail-pdf ${className}`}
        aria-label={`PDF file: ${alt}`}
      >
        <FileText
          size={size === 160 ? 48 : 20}
          strokeWidth={1.5}
          style={{ color: "#F37002" }}
        />
      </div>
    );
  }

  // Fallback — generic file icon
  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`thumbnail-generic ${className}`}
      aria-label={`File: ${alt}`}
    >
      <File
        size={size === 160 ? 48 : 20}
        strokeWidth={1.5}
        style={{ color: "#9C9A94" }}
      />
    </div>
  );
}
