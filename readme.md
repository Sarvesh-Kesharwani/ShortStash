# ShortStash 📚

A browser extension to save, organize, and manage YouTube Shorts and Instagram Reels efficiently.

## Features

- 🎬 **Save Videos**: One-click saving of YouTube Shorts and Instagram Reels
- 🏷️ **Smart Categorization**: Organize videos into custom categories
- 🔍 **Search & Filter**: Quickly find saved videos by keywords and categories
- 📊 **Statistics Dashboard**: Track your saved content across platforms
- 💾 **Export Data**: Export your entire library as JSON for backup
- 🔗 **Quick Links**: Direct access to video sources

## Screenshots

### 1. **Main Library Dashboard**
The central hub where you can view all your saved content:
- View total saved videos across all sources (YouTube, Instagram, etc.)
- See platform breakdown statistics
- Quick access to all saved videos in a clean table layout
- Search bar for finding specific videos
- Category filtering options
- Refresh and Export JSON buttons

**Features visible:**
- Total Saved: 18 videos
- Source breakdown (YouTube, Instagram, etc.)
- Category browsing
- Video thumbnails with metadata
- Save dates and quick actions

---

### 2. **Quick Save Popup**
The convenient popup interface for saving videos on the go:
- Appears in your extension toolbar
- One-click save from the current video
- Quick category selection
- Confirmation of saved videos
- Direct access to your library

**Features visible:**
- Save button for current video
- Category quick-select dropdown
- Recently saved videos preview
- Link to open full library

---

### 3. **Category Management & Filtering**
Organize your content with custom categories:
- View all available categories
- Click to filter videos by category
- See video count per category
- Create new categories
- Manage and rename existing categories

**Features visible:**
- Category tags with video counts
- Visual category indicators
- Multi-select for advanced filtering
- Category statistics

---

## How It Works

1. **Install Extension**: Add ShortStash to your browser
2. **Save Videos**: Click the extension icon on YouTube or Instagram to save Shorts/Reels
3. **Organize**: Add videos to categories when saving
4. **Browse**: Open the library to view and manage your collection
5. **Export**: Backup your data as JSON anytime

## Supported Platforms

- ✅ YouTube Shorts
- ✅ Instagram Reels

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in your browser
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension folder

## File Structure

```
ShortStash/
├── manifest.json           # Extension configuration
├── background.js           # Service worker
├── popup/                  # Quick save interface
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── library/                # Main library interface
│   ├── library.html
│   ├── library.js
│   └── library.css
├── content/                # Content script for page injection
│   ├── content.js
│   └── content.css
├── icons/                  # Extension icons
└── readme.md              # This file
```

## Usage Tips

- **Add Categories**: Create categories that match your interests
- **Organize Regularly**: Keep your library tidy by categorizing new saves
- **Export Backup**: Regularly export your library to JSON for safety
- **Search Feature**: Use the search bar to quickly find videos by title or keywords
- **Filter by Platform**: Click on category tags to filter videos

## Data Storage

All your saved videos and categories are stored locally in your browser using the Chrome Storage API. None of your data is sent to external servers.

## Version

Current Version: **1.3.1**

## License

Open source project

---

**Enjoy organizing your short video collection efficiently! 🎥**
