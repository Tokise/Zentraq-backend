"use client";

import { useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type AttachmentCarouselItem = {
  id: string;
  file_name: string | null;
  file_url: string;
  mime_type: string | null;
  document_type: string;
};

type AttachmentCarouselProps = {
  attachments: AttachmentCarouselItem[];
  className?: string;
  compact?: boolean;
};

function isImageAttachment(attachment: AttachmentCarouselItem) {
  return (
    attachment.mime_type?.startsWith("image/") ||
    /\.(jpe?g|png|webp)$/i.test(attachment.file_name || "")
  );
}

export function AttachmentCarousel({
  attachments,
  className,
  compact = false,
}: AttachmentCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const attachment = attachments[activeIndex];

  if (!attachment) return null;

  function moveBy(offset: number) {
    setIsRevealed(false);
    setZoomPercentage(100);
    setActiveIndex(
      (current) => (current + offset + attachments.length) % attachments.length,
    );
  }

  function handleTouchEnd(touchEndX: number) {
    if (touchStartX === null) return;
    const distance = touchEndX - touchStartX;
    if (Math.abs(distance) > 40) moveBy(distance > 0 ? -1 : 1);
    setTouchStartX(null);
  }

  function toggleReveal() {
    setIsRevealed((current) => !current);
    setZoomPercentage(100);
  }

  const isImage = isImageAttachment(attachment);
  const isPdf = attachment.mime_type === "application/pdf" || attachment.file_name?.toLowerCase().endsWith(".pdf");

  return (
    <div className={className}>
      <div
        className={`relative flex items-center justify-center overflow-hidden border bg-muted/30 ${compact ? "min-h-36" : "min-h-80 sm:min-h-[32rem]"}`}
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX)}
        onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
      >
        {isImage && attachment.file_url ? (
          <TransformWrapper
            centerOnInit
            disabled={!isRevealed}
            doubleClick={{ disabled: true }}
            key={attachment.id}
            limitToBounds
            maxScale={5}
            minScale={1}
            onTransformed={(_, state) => {
              const nextPercentage = Math.round(state.scale * 100);
              setZoomPercentage((current) =>
                current === nextPercentage ? current : nextPercentage,
              );
            }}
            panning={{ velocityDisabled: false }}
            smooth
            wheel={{ smoothStep: 0.002, step: 0.2 }}
          >
            {({ centerView, resetTransform, zoomIn, zoomOut }) => (
              <>
                <TransformComponent
                  contentStyle={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  wrapperStyle={{
                    height: compact ? "9rem" : "62vh",
                    width: "100%",
                  }}
                >
                  {/* Signed remote URLs cannot use Next Image without a configured hostname. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={attachment.file_name || "Medical record attachment"}
                    className={`max-h-[62vh] max-w-full object-contain transition duration-200 ${
                      isRevealed
                        ? "opacity-100"
                        : "scale-105 blur-xl opacity-30"
                    }`}
                    loading="lazy"
                    onLoad={() => centerView(1)}
                    src={attachment.file_url}
                  />
                </TransformComponent>
                {isRevealed && (
                  <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm">
                    <Button
                      aria-label="Zoom out"
                      className="cursor-pointer"
                      onClick={() => zoomOut(0.25)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      <span className="text-base">−</span>
                    </Button>
                    <Button
                      aria-label="Reset to 100% zoom"
                      className="cursor-pointer text-xs"
                      onClick={() => resetTransform()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {zoomPercentage}%
                    </Button>
                    <Button
                      aria-label="Zoom in"
                      className="cursor-pointer"
                      onClick={() => zoomIn(0.25)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      <span className="text-base">+</span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </TransformWrapper>
        ) : isPdf && attachment.file_url ? (
          <iframe
            src={attachment.file_url}
            className="h-full w-full border-0"
            title={attachment.file_name || "PDF Document"}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
            <FileText className="size-9" />
            <span className="text-xs uppercase">
              {attachment.document_type.replace(/_/g, " ")}
            </span>
          </div>
        )}
        {isImage && !isRevealed && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
            <Button
              aria-label="Reveal sensitive attachment preview"
              className="cursor-pointer"
              onClick={toggleReveal}
              type="button"
              variant="secondary"
            >
              <Eye className="mr-1.5 size-4" />
              Reveal preview
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-medium">
            {attachment.file_name || "Unnamed attachment"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isImage && (
            <Button
              aria-label={
                isRevealed
                  ? "Mask attachment preview"
                  : "Reveal attachment preview"
              }
              className="cursor-pointer"
              onClick={toggleReveal}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              {isRevealed ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          )}
          {attachment.file_url && (
            <a
              aria-label={`Open ${attachment.file_name || "record attachment"}`}
              className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              href={attachment.file_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
          {attachments.length > 1 && (
            <>
              <Button
                aria-label="Previous attachment"
                className="cursor-pointer"
                onClick={() => moveBy(-1)}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span
                aria-live="polite"
                className="min-w-10 text-center text-xs text-muted-foreground"
              >
                {activeIndex + 1} / {attachments.length}
              </span>
              <Button
                aria-label="Next attachment"
                className="cursor-pointer"
                onClick={() => moveBy(1)}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
