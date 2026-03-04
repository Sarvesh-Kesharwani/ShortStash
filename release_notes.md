# Release Notes

## v1.0.0 — Initial Release

- Chrome extension "ShortStash" to save and categorize YouTube Shorts and Instagram Reels
- Popup with single toggle button to enable/disable the extension
- When enabled, a purple plus (+) button appears at the bottom-right corner on Shorts/Reels pages
- Clicking the plus button opens a category picker overlay to classify the video
- 8 preset categories (Funny, Music, Tech, Cooking, Gaming, Fitness, DIY, Education) with option to add custom ones
- Each saved entry stores: source (youtube/instagram), link, name, channel name, category, and timestamp
- Duplicate detection prevents saving the same link twice
- Saves data to chrome.storage.local in JSON format
- Dark theme UI with purple (#6C5CE7) and green (#00B894) accent colors
- Custom logo: bookmark with play button and green plus badge
- SPA-aware: detects navigation changes on both YouTube and Instagram without page reload

## v1.0.1 — Bug Fix

- Fixed new category input not responding to Enter key on YouTube/Instagram (sites were capturing keyboard events)
- Added blur handler so clicking outside the input also saves the new category and the video
- Keyboard events now stop propagation to prevent platform interference

## v1.1.0 — Library View

- Added "My Library" button in the extension popup
- Opens a full-page library view in a new tab showing all saved videos
- Category-wise filtering via tab buttons with counts
- Search across video names, channels, and categories
- Stats row showing total saved, YouTube count, Instagram count, and category count
- Delete individual entries from the library
- Export all data as a downloadable JSON file
- Consistent dark theme matching the extension design

## v1.1.1 — Bug Fixes

- Fixed video title and channel name not being extracted on YouTube Shorts (updated DOM selectors, now scopes to the active/visible reel renderer)
- Improved Instagram Reels selectors for username and caption extraction
- Added separate "Link" column in the library table so the video URL is always visible and clickable

## v1.2.0 — Category Manager

- Added "Categories" button in the library top bar
- Opens a modal to manage all categories: view, rename, delete, and add new ones
- Each category shows its video count
- Renaming a category updates all saved videos with that category
- Deleting a category with videos marks them as "Uncategorized"
- Consistent dark theme styling with the rest of the extension

## v1.2.1 — Reassign Uncategorized Videos

- Uncategorized videos now show a red badge that is clickable
- Clicking it opens a dropdown to reassign the video to any existing category
- Uncategorized tab appears in the filter bar when such videos exist
