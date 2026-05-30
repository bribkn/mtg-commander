# ✨ MTG Commander TTS Builder

[![React](https://img.shields.io/badge/React-19.2-blue?logo=react&logoColor=white)](https://react.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MTG Commander TTS Builder** is a modern, high-performance, and visually stunning deck builder designed for the Magic: The Gathering community. It allows players to construct Commander decks, customize card printings and variants, configure custom cardback images, track deck performance stats, and seamlessly export decks directly into highly-compatible **Tabletop Simulator (TTS)** JSON formats.

All of this is wrapped in a cinematic dark-mode interface built on a premium red-and-black color palette with micro-animations.

---

## 🌟 Key Features

### 1. 🎴 Multi-Deck Dashboard
* **Glassmorphic Design**: A premium landing page with fluid, hardware-accelerated grid layout cards and entrance transitions.
* **Dynamic Art crops**: Shows saved decks using the **custom cover card crop** or falls back to your commander's illustration automatically.
* **Real-time Performance stats**: Displays card counts, commander status, and calculated win rate percentage (**% WR**) right on each deck card.
* **Quick Actions**: Duplicate, delete, or open decks in one click.

### 2. 🌌 Panoramic Deck Hero Banner
* An immersive banner at the top of the editor displaying a gorgeous, slightly-blurred art crop (`art_crop`) of the deck's active cover card or commander.
* **Inline Renaming**: Double-click or tap the deck name to instantly edit the title in place with live saving.
* **Commander Crown Subtitle**: Elegantly renders the commander's name under the title with a glowing, pulse-animated Lucide crown.

### 3. 🛡️ Four Premium Card Layout Views
* **Visual Grid (Default)**: A beautiful high-res card grid using standard 5:7 ratios, sized dynamically up to `250px`. Features a ultra-tight `gap-2` to mimic a real card binder. Hovering reveals interactive controls to adjust quantity, toggle commander status, set as deck cover art, swap prints, or remove.
* **Visual Stack**: Vertically overlaps cards to replicate real physical card piles. Hovering slides cards up and forward with smooth micro-animations.
* **Detailed List (Text View)**: Clean list rows showcasing card thumbnails, mana costs, card types, and full inline controls.
* **Condensed List**: A super-compact, padding-minimized list displaying card counts, names, and rapid actions. Ideal for review on huge screens or managing massive piles.

### 4. ⚡ Combos Discovery Integration (Commander Spellbook)
* A glowing yellow Lucide `Zap` (Lightning) button is integrated across all card views.
* Clicking the ray opens **Commander Spellbook** (the official community combo engine behind EDHREC) pre-queried for that specific card in a new tab, detailing step-by-step resolution guides, legalities, and color-identity requirements with zero latency.

### 5. 🖼️ Widescreen Printings Variant Dialog
* Swap out any card's artwork with a widescreen variant selector modal (`max-w-5xl`).
* Queries the Scryfall API live to fetch all historical printings of the card—from Alpha and Beta to promos, borderless arts, and retro frame releases.
* Shows set names, codes, rarities, and set logos. Selecting any variant updates the illustration crops globally—instantly updating visual piles, cover card crops, panoramic banners, and Tabletop Simulator exports.

### 6. 🎨 Custom Proportional Cardbacks
* Features a custom saved cardbacks gallery synced to `localStorage`.
* **Proportional Scaling (`object-cover`)**: Custom URLs are automatically cropped to the vertical MTG playing card format (5:7 ratio) without any stretching, pixelation, or deformation.
* Easily toggle back to the official MTG cardback. Selected cardbacks are automatically mapped into TTS exports.

### 7. 🏆 Performance Match Registry
* Sidebar Trophy widget allowing real-time win/loss entries.
* Calculates Winrate % instantly and displays golden-yellow winrate badges on saved decks in the main landing grid.

### 8. 📝 Block-Based Bulk Import & Commander Auto-Detection
* Advanced list import parser splits lines by blank line sections.
* Heuristics automatically flag single isolated cards or short blocks separated at the bottom or top of lists as your active Commander, assigning the commander state automatically.

---

## 🛠️ Technology Stack

* **Framework**: [Next.js 16](https://nextjs.org) (App Router, Turbopack enabled)
* **Core Library**: [React 19](https://react.dev)
* **Styling**: Tailwind CSS 4 & Vanilla CSS custom design tokens
* **Iconography**: [Lucide React](https://lucide.dev)
* **Primitives**: Shadcn UI & Radix UI accessible wrappers
* **State / Storage**: React Context, Reducers, and real-time synchronization with client-side `localStorage`.

---

## 🚀 Getting Started

Follow these steps to run the MTG Commander TTS Builder locally:

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/mtg-commander-tts.git
cd mtg-commander-tts
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Local Dev Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 4. Build and Compile Check
Validate type health and compile production builds:
```bash
npm run build
```

---

## 📂 Modular Architecture

The repository is organized following clean architectural guidelines:

```
├── app/
│   ├── api/                   # API routes for external Moxfield & Archidekt proxy fetching
│   ├── layout.tsx             # Root layout & Google Fonts integration
│   └── page.tsx               # Entry page (Toggles between Dashboard and Editor view)
├── components/
│   ├── ui/                    # Atomic Tailwind components (Dialogs, Buttons, Inputs, etc.)
│   ├── CardbackModal.tsx      # Cardback image configuration, preview, and gallery modal
│   ├── CardList.tsx           # Core view manager (Visual Grid, Visual Stack, List, Condensed)
│   ├── CardSearchBar.tsx      # Scryfall query search bar with fuzzy autocompletions
│   ├── DeckDashboard.tsx      # Welcome landing page & deck list grid manager
│   ├── DeckHeader.tsx         # Header editor containing panoramic hero banner controls
│   ├── ExportPanel.tsx        # Exporter interface to produce Tabletop Simulator outputs
│   ├── ImportModal.tsx        # Multi-tab URL proxy & bulk copy-paste parser
│   └── StatsPanel.tsx         # Left-sidebar stats panel (Mana curve, performance trophy manager)
├── lib/
│   ├── deck-store.tsx         # Global context state store (Reducers, actions, local persistence)
│   ├── import.ts              # Text block algorithms & Commander heuristics
│   ├── scryfall.ts            # Client interface querying Scryfall fuzzy searches
│   └── tts-export.ts          # Tabletop Simulator compatible JSON generator compiler
├── public/                    # Static image assets
└── package.json
```

---

## 🤝 Open Source Contributions

This project is **100% open-source** and free for the MTG community. Contributions, forks, and pull requests are highly encouraged!

To contribute:
1. **Fork** this repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a **Pull Request** detailing your upgrades.

---

## 📝 License

This project is licensed under the **MIT License**. You are free to copy, modify, distribute, or commercialize this builder as you wish.

*Created with passion by MTG and Commander players. May your starting hand always contain at least three lands!* 🃏✨
