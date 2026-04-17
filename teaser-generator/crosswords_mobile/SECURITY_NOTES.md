# SECURITY_NOTES.md

## Purpose
This file tracks known security findings for the mobile workspace and explains
what is actionable right now.

## Current Finding (as of February 18, 2026)
- Advisory: `GHSA-2g4f-4pwh-qvx6`
- Package: `ajv` (`<8.18.0`)
- Reported by: `npm audit`
- Path in this repo: `eslint` toolchain (`@eslint/eslintrc -> ajv`)

## Impact In This Project
- Scope: `devDependencies` (lint/tooling only)
- Runtime/mobile app impact: none expected for shipped Expo app binaries
- Risk level for production app users: low
- Risk level for local dev/CI tooling: moderate (per audit output)

## Why It Is Not Auto-Fixable Today
- `npm audit` reports `fixAvailable: false` for this dependency chain.
- Current ESLint ecosystem in this project still resolves to `ajv@6.x`.

## Team Decision
- Accept this as a temporary tooling risk.
- Keep tracking upstream ESLint/Ajv updates.
- Re-check regularly during dependency updates.

## Required Commands
- Full dependency audit (includes tooling/dev deps):
  - `npm audit`
- Production-relevant audit signal (excludes dev deps):
  - `npm audit --omit=dev`

## CI Recommendation
- Gate production risk with:
  - `npm audit --omit=dev`
- Keep a non-blocking informational job for:
  - `npm audit`

## Revisit Trigger
Revisit this note when any of these happen:
- Expo SDK upgrade
- ESLint major/minor upgrade
- `npm audit` reports a fix path for `GHSA-2g4f-4pwh-qvx6`

