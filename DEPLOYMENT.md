# Deployment Guide

This guide explains how to deploy Kanji Companion to the Firefox Add-ons and Chrome Web Store.

## Prerequisites

1. Firefox Add-ons Developer Account
   - Sign up at: https://addons.mozilla.org/en-US/developers/
   - Complete the developer profile

2. Chrome Web Store Developer Account
   - Sign up at: https://chrome.google.com/webstore/devconsole/
   - Pay one-time registration fee ($5)

## Building the Extension

1. Ensure all changes are committed and tested
2. Update version in `manifest.json`
3. Build packages for both browsers:
   ```bash
   npm run build:package
   ```
   This will create:
   - `dist/kanji-companion-firefox.zip`
   - `dist/kanji-companion-chrome.zip`

## Firefox Deployment

1. Go to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/)
2. Click "Submit a New Add-on"
3. Choose "Package" and upload `dist/kanji-companion-firefox.zip`
4. Fill in the submission form:
   - Name: Kanji Companion
   - Categories: Language & Support
   - Add-on Type: Extension
   - Description: (Copy from README.md)
   - Icon: Upload `public/icons/icon128.png`
   - Screenshots: Add screenshots of the extension in action
5. Submit for review
   - Review typically takes 1-3 days
   - You'll receive an email when approved

## Chrome Deployment

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Click "New Item"
3. Upload `dist/kanji-companion-chrome.zip`
4. Fill in the submission form:
   - Name: Kanji Companion
   - Category: Education
   - Description: (Copy from README.md)
   - Icon: Upload `public/icons/icon128.png`
   - Screenshots: Add screenshots of the extension in action
   - Privacy: Link to privacy policy
5. Pay the registration fee (if not already done)
6. Submit for review
   - Review typically takes 2-5 days
   - You'll receive an email when approved

## Version Updates

1. Update version in `manifest.json`
2. Build new packages:
   ```bash
   npm run build:package
   ```
3. Upload new versions to both stores
   - Firefox: "New Version" in developer hub
   - Chrome: "Upload Updated Package" in developer console

## Tips

- Keep detailed release notes for each version
- Test thoroughly before submission
- Respond promptly to review feedback
- Monitor user feedback and ratings
- Keep privacy policy and documentation up to date

## Common Issues

### Firefox Review
- Ensure all permissions are justified
- Document any unusual permissions in submission notes
- Follow [Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

### Chrome Review
- Ensure manifest.json matches store listing
- Follow [Program Policies](https://developer.chrome.com/docs/webstore/program_policies/)
- Include clear privacy disclosures 