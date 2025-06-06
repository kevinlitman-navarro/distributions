# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SvelteKit-based data visualization project using Svelte 5 with runes. The project creates interactive survey forms where users rate themselves on various attributes and see how their responses compare to others using beeswarm charts. It's built on The Pudding's svelte-starter template for data-driven visual stories.

## Essential Commands

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

### Code Quality
- `npm run lint` - Check code formatting with Prettier
- `npm run format` - Format code with Prettier

### Data Management
- `npm run gdoc` - Fetch latest data from Google Docs/Sheets
- `npm run style` - Regenerate style dictionary from properties/ folder

### Deployment
- `make github` - Deploy to GitHub Pages (builds to docs/ folder)
- `make protect` - Create password-protected build (requires .env with PASSWORD)

## Architecture

### Core Components
- **Index.svelte** - Main application container, loads questions from CSV and manages survey state
- **BeeswarmChart.svelte** - Interactive D3-based visualization for displaying user responses as dots on a scale
- **DemographicSurvey.svelte** - Optional demographic data collection form
- **InteractiveHistogram.svelte** - Alternative chart visualization (present but not currently used)

### Data Flow
1. Questions are loaded from `/data/questions.csv` with metadata including axis labels and comparison groups
2. User responses are stored in JSON files with naming pattern `{question}_{group}_responses.json`
3. API endpoint `/api/responses` handles GET/POST operations for response data
4. Local storage tracks answered questions and survey completion state

### File Structure
- `src/data/` - JSON response files and questions CSV
- `src/components/` - Svelte components including charts and surveys
- `src/routes/api/responses/` - Server endpoint for data persistence
- `properties/` - Style Dictionary configuration for design tokens
- `static/data/` - Public data files accessible via fetch

### Key Technologies
- **Svelte 5** with runes (new reactivity system)
- **D3.js** for data visualization and DOM manipulation
- **SvelteKit** for SSR and static site generation
- **Style Dictionary** for design token management
- **ArchieML** integration for Google Docs CMS

### Data Management
The project uses a hybrid approach:
- CSV files define question metadata
- JSON files store user responses (created dynamically)
- Google Docs integration via google.config.js for content management
- Local storage for client-side state persistence

### Styling Approach
- Global styles in `src/styles/app.css`
- Component-scoped styles within each .svelte file
- Design tokens managed via Style Dictionary in properties/ folder
- PostCSS with Autoprefixer for CSS processing

## Development Notes

### Svelte 5 Migration Status
This project uses Svelte 5 and is under active migration. Some components may need updates from Svelte 4 patterns.

### Response Data Structure
Each question generates 3 response files for comparison groups: friends, country, world. The BeeswarmChart component handles switching between these datasets.

### Local Development
The project includes demo pages at `/demo/` for testing components and fonts. Use these for development and testing new features.