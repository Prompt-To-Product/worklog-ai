# Change Log

All notable changes to the "Worklog AI" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2025-07-04

### Added

- Added demo video to README.md
- updated LICENSE file with MIT license details
- Added DEVELOPMENT.md with comprehensive guide for local development and testing
- Added Contributing section to README.md

### Changed

- Completely redesigned README.md with improved structure and content
- Improved user interface with more descriptive button labels
- Added emojis to command titles for better visual recognition
- Added settings button to the sidebar for quick access to configuration
- Reorganized sidebar buttons for better usability
- Added command categories for better organization in the Command Palette

## [0.1.4] - 2025-07-04

### Added

- Added extension icon for better visibility in VS Code Marketplace
- Improved visual branding

## [0.1.3] - 2025-07-04

### Changed

- Updated author and creator information in extension metadata
- Added proper attribution to both developers (Rahul Sharma and Devendra Parihar)
- Improved README documentation for better user understanding

## [0.1.2] - 2025-07-04

### Fixed

- Resolved issues with extension marketplace visibility
- Improved error handling for API requests
- Fixed UI rendering issues in the worklog panel

## [0.1.1] - 2025-07-04

### Added

- Enhanced documentation with step-by-step usage guide
- Added troubleshooting section to README
- Improved keyboard shortcut documentation

### Fixed

- Minor bug fixes and performance improvements

## [0.1.0] - 2025-07-04

### Added

- Initial release of Worklog AI extension
- Support for generating worklogs from uncommitted changes
- Support for generating worklogs from specific commits
- Integration with Google Gemini API (using gemini-2.0-flash model)
- Integration with OpenAI API (using gpt-4o model)
- Three worklog styles: Technical and Business
- Copy to clipboard functionality
- Export to file functionality
- Customizable settings for API keys and default preferences
- Keyboard shortcuts for quick access

### Technical Details

- Built with TypeScript and VS Code Extension API
- Git integration for extracting code changes
- HTTP requests for LLM API communication
- User interface with dropdown menus and result display
