# Saga Family Biography Export Format Documentation

## Overview

The Saga Family Biography platform provides comprehensive data export functionality to ensure your family stories are preserved and accessible for future generations. This document describes the export formats, file structures, and how to use your exported data.

## Export Formats

### ZIP Archive Format (Recommended)

The ZIP format provides a well-organized, human-readable archive of your family stories with the following structure:

```
family-stories-export.zip
├── README.txt                          # Human-readable guide
├── manifest.json                       # Export metadata and structure
├── stories/                           # Organized story folders
│   ├── Early_Life/                    # Chapter-based organization
│   │   ├── Childhood_Memory/          # Individual story folder
│   │   │   ├── audio.mp3             # Original audio recording
│   │   │   ├── photo.jpg             # Associated photo
│   │   │   ├── transcript.txt        # Story transcript
│   │   │   └── metadata.json         # Story metadata
│   │   └── First_Day_School/
│   │       ├── audio.mp3
│   │       ├── transcript.txt
│   │       └── metadata.json
│   ├── Education/
│   │   └── College_Years/
│   │       ├── audio.mp3
│   │       ├── photo.jpg
│   │       ├── transcript.txt
│   │       └── metadata.json
│   └── uncategorized/                 # Stories without chapters
│       └── Random_Memory/
│           ├── audio.mp3
│           ├── transcript.txt
│           └── metadata.json
├── data/                              # Structured data files
│   ├── stories.json                   # Complete story data
│   ├── interactions.json              # Facilitator interactions
│   └── chapter-summaries.json         # AI-generated summaries
└── metadata/                          # Export information
    ├── export-info.json               # Export configuration
    └── project-info.json              # Project details
```

### JSON Format

The JSON format provides all data in a single structured file, ideal for programmatic access:

```json
{
  "manifest": {
    "projectInfo": { ... },
    "exportInfo": { ... },
    "structure": { ... }
  },
  "project": {
    "id": "project-123",
    "name": "Family Stories",
    "description": "Our family memories",
    "facilitators": [...],
    "storyteller": { ... }
  },
  "stories": [
    {
      "id": "story-1",
      "title": "Childhood Memory",
      "transcript": "This is a story about...",
      "audioUrl": "https://...",
      "photoUrl": "https://...",
      "createdAt": "2024-01-01T00:00:00Z",
      "chapterName": "Early Life",
      "metadata": {
        "duration": 120,
        "recordingDevice": "iPhone",
        "location": "Home"
      }
    }
  ],
  "interactions": [...],
  "chapterSummaries": [...]
}
```

## File Types and Descriptions

### Core Files

| File | Type | Description |
|------|------|-------------|
| `README.txt` | Text | Human-readable guide to the archive |
| `manifest.json` | JSON | Complete export metadata and file structure |

### Story Files

| File | Type | Description |
|------|------|-------------|
| `audio.mp3/m4a/wav` | Audio | Original audio recording |
| `photo.jpg/png` | Image | Associated photograph |
| `transcript.txt` | Text | Story transcript (editable) |
| `metadata.json` | JSON | Story details and technical metadata |

### Data Files

| File | Type | Description |
|------|------|-------------|
| `stories.json` | JSON | Structured data for all stories |
| `interactions.json` | JSON | All facilitator comments and questions |
| `chapter-summaries.json` | JSON | AI-generated chapter summaries |

### Metadata Files

| File | Type | Description |
|------|------|-------------|
| `export-info.json` | JSON | Export configuration and statistics |
| `project-info.json` | JSON | Project settings and participant information |

## Data Structures

### Story Metadata

Each story includes comprehensive metadata:

```json
{
  "id": "story-123",
  "title": "My First Day at School",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z",
  "chapterName": "Education",
  "duration": 180,
  "recordingDevice": "iPhone 15",
  "location": "Living Room",
  "hasAudio": true,
  "hasPhoto": false,
  "transcriptLength": 1250,
  "interactionCount": 3
}
```

### Export Manifest

The manifest provides complete information about the export:

```json
{
  "projectInfo": {
    "id": "project-123",
    "name": "Smith Family Stories",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "facilitators": [
      {
        "id": "user-123",
        "name": "John Smith",
        "email": "john@example.com",
        "role": "facilitator"
      }
    ],
    "storyteller": {
      "id": "user-456",
      "name": "Mary Smith",
      "email": "mary@example.com"
    }
  },
  "exportInfo": {
    "exportedAt": "2024-06-01T12:00:00Z",
    "exportVersion": "2.0",
    "totalStories": 25,
    "totalInteractions": 47,
    "totalFiles": 75,
    "estimatedSize": 524288000
  },
  "structure": {
    "folders": ["stories", "data", "metadata"],
    "files": [
      {
        "path": "stories/Early_Life/Childhood_Memory/audio.mp3",
        "type": "Audio",
        "size": 2048000,
        "description": "Audio recording for story: Childhood Memory"
      }
    ]
  }
}
```

## Using Your Exported Data

### Viewing Stories

1. **Extract the ZIP file** to a folder on your computer
2. **Open README.txt** for a complete guide to the archive
3. **Browse the stories folder** to find individual story folders organized by chapter
4. **Open transcript.txt files** with any text editor to read stories
5. **Play audio files** with any media player
6. **View photos** with any image viewer

### Accessing Structured Data

1. **Open data/stories.json** for complete story information in structured format
2. **Use data/interactions.json** to see all facilitator comments and questions
3. **Review data/chapter-summaries.json** for AI-generated chapter overviews

### Technical Integration

The JSON format is designed for easy integration with other systems:

```javascript
// Example: Loading and processing export data
const fs = require('fs');

// Load the complete export
const exportData = JSON.parse(fs.readFileSync('export.json', 'utf8'));

// Access stories
exportData.stories.forEach(story => {
  console.log(`Story: ${story.title}`);
  console.log(`Chapter: ${story.chapterName}`);
  console.log(`Duration: ${story.metadata.duration} seconds`);
});

// Access interactions
exportData.interactions.forEach(interaction => {
  console.log(`${interaction.facilitatorName}: ${interaction.content}`);
});
```

## Export Options

### Content Selection

- **Audio Files**: Original recordings in their native format
- **Photos**: Associated images in JPEG or PNG format
- **Transcripts**: Editable text versions of stories
- **Interactions**: All facilitator comments and follow-up questions
- **Chapter Summaries**: AI-generated thematic summaries
- **Metadata**: Technical details and export information

### Filtering Options

- **Date Range**: Export stories from specific time periods
- **Chapters**: Include only selected thematic chapters
- **Custom Naming**: Personalize your export file name

### Format Options

- **ZIP Archive**: Human-readable, organized folder structure
- **JSON File**: Single structured file for technical use

## Data Preservation

### Long-term Accessibility

All export formats use standard, widely-supported file types:

- **Audio**: MP3, M4A, WAV (standard audio formats)
- **Images**: JPEG, PNG (standard image formats)
- **Text**: Plain text files (universally readable)
- **Data**: JSON (standard data format)

### Backup Recommendations

1. **Store in multiple locations**: Cloud storage, external drives, physical media
2. **Regular updates**: Export periodically as new stories are added
3. **Format migration**: Consider re-exporting every few years to ensure compatibility
4. **Documentation**: Keep this guide with your exports for future reference

## Technical Specifications

### File Limits

- **Maximum export size**: 5GB
- **Maximum stories per export**: 1,000
- **Maximum date range**: 24 months
- **Audio file formats**: MP3, M4A, WAV
- **Image file formats**: JPEG, PNG
- **Text encoding**: UTF-8

### Compatibility

- **Minimum viewer requirements**: Any modern operating system
- **Recommended software**: 
  - Text editors: Notepad, TextEdit, VS Code
  - Audio players: VLC, Windows Media Player, QuickTime
  - Image viewers: Photos app, Preview, any web browser
  - JSON viewers: Any text editor, web browser, or JSON viewer

### Security

- **Encryption**: Exports are encrypted during transfer
- **Access control**: Only project facilitators can create exports
- **Expiration**: Download links expire after 30 days
- **Privacy**: No personal data is included beyond what you've shared in stories

## Troubleshooting

### Common Issues

**Q: The ZIP file won't open**
A: Ensure you have a ZIP utility installed. Try 7-Zip (Windows) or The Unarchiver (Mac).

**Q: Audio files won't play**
A: Try VLC Media Player, which supports all audio formats used by Saga.

**Q: JSON file looks garbled**
A: Open with a proper text editor like Notepad++ or VS Code for better formatting.

**Q: Some files are missing**
A: Check the manifest.json file to see what was included in your export options.

### Getting Help

If you encounter issues with your export:

1. Check the README.txt file in your export
2. Review the manifest.json for export details
3. Contact support with your export ID for assistance

## Version History

- **v2.0** (Current): Enhanced folder structure, comprehensive metadata, progress tracking
- **v1.0**: Basic export functionality with simple file structure

---

*This documentation is for Saga Family Biography Export Format v2.0. For the most current version, visit our support documentation.*