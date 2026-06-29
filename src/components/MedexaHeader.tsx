"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { doctors, selectedDoctor, setSelectedDoctor } = useSelectedDoctor();
  const selectedLanguage = languages.find((item) => item.value === language) ?? languages[0];

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

  return (
    <>
      <header className="medexa-header">
        <div className="medexa-menu-wrap">
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
                <Link key={href} href={href} onClick={() => setIsMenuOpen(false)}>
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

        <div className="medexa-action-wrap medexa-bell-wrap">
          <button
            className="medexa-icon-button medexa-bell"
            aria-label={t("header.notifications")}
            aria-expanded={isNotificationsOpen}
            type="button"
            onClick={toggleNotifications}
          />

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
      </header>

      <style>{`
        .medexa-header {
          position: relative;
          z-index: 20;
          width: 100%;
          box-sizing: border-box;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 32px;
          background: #ffffff;
          border-bottom: 1px solid #eef1f6;
          box-shadow: 0 1px 8px rgba(15, 23, 42, 0.03);
          color: #151820;
          font-family: Arial, Helvetica, sans-serif;
        }

        .medexa-header button,
        .medexa-header input {
          font-family: inherit;
        }

        .medexa-menu-wrap,
        .medexa-action-wrap {
          position: relative;
          flex: 0 0 auto;
        }

        .medexa-menu-button,
        .medexa-icon-button {
          border: 0;
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
          border-radius: 8px;
          background: #eef2ff;
        }

        .medexa-menu-button span {
          width: 12px;
          height: 2px;
          border-radius: 99px;
          background: #626b80;
        }

        .medexa-brand {
          margin-right: 12px;
          color: #001eff;
          font-size: 20px;
          font-weight: 800;
          text-decoration: none;
        }

        .medexa-search {
          flex: 1 1 auto;
          max-width: 520px;
          height: 34px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid #e4e9f2;
          border-radius: 999px;
          color: #9aa6ba;
          font-size: 12px;
          white-space: nowrap;
        }

        .medexa-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #172033;
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
          border: 2px solid #001eff;
          border-radius: 50%;
          color: #001eff;
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
          background: #001eff;
          transform: rotate(45deg);
        }

        .medexa-bell-wrap {
          margin-left: auto;
        }

        .medexa-bell {
          position: relative;
          width: 30px;
          height: 30px;
          background: transparent;
        }

        .medexa-bell::before {
          content: "";
          width: 11px;
          height: 14px;
          border: 2px solid #001eff;
          border-bottom: 0;
          border-radius: 8px 8px 2px 2px;
        }

        .medexa-bell::after {
          content: "";
          position: absolute;
          bottom: 7px;
          width: 16px;
          height: 2px;
          border-radius: 999px;
          background: #001eff;
        }

        .medexa-language-button {
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 10px;
          border: 1px solid #d7deea;
          border-radius: 7px;
          background: #ffffff;
          color: #172033;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
        }

        .medexa-language-button:hover,
        .medexa-language-button[aria-expanded="true"] {
          border-color: #c5d0e0;
          background: #f8fafc;
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
          color: #172033;
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
          color: #172033;
          font-size: 11px;
        }

        .medexa-menu,
        .medexa-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          z-index: 30;
          box-sizing: border-box;
          border: 1px solid #e4e9f2;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.14);
        }

        .medexa-menu {
          left: 0;
          width: 230px;
          padding: 10px;
        }

        :global(html[dir="rtl"]) .medexa-brand {
          margin-right: 0;
          margin-left: 12px;
        }

        :global(html[dir="rtl"]) .medexa-bell-wrap {
          margin-left: 0;
          margin-right: auto;
        }

        :global(html[dir="rtl"]) .medexa-menu {
          left: auto;
          right: 0;
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
          color: #001eff;
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
          border-radius: 8px;
          background: transparent;
          color: #172033;
          padding: 9px 10px;
          text-align: left;
          text-decoration: none;
          font-size: 12px;
          cursor: pointer;
        }

        .medexa-menu a:hover,
        .medexa-dropdown button:hover,
        .medexa-dropdown button.is-selected {
          background: #eef2ff;
          color: #001eff;
        }

        .medexa-dropdown {
          right: 0;
          width: 250px;
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

          .medexa-dropdown {
            right: -8px;
          }

          .medexa-menu {
            left: 0;
          }
        }
      `}</style>
    </>
  );
}
