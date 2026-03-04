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
