import { Apple, Monitor, Smartphone } from "lucide-react";
import { trackCtaClick } from "../../analytics";
import type { Platform, PlatformDestination } from "../../landingContent";

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === "ios") {
    return <Apple size={18} aria-hidden />;
  }

  if (platform === "web") {
    return <Monitor size={18} aria-hidden />;
  }

  return <Smartphone size={18} aria-hidden />;
}

/** Text CTA for store or web destinations. Official store badges use StoreBadges instead. */
export function PlatformCta({
  destination,
  placement,
  appearance = "secondary",
  compactLabel,
  showStatus = false,
  className,
  source,
}: {
  destination: PlatformDestination;
  placement: string;
  appearance?: "primary" | "secondary" | "text" | "inverse";
  compactLabel?: string;
  showStatus?: boolean;
  className?: string;
  source?: string;
}) {
  return (
    <a
      href={destination.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`cta cta-${appearance}${className ? ` ${className}` : ""}`}
      aria-label={compactLabel ?? destination.ariaLabel}
      data-seo-cta=""
      data-platform={destination.platform}
      data-placement={placement}
      data-source={source}
      onClick={(event) => trackCtaClick(destination, placement, event.currentTarget)}
    >
      <PlatformIcon platform={destination.platform} />
      <span className="cta-copy">
        <span className="cta-label">{compactLabel ?? destination.label}</span>
        {showStatus ? <span className="cta-status">{destination.status}</span> : null}
      </span>
    </a>
  );
}
