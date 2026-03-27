# PWA Barcode & QR Scanner Research

This document outlines the current state, limitations, and potential future improvements for the Barcode/QR scanning functionality within this Progressive Web App (PWA). You can provide this file to ChatGPT or any other AI assistant to help brainstorm further improvements.

## 1. Current Implementation (`html5-qrcode`)

Currently, the app uses the [html5-qrcode](https://github.com/mebjas/html5-qrcode) library to provide a live video scanning experience. 

### Why we use `Html5QrcodeScanner`:
- **Live Feed:** It hooks into `navigator.mediaDevices.getUserMedia()` to stream live video directly to an HTML `<video>` element.
- **Cross-Platform:** It works on both iOS Safari and Android Chrome without native app compilation.
- **Camera Selection:** It provides a built-in UI for selecting which camera lens to use, which is critical for multi-lens phones (like iPhones).

### Recent Improvements Made:
1. **Removed `qrbox` cropping:** By scanning the *entire* video frame instead of a tiny cropped box, 1D barcodes (which are long) are much easier to catch.
2. **Increased FPS:** Bumped from `10` to `30` frames per second to reduce motion blur and increase the likelihood of grabbing a perfectly sharp frame.
3. **`useBarCodeDetectorIfSupported: true`:** Added this flag to seamlessly utilize the native OS-level hardware scanner if the browser supports it (drastically faster and more accurate than JavaScript-based scanning).

## 2. Known Limitations & Frustrations

### The "Wrong Lens / Blurry" Problem (iOS Specific)
When using the native iPhone Camera app, Apple's software automatically switches from the Wide lens to the Ultra-Wide (Macro) lens when you hold the phone close to an object (like a barcode). 

**Web browsers cannot do this.** The `getUserMedia()` API forces the web app to select exactly *one* physical lens. If it defaults to the Wide lens, getting close to a barcode will make it permanently blurry. 
- **Workaround used:** The scanner UI allows the user to manually select a different camera from the dropdown (e.g., "Back Camera 2"). The app remembers this choice (`rememberLastUsedCamera: true`).
- **User Advice:** Users should be advised to hold the phone slightly further away (6-8 inches) rather than right up against the package.

### JavaScript Parsing Overhead
By default, `html5-qrcode` relies on a JavaScript port of ZXing to decode barcodes. This requires significant CPU power and is highly sensitive to blur, glare, and low light compared to native apps.

## 3. Future Research & Alternative Paths

If the current implementation is still not smooth enough, here are the technical paths to explore:

### Path A: The Native Web `BarcodeDetector` API
The [Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API) is a modern Web API that offloads scanning to the phone's native hardware scanner (e.g., Apple's Vision framework or Google Play Services). It is incredibly fast and highly resilient to blur.
- **Status:** Supported natively on Android Chrome. On iOS, it is hidden behind an experimental flag.
- **How to test on iOS:** Go to `Settings > Safari > Advanced > Feature Flags > Shape Detection API` and turn it ON. If enabled, `html5-qrcode` will automatically use it thanks to the `useBarCodeDetectorIfSupported: true` flag we added.

### Path B: The "Take a Photo" Fallback (File Input)
Instead of a live video feed, you use `<input type="file" accept="image/*" capture="environment">`. This instantly opens the phone's native camera app. 
- **Pros:** Perfect auto-focus, auto-lens switching, and high-resolution images.
- **Cons:** Slower UX (user has to click "Take Photo" and then "Use Photo" for every item). We built this previously but reverted due to UX friction.

### Path C: Wrapping the PWA in a Native Shell (Capacitor / Ionic)
If scanning performance is a dealbreaker, the ultimate solution is to package the web app into a native iOS/Android app using [Capacitor](https://capacitorjs.com/).
- **Pros:** Grants access to native plugins (like `@capacitor-community/barcode-scanner`), which use the absolute best, fastest native OS scanning overlays.
- **Cons:** Requires publishing to the App Store / Google Play Store, bypassing the pure PWA web-only deployment.

---
*Generated for context and future development.*