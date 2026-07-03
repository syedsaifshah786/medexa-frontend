"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSelectedDoctor } from "@/components/DoctorContext";
import { useLanguage } from "@/context/LanguageContext";
import type { Language } from "@/lib/translations";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

type MedexaHeaderProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
};

const navItems = [
  ["nav.ambientListing", "/ambient-listening"],
  ["nav.liveSession", "/ambient-listening/session"],
  ["nav.soapNotes", "/soap-notes"],
  ["nav.billingIntelligence", "/billing-intelligence"],
  ["nav.patientSummary", "/patient-summary"],
  ["nav.claimDocument", "/claim-document"],
  ["nav.home", "/"],
] as const;

const notifications = [
  "notification.summaryGenerated",
  "notification.billingSuggestion",
  "notification.claimReady",
] as const;

const languages = [
  { labelKey: "language.english", short: "Eng", value: "en" },
  { labelKey: "language.arabic", short: "Ar", value: "ar" },
  { labelKey: "language.hebrew", short: "Heb", value: "he" },
] as const;

export default function MedexaHeader({ searchValue, onSearchChange }: MedexaHeaderProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { doctors, selectedDoctor, setSelectedDoctor } = useSelectedDoctor();
  const selectedLanguage = languages.find((item) => item.value === language) ?? languages[0];
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const closeFloatingMenus = () => {
    setIsNotificationsOpen(false);
    setIsLanguageOpen(false);
    setIsProfileOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen((current) => !current);
    closeFloatingMenus();
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen((current) => !current);
    setIsLanguageOpen(false);
    setIsProfileOpen(false);
    setIsMenuOpen(false);
  };

  const toggleLanguage = () => {
    setIsLanguageOpen((current) => !current);
    setIsNotificationsOpen(false);
    setIsProfileOpen(false);
    setIsMenuOpen(false);
  };

  const toggleProfile = () => {
    setIsProfileOpen((current) => !current);
    setIsNotificationsOpen(false);
    setIsLanguageOpen(false);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuWrapRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <>
      {isMenuOpen && (
        <button
          type="button"
          className="medexa-menu-backdrop"
          aria-label={t("header.close")}
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      <header className="medexa-header">
        <div className="medexa-menu-wrap" ref={menuWrapRef}>
          <button
            className="medexa-menu-button"
            aria-label={t("header.openMenu")}
            aria-expanded={isMenuOpen}
            type="button"
            onClick={toggleMenu}
          >
            <span />
            <span />
            <span />
          </button>

          {isMenuOpen && (
            <nav className="medexa-menu" aria-label={t("header.navigation")}>
              <div className="medexa-menu-title">
                <strong>{t("header.navigate")}</strong>
                <button type="button" onClick={() => setIsMenuOpen(false)}>
                  {t("header.close")}
                </button>
              </div>
              {navItems.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "is-active" : ""}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t(label)}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <Link href="/" className="medexa-brand">
          {t("brand.medexa")}
        </Link>

        <label className="medexa-search">
          <span className="medexa-search-dot" aria-hidden="true" />
          <input
            aria-label={t("header.search")}
            placeholder={t("header.search")}
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="medexa-actions">
          <div className="medexa-action-wrap medexa-bell-wrap">
            <button
              className="medexa-icon-button medexa-bell"
              aria-label={t("header.notifications")}
              aria-expanded={isNotificationsOpen}
              type="button"
              onClick={toggleNotifications}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 9.8c0-3.3-2.3-5.8-6-5.8s-6 2.5-6 5.8c0 4.8-2 5.5-2 6.7h16c0-1.2-2-1.9-2-6.7Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.8 19a2.4 2.4 0 0 0 4.4 0"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {isNotificationsOpen && (
              <div className="medexa-dropdown medexa-notifications" role="menu">
                <strong>{t("header.notifications")}</strong>
                {notifications.map((notification) => (
                  <button key={notification} type="button" role="menuitem">
                    {t(notification)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="medexa-action-wrap">
            <button
              className="medexa-language-button"
              aria-label={`${t("header.chooseLanguage")}: ${t(selectedLanguage.labelKey)}`}
              aria-expanded={isLanguageOpen}
              type="button"
              onClick={toggleLanguage}
            >
              <svg
                aria-hidden="true"
                className="medexa-language-icon"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M4 5h9M9 3v2m1.5 12 4-9m2 9-4-9m1 6h5M6.5 8c.7 2.1 2.2 3.8 4.5 5M11 8c-.8 2.9-3 5.1-6 6.3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{selectedLanguage.short}</span>
            </button>

            {isLanguageOpen && (
              <div className="medexa-dropdown medexa-language-menu" role="menu">
                {languages.map((language) => (
                  <button
                    key={language.value}
                    type="button"
                    role="menuitem"
                    className={language.value === selectedLanguage.value ? "is-selected" : ""}
                    onClick={() => {
                      setLanguage(language.value as Language);
                      setIsLanguageOpen(false);
                    }}
                  >
                    {t(language.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="medexa-action-wrap medexa-profile-wrap">
            <button
              className="medexa-profile"
              type="button"
              aria-label={t("header.chooseProvider")}
              aria-expanded={isProfileOpen}
              onClick={toggleProfile}
            >
              <img src={selectedDoctor.avatar} alt="" />
              <div>
                <strong>{selectedDoctor.name}</strong>
                <span>{selectedDoctor.role}</span>
              </div>
              <span className="medexa-chevron">v</span>
            </button>

            {isProfileOpen && (
              <div className="medexa-dropdown medexa-profile-menu" role="menu">
                {doctors.map((doctor) => (
                  <button
                    key={doctor.name}
                    type="button"
                    role="menuitem"
                    className={doctor.name === selectedDoctor.name ? "is-selected doctor-option" : "doctor-option"}
                    onClick={() => {
                      setSelectedDoctor(doctor);
                      setIsProfileOpen(false);
                    }}
                  >
                    <img src={doctor.avatar} alt="" />
                    <span>
                      <strong>{doctor.name}</strong>
                      <em>{doctor.role}</em>
                    </span>
                  </button>
                ))}
                <div className="medexa-profile-actions">
                  <button type="button" role="menuitem">
                    {t("header.profile")}
                  </button>
                  <button type="button" role="menuitem">
                    {t("header.settings")}
                  </button>
                  <button type="button" role="menuitem">
                    {t("header.logout")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <style>{`
        .medexa-header {
          position: sticky;
          top: 0;
          z-index: 80;
          width: 100%;
          box-sizing: border-box;
          height: 68px;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 0 32px;
          background: rgba(255, 255, 255, 0.86);
          border-bottom: 1px solid rgba(229, 231, 235, 0.86);
          box-shadow: 0 10px 30px rgba(28, 35, 90, 0.06);
          color: var(--medexa-text);
          font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
          backdrop-filter: blur(18px);
        }

        .medexa-header button,
        .medexa-header input {
          font-family: inherit;
        }

        .medexa-menu-wrap,
        .medexa-action-wrap {
          position: relative;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
        }

        .medexa-menu-button,
        .medexa-icon-button {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .medexa-menu-button {
          width: 34px;
          height: 34px;
          flex-direction: column;
          gap: 4px;
          border: 0;
          border-radius: 8px;
          background: rgba(81, 70, 245, 0.09);
          transition: transform 0.16s ease, background 0.16s ease;
        }

        .medexa-menu-button:hover {
          background: rgba(81, 70, 245, 0.14);
          transform: translateY(-1px);
        }

        .medexa-menu-button span {
          width: 12px;
          height: 2px;
          border-radius: 99px;
          background: #4f46e5;
        }

        .medexa-menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 70;
          border: 0;
          background: transparent;
          cursor: default;
        }

        .medexa-brand {
          flex: 0 0 auto;
          margin-right: 12px;
          color: var(--medexa-primary);
          font-size: 20px;
          font-weight: 800;
          text-decoration: none;
          letter-spacing: 0;
        }

        .medexa-search {
          flex: 0 1 540px;
          max-width: 560px;
          min-width: 280px;
          height: 38px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid var(--medexa-border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          color: #9aa6ba;
          font-size: 12px;
          white-space: nowrap;
          box-shadow: 0 8px 20px rgba(28, 35, 90, 0.04);
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .medexa-search:focus-within {
          border-color: rgba(81, 70, 245, 0.42);
          background: #fff;
          box-shadow: 0 0 0 4px rgba(81, 70, 245, 0.08);
        }

        .medexa-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--medexa-text);
          font: inherit;
        }

        .medexa-search input::placeholder {
          color: #9aa6ba;
        }

        .medexa-search-dot {
          position: relative;
          width: 12px;
          height: 12px;
          flex: 0 0 auto;
          border: 2px solid var(--medexa-primary);
          border-radius: 50%;
          color: var(--medexa-primary);
          font-size: 12px;
        }

        .medexa-search-dot::after {
          content: "";
          position: absolute;
          right: -4px;
          bottom: -3px;
          width: 6px;
          height: 2px;
          border-radius: 999px;
          background: var(--medexa-primary);
          transform: rotate(45deg);
        }

        .medexa-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 14px;
          margin-left: auto;
        }

        .medexa-bell {
          position: relative;
          width: 40px;
          height: 40px;
          border: 1px solid var(--medexa-border);
          border-radius: 999px;
          background: #fff;
          color: var(--medexa-primary);
          box-shadow: 0 8px 18px rgba(28, 35, 90, 0.04);
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, transform 0.16s ease;
        }

        .medexa-bell:hover,
        .medexa-bell[aria-expanded="true"] {
          border-color: rgba(81, 70, 245, 0.34);
          background: #f5f7ff;
          box-shadow: 0 12px 26px rgba(28, 35, 90, 0.09);
          transform: translateY(-1px);
        }

        .medexa-bell svg {
          width: 20px;
          height: 20px;
          display: block;
        }

        .medexa-language-button {
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 12px;
          border: 1px solid var(--medexa-border);
          border-radius: 999px;
          background: #ffffff;
          color: var(--medexa-text);
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
        }

        .medexa-language-button:hover,
        .medexa-language-button[aria-expanded="true"] {
          border-color: rgba(81, 70, 245, 0.34);
          background: rgba(81, 70, 245, 0.06);
        }

        .medexa-language-icon {
          width: 15px;
          height: 15px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          color: #4b5565;
        }

        .medexa-language-button span {
          display: inline-flex;
          align-items: center;
          min-width: 22px;
        }

        .medexa-profile {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          min-width: 0;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .medexa-profile img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
        }

        .medexa-profile strong,
        .medexa-profile span {
          display: block;
          line-height: 1.1;
          text-align: left;
        }

        .medexa-profile strong {
          max-width: 150px;
          overflow: hidden;
          color: var(--medexa-text);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .medexa-profile span {
          color: #7a879b;
          font-size: 10px;
        }

        .medexa-profile .medexa-chevron {
          color: var(--medexa-text);
          font-size: 11px;
        }

        .medexa-menu,
        .medexa-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          z-index: 90;
          box-sizing: border-box;
          border: 1px solid rgba(229, 231, 235, 0.95);
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 20px 52px rgba(28, 35, 90, 0.14);
        }

        .medexa-menu {
          position: fixed;
          top: 78px;
          left: 16px;
          right: auto;
          width: min(260px, calc(100vw - 32px));
          max-width: calc(100vw - 32px);
          max-height: calc(100dvh - 96px);
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 10px;
          transform-origin: top left;
        }

        :global(html[dir="rtl"]) .medexa-brand {
          margin-right: 0;
          margin-left: 12px;
        }

        :global(html[dir="rtl"]) .medexa-actions {
          margin-left: 0;
          margin-right: auto;
        }

        :global(html[dir="rtl"]) .medexa-search {
          flex-direction: row-reverse;
        }

        :global(html[dir="rtl"]) .medexa-search-dot::after {
          right: auto;
          left: -4px;
          transform: rotate(-45deg);
        }

        :global(html[dir="rtl"]) .medexa-menu {
          left: auto;
          right: 16px;
          transform-origin: top right;
        }

        :global(html[dir="rtl"]) .medexa-dropdown {
          right: auto;
          left: 0;
        }

        :global(html[dir="rtl"]) .medexa-menu a,
        :global(html[dir="rtl"]) .medexa-dropdown button,
        :global(html[dir="rtl"]) .medexa-profile strong,
        :global(html[dir="rtl"]) .medexa-profile span {
          text-align: right;
        }

        .medexa-menu-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 4px 8px;
        }

        .medexa-menu-title strong {
          color: #172033;
          font-size: 12px;
        }

        .medexa-menu-title button {
          border: 0;
          background: transparent;
          color: var(--medexa-primary);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .medexa-menu a,
        .medexa-dropdown button {
          width: 100%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--medexa-text);
          padding: 9px 10px;
          text-align: left;
          text-decoration: none;
          font-size: 12px;
          cursor: pointer;
        }

        .medexa-menu a:hover,
        .medexa-dropdown button:hover,
        .medexa-menu a.is-active,
        .medexa-dropdown button.is-selected {
          background: rgba(81, 70, 245, 0.09);
          color: var(--medexa-primary);
        }

        .medexa-dropdown {
          right: 0;
          width: min(250px, calc(100vw - 24px));
          max-width: calc(100vw - 24px);
          max-height: calc(100dvh - 88px);
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 10px;
        }

        .medexa-notifications strong {
          display: block;
          padding: 4px 10px 8px;
          color: #172033;
          font-size: 12px;
        }

        .medexa-language-menu {
          width: 150px;
        }

        .medexa-profile-menu {
          width: 280px;
        }

        .medexa-profile-menu .doctor-option {
          gap: 9px;
        }

        .medexa-profile-menu img {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          object-fit: cover;
        }

        .medexa-profile-menu span,
        .medexa-profile-menu strong,
        .medexa-profile-menu em {
          display: block;
        }

        .medexa-profile-menu strong {
          font-size: 12px;
        }

        .medexa-profile-menu em {
          margin-top: 2px;
          color: #7a879b;
          font-size: 10px;
          font-style: normal;
        }

        .medexa-profile-actions {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid #eef1f6;
        }

        @media (max-width: 1020px) {
          .medexa-header {
            gap: 14px;
            padding: 0 24px;
          }

          .medexa-search {
            flex-basis: 420px;
            min-width: 180px;
          }

          .medexa-actions {
            gap: 10px;
          }

          .medexa-profile strong {
            max-width: 110px;
          }
        }

        @media (max-width: 760px) {
          .medexa-header {
            gap: 10px;
            padding: 0 16px;
          }

          .medexa-search,
          .medexa-profile div,
          .medexa-profile .medexa-chevron {
            display: none;
          }

          .medexa-actions {
            gap: 10px;
          }

          .medexa-dropdown {
            position: fixed;
            top: 76px;
            right: 12px;
            left: auto;
          }

          :global(html[dir="rtl"]) .medexa-dropdown {
            right: auto;
            left: 12px;
          }

          .medexa-menu {
            left: 12px;
            right: auto;
            top: 76px;
            width: min(320px, calc(100vw - 24px));
            max-width: calc(100vw - 24px);
            max-height: calc(100dvh - 88px);
            padding: 12px;
            border-radius: 16px;
          }

          :global(html[dir="rtl"]) .medexa-menu {
            left: auto;
            right: 12px;
          }
        }
      `}</style>
    </>
  );
}
