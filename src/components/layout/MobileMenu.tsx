"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { siteContent } from "@/content/site/siteContent";
import { SoundToggle } from "@/sound/SoundToggle";

import styles from "./MobileMenu.module.css";

/** Matches the header's phone breakpoint in SiteHeader.module.css. */
const PHONE_QUERY = "(max-width: 47.99rem)";

/**
 * Phone navigation: a single toggle in the header bar that opens a full-screen
 * sheet with the sections and the sound and availability status that the
 * desktop header shows inline.
 *
 * While open, everything else on the page is inert and the document stops
 * scrolling, so focus and touch both stay inside the sheet.
 *
 * The sheet is position: fixed, so no ancestor may carry a transform or filter
 * (the header's reveal animation included); it would become the sheet's
 * containing block. That is why the reveal goes on the toggle, not a wrapper.
 */
type MobileMenuProps = Readonly<{
  /** The header's entrance reveal, applied to the toggle itself. */
  toggleClassName?: string;
  toggleStyle?: CSSProperties;
}>;

export function MobileMenu({ toggleClassName, toggleStyle }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const header = buttonRef.current?.closest("header");
    const siblings = header?.parentElement
      ? Array.from(header.parentElement.children).filter(
          (element): element is HTMLElement => element !== header && element instanceof HTMLElement,
        )
      : [];

    siblings.forEach((element) => (element.inert = true));
    document.documentElement.dataset.menuOpen = "";
    firstLinkRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Rotating a tablet or widening a window past the breakpoint hides the
    // toggle, so the sheet must not stay open behind the desktop header.
    const phone = window.matchMedia(PHONE_QUERY);
    const onBreakpoint = () => {
      if (!phone.matches) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    phone.addEventListener("change", onBreakpoint);

    return () => {
      siblings.forEach((element) => (element.inert = false));
      delete document.documentElement.dataset.menuOpen;
      window.removeEventListener("keydown", onKeyDown);
      phone.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={toggleClassName ? `${styles.toggle} ${toggleClassName}` : styles.toggle}
        style={toggleStyle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.icon} aria-hidden="true">
          <span />
          <span />
        </span>
      </button>

      <div id={panelId} className={styles.panel} data-open={open ? "" : undefined} inert={!open}>
        <nav className={styles.nav} aria-label="Primary">
          <ol className={styles.list}>
            {siteContent.navigation.map((item, index) => (
              <li
                key={item.key}
                className={styles.item}
                style={{ "--item-index": index } as CSSProperties}
              >
                <Link
                  ref={index === 0 ? firstLinkRef : undefined}
                  className={styles.link}
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div
          className={styles.footer}
          style={{ "--item-index": siteContent.navigation.length } as CSSProperties}
        >
          <div className={styles.status}>
            <SoundToggle />
            <span className={styles.availability}>{siteContent.availability.label}</span>
          </div>
        </div>
      </div>
    </>
  );
}
