# Change Log

All notable changes to the "Worklog AI" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-07-17

### Fixed
- Fixed command naming inconsistencies in package.json
- Fixed generate commit message button


## [0.2.1] - 2025-07-16

### Added
- New "Generate Commit Message" command with a dedicated button to create concise commit messages
- Added UI buttons for the new features
- Added option to directly use generated commit messages in the SCM input box

### Changed
- Improved detection of today's changes using multiple approaches for better reliability
- Enhanced commit message integration with SCM to properly format commit messages
- Updated README to document new features
- Improved command naming consistency

### Fixed
- Fixed "No changes detected for today" error with more robust git command handling
- Fixed SCM integration to properly handle commit message format

## [0.2.0] - 2025-07-07

### Added
- Added support for locally hosted LLMs as a third AI provider option
- New configuration options for local LLM base URL and model name
- UI for managing local LLM settings in the extension sidebar
- Improved API key configuration flow for all providers
- Automatic prompting for API keys when selecting providers
- Added detailed setup guide for running local LLMs with Ollama

## [0.1.9] - 2025-07-07

### Fixed
- Fixed "permission denied" error when saving worklogs by using workspace folder path instead of root directory
- Improved file path handling for worklog export functionality

## [0.1.8] - 2025-07-07

### Changed
- Updated extension categories from "Other" to "SCM Providers" and "Productivity" for better marketplace discoverability
- Improved extension metadata for better categorization in VS Code Marketplace

## [0.1.7] - 2025-07-06

### Fixed
- Fixed DSU script for better response

## [0.1.6] - 2025-07-05

### Added
- Daily Stand-up (DSU) script generation alongside worklog bullets
- Branch selection feature for viewing commits by branch
- User-specific commit filtering based on git user email
- Auto-open feature for worklog panel after generation
- Copy DSU script button for quick sharing in meetings

### Changed
- Improved UI organization with collapsible sections
- Enhanced button styling with better visual hierarchy
- Updated worklog generation prompts for better output quality
- Reorganized settings section for easier configuration
- Changed default worklog style to Business

### Fixed
- Fixed collapsible sections not expanding on click
- Fixed loading indicator not stopping after worklog generation
- Removed "WORKLOG BULLETS:" formatting artifacts from output
- Fixed branch and commit selection UI issues
- Improved error handling for empty commits

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
