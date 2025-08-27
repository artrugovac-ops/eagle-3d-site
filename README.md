# AZR Illyrian Eagle • GitHub Pages Site

This is a zero-build, CDN-powered static site that displays the **Illyrian Eagle** GLB model in real‑time with Three.js.

## 🚀 Quick Deploy (GitHub Pages)
1. Create a new repo (e.g., `eagle-3d-site`) on your GitHub.
2. Upload **all files** from this ZIP.
3. Put your model at **`assets/eagle.glb`** (rename if needed; spaces in filenames can cause issues).
4. Commit to the `main` branch.
5. Go to **Settings → Pages** and set:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / **Root**
6. Open the URL shown on the Pages card.

## 📦 Contents
- `index.html` – base HTML shell
- `styles/style.css` – minimal UI skin
- `js/main.js` – Three.js scene, loader, controls, resize handling
- `assets/PUT-YOUR-MODEL-HERE.txt` – reminder to drop `eagle.glb`

## ✋ Notes
- Everything uses **CDN ESM imports**. No bundler required.
- Drag to orbit. Scroll/pinch to zoom. Double‑tap to reframe on the model.
- If you rename the repo later, Pages URL will change. No code changes required.

## 🔧 Customization
- Drop different `.glb/.gltf` files into `assets/` then update the path in `index.html` preload and `js/main.js` loader if you don't keep the `eagle.glb` name.
- Tweak lighting in `js/main.js` (`HemisphereLight`, `DirectionalLight`).

---

© AZR Auto Group
