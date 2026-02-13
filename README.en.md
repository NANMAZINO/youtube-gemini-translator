[View Technical README (English)](extension/README.md)

# 🤖 YouTube AI Translator User Guide

> **"Enjoy YouTube with AI that understands context, beyond language barriers."**

**YouTube AI Translator** is more than just a translator. Leveraging Google's latest **Gemini 1.5 Flash** (updated from Gemini 3 Flash for accuracy) AI model, it understands the full context of a video and provides natural English/Korean subtitles in real-time as a Chrome extension.

---

## 🌟 Introduction

### Why YouTube AI Translator?

Existing auto-translations often break context or fail to track pronouns because they translate sentence by sentence. **YouTube AI Translator** is different.

- **🧠 Context-Aware:** It remembers preceding and following content to provide seamless, natural translations.
- **⚡ Real-time Streaming:** Subtitles are overlaid directly on the video as the AI translates them.
- **🎯 Precision Refinement:** It gathers fragmented auto-generated captions into clean, coherent sentences.
- **💰 Cost-Effective:** Utilizing the Google Gemini API Free Tier, individual users can use it for free in most cases.

---

## 🚀 Installation

Currently, this program can be installed via Developer Mode.

1. **Prepare Source Code**: Unzip the provided ZIP file or download the code via Git.
2. **Access Chrome Extensions Page**:
   - Type `chrome://extensions` in the address bar.
   - Or navigate via Menu (⋮) > Extensions > Manage Extensions.
3. **Enable Developer Mode**: Toggle the **[Developer mode]** switch in the top right to **ON**.
4. **Load Extension**:
   - Click the **[Load unpacked]** button in the top left.
   - Select the **`extension`** folder inside the project directory.
5. **Complete**: When the **"YouTube AI Translator"** card appears, installation is successful!
   - _Tip: Click the puzzle icon (🧩) and pin (📌) the extension for easy access._

---

## 🔑 Getting Started

A Google Gemini API Key is required (takes about 1 minute).

### Step 1: Issue API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and log in with your Google account.
2. Click the **"Create API Key"** button.
3. Copy the generated key string.

### Step 2: Register Key in Extension

1. Click the **YouTube AI Translator icon** in the Chrome toolbar.
2. Paste the copied key into the **"Gemini API Key"** input field in the popup.
3. Click the **[Save]** button.

> **Security Note:** Your API Key is stored only inside your browser (obfuscated) and is never transmitted to any external servers.

---

## 📖 User Manual

### 1. Open Subtitle Panel

When you visit a YouTube video page, a **"📜 Open Script"** button will appear next to the Like/Share buttons. Clicking this opens the subtitle (script) panel on the right.

### 2. Start AI Translation

Click the **"🤖 AI Translate"** button added at the top of the subtitle panel.

- The AI reads the captions and begins translation (real-time progress indicator).
- Translated content is **beautifully overlaid on the video screen**.
- You can also check the translated text directly in the original subtitle panel.

> [!TIP]
> **Overlay Subtitle Customization:**
>
> - **Repositioning:** Drag the subtitle overlay with your mouse to move it anywhere.
> - **Resizing:** Hover over the overlay and use `Ctrl + Scroll Wheel` to adjust text size in real-time.

### 3. Subtitle Refinement (Refine)

Auto-generated captions are often fragmented and hard to read. Once translation is complete, the **"Refine Subtitles"** button next to the AI Translate button is activated.

- Clicking this makes the AI readjust the subtitle timelines based on context.
- Fragmented words are reorganized into clean, easy-to-read sentences.

### 4. Adjust Settings (Optional)

Click the extension icon to change settings in the popup menu.

- **Thinking Level (Inference Level):**
  - **Minimal (Default):** Fast and economical. Suitable for most videos.
  - **Low/Medium/High:** Smarter translations for complex content or multi-speaker videos. (May take slightly more time and tokens.)
- **Language Settings:** Set the source language (Auto-detect) and target language (Korean, English, Japanese).

### 5. Export and Import Data (Advanced)

Save translated data to a file or import it from other devices.

- **Export:** Click the **[Export]** button in the subtitle panel to save the current translation as a JSON file.
- **Import:** Use the **[Import]** button injected below the video to load a saved JSON file and apply it immediately.

### 6. Task Management

- **Auto-Stop:** If you move to another tab or click a different video during translation, the process automatically stops immediately to save battery and resources.

---

## 💡 FAQ

**Q. Can it translate videos without subtitles?**
A. No. It requires existing YouTube subtitle data (including auto-generated ones). Videos without any subtitle data are not supported.

**Q. How much does it cost?**
A. Google Gemini API provides a **generous Free Tier** for individual users. For typical YouTube viewing patterns, the free limit is usually sufficient.

- You can check estimated real-time costs (if free tier is exceeded) in the **"Token Usage"** tab of the popup menu.

**Q. The translation stopped.**
A. It might be a temporary network error or API rate limit.

- If the "AI Translate" button changes to a "Retry" state, click it again.
- It automatically attempts up to 3 retries.

**Q. Do I need to translate every time I re-watch a video?**
A. No! Translated content is **automatically cached on your computer for 30 days**. Re-visiting will instantly load the translated subtitles.

---

## 🛠 Troubleshooting

- **403 Error (Permission Denied):** API Key is incorrect or expired. Please re-issue and register a new key.
- **429 Error (Resource Exhausted):** Too many requests in a short period. Wait 1-2 minutes and try again.

---

Explore the world's knowledge and entertainment without language barriers with YouTube AI Translator! 🌍✨
