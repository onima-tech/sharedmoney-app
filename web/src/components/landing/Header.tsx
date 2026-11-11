import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { platformDestinations } from "../../landingContent";
import { primaryNavigation } from "../../seoPages";
import { useTheme } from "../../contexts/ThemeContext";
import { BrandLockup } from "./BrandMark";
import { PlatformCta } from "./PlatformCta";

const androidDestination = platformDestinations.find((destination) => destination.platform === "android");
const iosDestination = platformDestinations.find((destination) => destination.platform === "ios");

export function Header() {
  const { toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    document.body.classList.add("menu-open");
    requestAnimationFrame(() => firstLinkRef.current?.focus());

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    };

    const desktopQuery = window.matchMedia("(min-width: 1121px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMenu();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    desktopQuery.addEventListener("change", closeAtDesktop);

    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", closeOnEscape);
      desktopQuery.removeEventListener("change", closeAtDesktop);
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="container nav-shell">
        <a className="brand" href="/" aria-label="SharedMoney home">
          <BrandLockup />
        </a>

        <nav
          id="primary-nav"
          className={`section-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          {primaryNavigation.map((item, index) => (
            <a
              ref={index === 0 ? firstLinkRef : undefined}
              href={item.path}
              key={item.id}
              onClick={() => closeMenu()}
            >
              {item.id === "tools" ? "Calculators" : item.eyebrow}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          {androidDestination ? (
            <PlatformCta
              destination={androidDestination}
              placement="header"
              appearance="secondary"
              compactLabel="Get app"
              className="header-store-android"
            />
          ) : null}
          {iosDestination ? (
            <PlatformCta
              destination={iosDestination}
              placement="header"
              appearance="secondary"
              compactLabel="Get app"
              className="header-store-ios"
            />
          ) : null}
          <button
            className="icon-button theme-button"
            type="button"
            onClick={toggleTheme}
            aria-label="Switch color theme"
            title="Switch color theme"
          >
            <Sun className="theme-icon theme-icon-sun" size={19} aria-hidden />
            <Moon className="theme-icon theme-icon-moon" size={19} aria-hidden />
          </button>
          <button
            ref={menuButtonRef}
            className="icon-button menu-toggle"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            title={menuOpen ? "Close navigation" : "Open navigation"}
          >
            {menuOpen ? <X size={21} aria-hidden /> : <Menu size={21} aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  );
}
