# qobuz-dl-cli

A standalone command-line interface for Qobuz-DL. Search, inspect, and download music from Qobuz without a browser or a running server.

## Features

- Search albums, tracks, and artists.
- Download individual tracks, full albums, or artist discographies.
- Re-encode to FLAC, WAV, ALAC, MP3, AAC, or OPUS.
- Apply metadata and cover art via local `ffmpeg`.
- JSON output for scripting (`--json`).

## Requirements

- Node.js 20+
- `ffmpeg` installed and available in PATH
- Qobuz `appId`, `secret`, and a valid user auth token

## Installation

```bash
npm install -g qobuz-dl-cli
# or
bun install -g qobuz-dl-cli
```

## Configuration

Run interactive setup:

```bash
qobuz-dl config init
```

Or set environment variables:

```bash
export QOBUZ_DL_APP_ID="..."
export QOBUZ_DL_SECRET="..."
export QOBUZ_DL_TOKENS='["..."]'
export QOBUZ_DL_COUNTRY="US"
```

## Usage

```bash
# Search
qobuz-dl search "Daft Punk" --json

# Download a track
qobuz-dl track https://open.qobuz.com/track/12345678 --codec MP3 --bitrate 320

# Download an album
qobuz-dl album https://open.qobuz.com/album/0886445187901 --download

# Download an album as a zip
qobuz-dl album https://open.qobuz.com/album/0886445187901 --download --zip

# Download a discography
qobuz-dl discography https://open.qobuz.com/artist/31234 --out-dir ~/Music
```

## Development

```bash
npm install
npm run build
npm run dev -- search "Daft Punk" --json
```

## License

MIT
