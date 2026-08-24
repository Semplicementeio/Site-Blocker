# Site Blocker - Minimal & Privacy-First Browser Extension

**Site Blocker** is a minimalist, privacy-first browser extension designed to help you regain full control over your digital focus and browsing habits without tracking or compromising your data.

Most site blockers quietly collect telemetry or inject third-party scripts. Site Blocker does **none** of that. It is open-source, lightweight, and 100% local — **everything stays on your device**.

---

## 🌐 Supported Browsers

Compatible with all major modern web browsers supporting WebExtension Manifest V3:

- **Brave**
- **Firefox** (Desktop, Nightly, Developer Edition, LibreWolf, Waterfox)
- **Chrome**
- **Edge**
- **Vivaldi**
- **Opera**

---

## 🛠 Main Features

- **🎯 Distraction-Free Mode (1-Click Master Switch)**: Turn on a single toggle to temporarily block all major social media platforms and doomscrolling sites (*YouTube, Instagram, TikTok, Facebook, X/Twitter, Reddit, Twitch, Netflix, Threads, Pinterest, LinkedIn, Discord, etc.*) without polluting your personal blocklist.
- **🚫 Anti-Shorts & Reels Mode**: Granular toggles to block short-form videos across **YouTube Shorts**, **Instagram Reels**, **TikTok**, and **Facebook Reels** (hides UI elements/shelves and blocks direct navigation).
- **🧘 Mindful Pause & Breathing Screen**: When attempting to access a blocked page, enjoy a calm dark-mode screen with guided breathing animation (*Inhale... Hold... Exhale...*) and a 10-second reflection countdown before deciding to continue.
- **🌐 Custom Blocklist**: Maintain your own clean, personal list of blocked sites and subdomains with 1-click addition and removal.
- **⚡ Instant Tab Redirection**: Actively updates and redirects open tabs in real-time as soon as you toggle modes or block a site.
- **🎨 Premium Violet Dark Mode**: Sleek, unified dark interface styled with a coherent violet theme (`#8b5cf6`) and 100% local system UI fonts (zero external Google Fonts or CDNs).
- **💾 Import / Export**: Backup and restore your custom blocklist anytime via JSON.
- **🔒 Privacy-First & CSP Compliant**: Built strictly with WebExtensions Manifest V3 with 0 analytics, 0 telemetry, and 100% local storage.

---

## 🚀 Getting Started

1. Clone or download this repository to your computer:
   ```bash
   git clone https://github.com/Loki-it/Site-Blocker.git
   ```

---

### 🌐 Chrome & Chromium Browsers (Brave, Edge, Vivaldi, Opera)

1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode** in the top-right corner.
3. Click **"Load unpacked"** and select the extension directory.
4. Click the extension icon to manage your focus settings!

### 🦊 Mozilla Firefox

In standard Firefox releases, unsigned local extensions installed via `about:addons` are blocked with an *"unverified"* message. Use one of the following methods:

#### Method 1: Load Temporary Add-on (Recommended for local testing)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select the **`manifest.json`** file inside the extension folder (or select `web-ext-artifacts/site_blocker-2.0.zip`).
4. The extension will activate immediately without signature checks!

#### Method 2: Permanent Installation via `about:config` (Firefox Developer / Nightly / ESR)
If you want to install it permanently via `about:addons`:
1. Navigate to `about:config` in your URL bar and accept the warning.
2. Search for `xpinstall.signatures.required` and set it to **`false`**.
3. Go to `about:addons` ➔ ⚙️ ➔ **"Install Add-on From File..."** and select `web-ext-artifacts/site_blocker-2.0.zip`.

---

## 🤝 Contributing

Contributions and pull requests are welcome! Please keep all additions privacy-focused, lightweight, and local.

---

## 📜 License

Licensed under the [MIT License](LICENSE).
