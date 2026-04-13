# Build LastLeg iOS on your Mac

**daysweeper-main** has no Xcode project (Next.js only). The iOS app lives in **`rb-lastleg-ios`** on your machine.

**Pin status + API contract (LastLeg ↔ Daysweeper):** this page is Xcode/build only. For **`route_outcome`**, **`StopOutcome`**, PATCH/GET, and drift troubleshooting, use **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`** and **`docs/LASTLEG_DAYSWEEPER_STATUS_THREAD.md`** in **this repo** (**daysweeper-main** is canonical for API wording at those paths; rb-lastleg-ios may mirror a short summary).

---

## 1. Fix “Command Line Tools” vs full Xcode

If you see:

```text
xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance
```

**Install Xcode** from the Mac App Store (not only “Command Line Tools”).

Then point the active developer directory at Xcode **once**:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Accept the Xcode license if prompted:

```bash
sudo xcodebuild -license accept
```

Open Xcode once and let it **install additional components** if it asks.

---

## 2. List schemes (confirm the scheme name)

```bash
cd /Users/kyle/Desktop/rb-lastleg-ios
xcodebuild -list -project LastLeg.xcodeproj
```

Note the **scheme** under “Schemes:” (often `LastLeg`).

---

## 3. Build for the simulator (CLI)

Replace **`iPhone 16`** with a simulator you have (`xcrun simctl list devices available`).

```bash
cd /Users/kyle/Desktop/rb-lastleg-ios
xcodebuild \
  -scheme LastLeg \
  -project LastLeg.xcodeproj \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -configuration Debug \
  build
```

If the scheme name differs, use what `-list` showed.

---

## 4. Or build in Xcode (GUI)

1. Double-click **`LastLeg.xcodeproj`** (or **File → Open** in Xcode).
2. Pick a **simulator** or **device** in the toolbar.
3. **⌘B** — Build  
4. **⌘R** — Run

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Wrong simulator name | `xcrun simctl list devices available` and copy an exact name. |
| Signing / provisioning | Xcode → target → **Signing & Capabilities**; select your Team. |
| Still uses CLT | Re-run `xcode-select -s /Applications/Xcode.app/Contents/Developer` and confirm with `xcode-select -p` (should end in `Xcode.app/Contents/Developer`). |

---

## Repo locations

| Project | Path (typical) |
|---------|----------------|
| Daysweeper (web) | `~/Desktop/daysweeper-main` |
| LastLeg (iOS) | `~/Desktop/rb-lastleg-ios` |
