"use client";

import Link from "next/link";
import { useState } from "react";
import { useSelectedDoctor } from "@/components/DoctorContext";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

type MedexaHeaderProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
};

const navItems = [
  ["Ambient Listing", "/ambient-listening"],
  ["Live Session", "/ambient-listening/session"],
  ["SOAP Notes", "/soap-notes"],
  ["Billing Intelligence", "/billing-intelligence"],
  ["Patient Summary", "/patient-summary"],
  ["Claim Document", "/claim-document"],
  ["Home", "/"],
] as const;

const notifications = [
  "New session summary generated",
  "Billing suggestion available",
  "Claim document ready for review",
];

const languages = [
  { label: "English", short: "Eng", value: "en" },
  { label: "Arabic", short: "Ar", value: "ar" },
  { label: "Hebrew", short: "Heb", value: "he" },
] as const;

export default function MedexaHeader({ searchValue, onSearchChange }: MedexaHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<(typeof languages)[number]>(
    languages[0],
  );
  const { doctors, selectedDoctor, setSelectedDoctor } = useSelectedDoctor();

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
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            type="button"
            onClick={toggleMenu}
          >
            <span />
            <span />
            <span />
          </button>

          {isMenuOpen && (
            <nav className="medexa-menu" aria-label="Main navigation">
              <div className="medexa-menu-title">
                <strong>Navigate</strong>
                <button type="button" onClick={() => setIsMenuOpen(false)}>
                  Close
                </button>
              </div>
              {navItems.map(([label, href]) => (
                <Link key={href} href={href} onClick={() => setIsMenuOpen(false)}>
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <Link href="/" className="medexa-brand">
          Medexa
        </Link>

        <label className="medexa-search">
          <span className="medexa-search-dot" aria-hidden="true" />
          <input
            aria-label="Search patients or sessions"
            placeholder="Search patients or sessions..."
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="medexa-action-wrap medexa-bell-wrap">
          <button
            className="medexa-icon-button medexa-bell"
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
            type="button"
            onClick={toggleNotifications}
          />

          {isNotificationsOpen && (
            <div className="medexa-dropdown medexa-notifications" role="menu">
              <strong>Notifications</strong>
              {notifications.map((notification) => (
                <button key={notification} type="button" role="menuitem">
                  {notification}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="medexa-action-wrap">
          <button
            className="medexa-language-button"
            aria-label="Choose language"
            aria-expanded={isLanguageOpen}
            type="button"
            onClick={toggleLanguage}
          >
            <span aria-hidden="true">A</span>
            <b>{selectedLanguage.short}</b>
          </button>

          {isLanguageOpen && (
            <div className="medexa-dropdown medexa-language-menu" role="menu">
              {languages.map((language) => (
                <button
                  key={language.value}
                  type="button"
                  role="menuitem"
                  className={language.label === selectedLanguage.label ? "is-selected" : ""}
                  onClick={() => {
                    setSelectedLanguage(language);
                    setIsLanguageOpen(false);
                  }}
                >
                  {language.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="medexa-action-wrap medexa-profile-wrap">
          <button
            className="medexa-profile"
            type="button"
            aria-label="Choose provider"
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
                  Profile
                </button>
                <button type="button" role="menuitem">
                  Settings
                </button>
                <button type="button" role="menuitem">
                  Logout
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
          height: 30px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid #d9e0eb;
          border-radius: 6px;
          background: #fff;
          color: #111827;
          font-size: 12px;
          cursor: pointer;
        }

        .medexa-language-button span {
          position: relative;
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          color: #4c5668;
          font-size: 13px;
          font-weight: 800;
          line-height: 1;
        }

        .medexa-language-button span::after {
          content: "T";
          position: absolute;
          right: -3px;
          bottom: -2px;
          color: #001eff;
          font-size: 8px;
          font-weight: 800;
        }

        .medexa-language-button b {
          font-size: 12px;
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
