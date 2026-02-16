[View Technical README](extension/README.md)

# 🤖 YouTube AI Translator User Guide

> **"Enjoy YouTube with AI that understands context, beyond language barriers."**

**YouTube AI Translator** is more than a simple translator. Powered by Google's **Gemini 3 Flash Preview** model, it understands the full context of a video and provides natural subtitles in real time as a Chrome extension. In the popup, you can set the source language (Auto) and the target language (Korean, English, Japanese).

---

## 🌟 Introduction

### Why YouTube AI Translator?

Existing auto-translations often break context or fail to track pronouns because they translate sentence by sentence. **YouTube AI Translator** is different.

- **🧠 Context-Aware:** Remembers surrounding context to keep tone and terminology consistent.
- **⚡ Real-time Streaming:** Translation progress and results update immediately in the panel/overlay.
- **🎯 Precision Refinement (Refine):** Re-groups fragmented auto-captions into clean, readable sentences.
- **💰 Cost-Effective:** Uses the Google Gemini API Free Tier, so individual users can often use it for free.

---

## 🚀 Installation

Currently, this extension is installed via Developer Mode.

1. **Prepare Source Code**: Unzip the provided ZIP file or download the code via Git.
2. **Open Chrome Extensions Page**:
   - Type `chrome://extensions` in the address bar.
   - Or navigate via Menu (⋮) > Extensions > Manage Extensions.
3. **Enable Developer Mode**: Toggle **[Developer mode]** (top right) to **ON**.
4. **Load Extension**:
   - Click **[Load unpacked]** (top left).
   - Select the **`extension`** folder inside the project directory.
5. **Done**: When the **"YouTube AI Translator"** card appears, installation is successful!
   - _Tip: Click the puzzle icon (🧩) and pin (📌) the extension for easy access._

---

## 🔑 Getting Started

A Google Gemini API Key is required (takes about 1 minute).

### Step 1: Create an API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and log in with your Google account.
2. Click **"Create API Key"**.
3. Copy the generated key string.

### Step 2: Register the Key in the Extension

1. Click the **YouTube AI Translator** icon in the Chrome toolbar.
2. Paste the key into the **"Gemini API Key"** field.
3. Click **[Save]**.

> **Security Note:** Your API key is stored locally in your browser (obfuscated via XOR+Base64). This extension does not run a developer-managed server — translation requests are sent **directly from your browser to the Google Gemini API**.

---

## 📖 User Manual

### 1. Open the Script (Transcript) Panel

On a YouTube video page, a **"📜 Open Script"** button appears near the Like/Share buttons. Click it to open the transcript panel on the right.

### 2. Start AI Translation

Click the **"🤖 AI Translate"** button added at the top of the transcript panel.

- The AI reads the captions and starts translating (with a real-time progress indicator).
- Translated content is also shown as a **subtitle overlay on the video**.
- You can review translations inside the extension’s translation panel as well.

> [!TIP]
> **Overlay subtitle customization:**
>
> - **Reposition:** Drag the overlay to move it anywhere.
> - **Resize:** Hover over the overlay and use your **mouse wheel** to change font size.
> - **Reset:** Double-click the overlay to reset its position.

### 3. Subtitle Refinement (Refine)

Auto-generated captions are often fragmented and hard to read. After translation completes, the **"재분할"** (Refine) button next to AI Translate becomes available.

- It readjusts subtitle timings based on context.
- Fragmented words are reorganized into clean, easy-to-read sentences.

### 4. Adjust Settings (Optional)

Click the extension icon to change settings in the popup.

- **Thinking Level:**
  - **Minimal (Default):** Fast and economical; good for most videos.
  - **Low / Medium / High:** Better for complex content or multiple speakers (may use more tokens and time).
- **Language Settings:** Set the source language (Auto-detect) and target language (Korean, English, Japanese).
- **Resume Mode:** If translation is interrupted (e.g., refresh/F5), reuse completed chunks and continue from where it left off to save time and tokens.
- **Token Usage:** Check **Today / 30 days** token usage with an **estimated cost (approx.)**.
- **Cache Management:** View count/size, delete individual items, or clear all (max 100 entries, auto-expire after 30 days).

### 5. Export / Import JSON (Advanced)

Save translations to a file or import them later.

- **Export (📥):** Click **📥** in the translation panel header to download the current translation as JSON.
- **Import (📂):** Click **📂** to load a JSON file and apply it immediately.
  - Imported data is automatically saved to cache, and import may be disabled when a cache entry already exists for the same video/language.

### 6. Task Management

- **Auto-Stop:** If you switch tabs or open a different video during translation, the task stops immediately to save battery and resources.

---

## 💡 FAQ

**Q. Can it translate videos without subtitles?**

A. No. It requires existing YouTube caption data (including auto-generated ones). Videos without any caption data are not supported.

**Q. How much does it cost?**

A. Google Gemini API provides a **generous Free Tier** for individual users. For typical viewing patterns, the free limit is often sufficient.

- Check **Token Usage** in the popup for **Today/30 days** usage and an **estimated cost (approx.)**.

**Q. The translation stopped.**

A. It may be a temporary network issue, server overload (429/503), or quota limits (403).

- If the button changes to a "Retry" state, click it again.
- It automatically attempts up to 3 retries.

**Q. Do I need to translate every time I re-watch a video?**

A. No. Translations are **cached for 30 days**. Re-visiting can load instantly.

- You can review and clear caches in **Cache Management** in the popup.

---

## 🛠 Troubleshooting

- **403 Error:** Often indicates quota limits (Free Tier) or key/project permission issues. Try again later and verify your API key/billing status in AI Studio.
- **429/503 Error:** The server is overloaded. Wait 1–2 minutes and retry.

---

Explore the world's knowledge and entertainment without language barriers with YouTube AI Translator! 🌍✨

---

imxtraa7@gmail.com
