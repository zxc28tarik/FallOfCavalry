# Release / Export Build

## Node ile tek komut

Repo kökünden çalıştırın:

```bash
node tools/export-build.mjs
```

Bu komut `dist/` klasörünü sıfırdan üretir, sadece release için gerekli dosyaları kopyalar (`index.html`, `css/`, `js/`, `assets/`, varsa favicon), sonra `js/constants.js` içindeki `BUILD_INFO` alanına version + build zamanı damgası basar.

## Node yoksa (Windows PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export-build.ps1
```

Bu yol da `dist/` üretir ve `RELEASE.txt` içine sürüm damgası yazar.

## Tamamen manuel export

Node ve PowerShell yoksa şu dosyaları `dist/` içine kopyalayın:

- `index.html`
- `css/`
- `js/`
- `assets/` (varsa)
- `favicon.*` (varsa)

Ardından `dist/RELEASE.txt` dosyası oluşturup en azından tarih/saat damgası ekleyin.

## Dist'i localde çalıştırma

- VS Code: `dist/index.html` üzerinde **Open with Live Server**
- Python:

```bash
cd dist
python -m http.server 8080
```

Sonra `http://localhost:8080` açın.
