# 🚀 Student Face Dataset Collection PWA — Production Deployment Guide

A step-by-step guide for deploying the **Student Face Dataset Collection Progressive Web App (PWA)** to a high-availability, zero-maintenance global static CDN.

---

## 🏗️ Architecture & Reliability Overview

Unlike standard web applications with backend servers (e.g. Render container web services) that spin down on inactivity and purge local files on restart, this application is engineered as a **100% Client-Side Static Progressive Web App (PWA)**:

- **Zero Server Restarts**: The application is served from static edge CDN nodes. The deployment link remains **live 24/7/365 indefinitely**.
- **100% Offline Persistence**: Student photos and metadata are stored directly in the browser's persistent **IndexedDB (`FaceCaptureDB`)** storage. No server database is required.
- **In-Browser Neural Processing**: Face detection and landmark models (`TinyFaceDetector` + `68-point landmarks`) execute via browser WebAssembly (WASM).
- **Secure Sandbox**: Student dataset exports and admin functions are protected by cryptographic SHA-256 salted passcode verification (**Passcode: `2456`**).

---

## ⚡ Recommended Deployment Platforms

| Platform | Best For | Cold Starts | SSL / Camera Support | Free Tier Duration |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** *(Recommended)* | 1-Click Vite integration, automatic HTTPS, global edge caching for `/models/` | **0ms (Instant CDN)** | ✅ Full HTTPS | Permanent Free |
| **Cloudflare Pages** | Unlimited bandwidth, fast global edge network | **0ms (Instant CDN)** | ✅ Full HTTPS | Permanent Free |
| **Netlify** | Simple drag-and-drop or Git continuous deployment | **0ms (Instant CDN)** | ✅ Full HTTPS | Permanent Free |

---

## 📋 Pre-Deployment Verification

Before deploying, ensure your local workspace builds cleanly:

```bash
# 1. Install dependencies
npm install

# 2. Test local production build
npm run build
```

Verify that the output shows `dist/` generated with precache service workers and zero errors:
```
dist/registerSW.js
dist/manifest.webmanifest
dist/index.html
dist/assets/index-...js
dist/assets/vendor-...js
dist/assets/face-api-...js
✓ built in ~2s
```

---

## 🥇 Method 1: Deploying to Vercel (Recommended)

Vercel provides zero-configuration Vite deployment with automatic SPA routing and caching configured in [`vercel.json`](file:///c:/Users/Hashvanth/Student%20PWA/vercel.json).

### Option A: Via GitHub (Continuous Deployment)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete student face capture PWA with admin security"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New…"** $\rightarrow$ **"Project"**.
   - Select your GitHub repository and click **"Import"**.

3. **Configure Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Click "Deploy"**:
   - Deployment takes ~30–45 seconds.
   - You will receive a permanent HTTPS URL (e.g., `https://student-face-capture-pwa.vercel.app`).

---

### Option B: Direct Deploy via Vercel CLI

If you prefer deploying directly from your terminal without connecting Git:

```bash
# 1. Install Vercel CLI globally (one-time)
npm install -g vercel

# 2. Log in to Vercel
vercel login

# 3. Deploy to production
vercel --prod
```

Answer the interactive prompts:
- *Set up and deploy?* $\rightarrow$ **Y**
- *Which scope?* $\rightarrow$ Select your account
- *Link to existing project?* $\rightarrow$ **N**
- *Project name?* $\rightarrow$ `student-face-capture-pwa`
- *Directory?* $\rightarrow$ `./`
- *Auto-detected settings (Vite / dist)?* $\rightarrow$ **Y**

---

## 🥈 Method 2: Deploying to Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and select **Workers & Pages**.
2. Click **"Create Application"** $\rightarrow$ **"Pages"** $\rightarrow$ **"Connect to Git"**.
3. Select your repository.
4. Set build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **"Save and Deploy"**.

---

## 🥉 Method 3: Deploying to Netlify

1. Go to [netlify.com](https://www.netlify.com/) and log in.
2. Click **"Add new site"** $\rightarrow$ **"Import an existing project"**.
3. Select your Git provider and repository.
4. Set build settings:
   - **Base directory**: (leave empty)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **"Deploy Site"**.

---

## 🔒 Crucial Security & Camera Permissions Notice

> [!IMPORTANT]
> **HTTPS is Mandatory for Webcams**: Modern web browsers strictly disable camera access (`navigator.mediaDevices.getUserMedia`) on unencrypted `http://` connections outside of `localhost`.
> All recommended platforms (Vercel, Cloudflare, Netlify) automatically issue and manage free SSL/TLS certificates so your camera feed works seamlessly on laptops, tablets, and smartphones.

---

## 📲 Post-Deployment: Operator & Student Usage Guide

### 1. Installing the PWA to Home Screen
1. Open your live deployment link in Chrome, Edge, Safari, or Brave on your collection tablet or laptop.
2. Click the **"Install Progressive Web App"** prompt banner or the browser's URL bar install button (📲).
3. The app opens full-screen in standalone app mode with zero browser address bar clutter.

### 2. Student Collection Flow (Public Mode)
1. **Student Registration**: The student enters their Full Name, Registration Number (`310625205065`), Department (`IT`), Section (`A`–`D`), and College Email.
2. **Consent Agreement**: Institutional consent notice is reviewed and accepted.
3. **4-Angle Biometric Capture**:
   - **Step 1: Front**: Straight-on neutral gaze.
   - **Step 2: Left Profile**: Turn head to expose **Left cheek & ear**.
   - **Step 3: Right Profile**: Turn head to expose **Right cheek & ear**.
   - **Step 4: Overall Clarity**: High-clarity face portrait.
4. **Verification & Review**: Student reviews their 4 photos (with single-pose retake option) and clicks **"Confirm & Save Student Dataset"**.
5. **Submission Screen**: Shows dataset confirmation card and a **"+ Register Next Student"** button. Other students' records remain hidden.

### 3. Admin Console & Dataset Export (Protected by Passcode)
1. In the top-right header, click **`🔒 Admin Vault`**.
2. Enter the cryptographic passcode: **`2456`**.
3. Click **"Unlock Admin Vault"**.
4. In the Admin Console, you can:
   - Browse, search, and filter the complete student roster.
   - Click any student to inspect 720×720 photos in a lightbox and export an individual student ZIP.
   - Click **"Export ZIP"** to download the master dataset archive.
   - Click **`🔒 Lock Vault`** to immediately lock the app back into student mode.

---

## 📁 Dataset Folder Structure Output

When clicking **"Export ZIP"**, the generated archive contains clean, non-mixed folders ready for training:

```
Student_Face_Dataset_2026-09-03.zip
├── 310625205065_Dhanush/
│   ├── front.jpg         (720×720 JPEG @ 85%)
│   ├── left.jpg          (720×720 JPEG @ 85%)
│   ├── right.jpg         (720×720 JPEG @ 85%)
│   ├── overall.jpg       (720×720 JPEG @ 85%)
│   └── metadata.json     (Student info, timestamps, quality scores)
├── 310625205100_HashvanthMU/
│   ├── front.jpg
│   ├── left.jpg
│   ├── right.jpg
│   ├── overall.jpg
│   └── metadata.json
├── index.csv             (Master tabular roster)
└── index.json            (Complete dataset JSON manifest)
```

---

## 🛠️ Operational Maintenance & Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Camera Access Blocked"** | Camera permissions not granted in browser | Click the lock/tune icon in the browser address bar $\rightarrow$ Set Camera to **Allow** $\rightarrow$ Click "Retry Camera Connection". |
| **Models taking long on first load** | Downloading ~2MB WASM neural weights | On first visit, the app caches `/models/` via Service Worker. Subsequent loads are instant (<0.5s) offline. |
| **Data retention across devices** | IndexedDB is stored locally in the specific device's browser | Collect datasets on your designated intake device/tablet, then use **Export ZIP** to transfer the dataset archive to your training server. |
