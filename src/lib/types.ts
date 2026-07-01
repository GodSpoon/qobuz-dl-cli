export type QobuzGenre = {
  path: number[];
  color: string;
  name: string;
  id: number;
};

export type QobuzLabel = {
  name: string;
  id: number;
  albums_count: number;
};

export type QobuzArtist = {
  image: {
    small: string;
    medium: string;
    large: string;
    extralarge: string;
    mega: string;
  } | null;
  name: string;
  id: number;
  albums_count: number;
};

export type QobuzAlbum = {
  maximum_bit_depth: number;
  image: {
    small: string;
    thumbnail: string;
    large: string;
    back: string | null;
  };
  artist: QobuzArtist;
  artists: { id: number; name: string; roles: string[] }[];
  released_at: number;
  label: QobuzLabel;
  title: string;
  qobuz_id: number;
  version: string | null;
  duration: number;
  parental_warning: boolean;
  tracks_count: number;
  genre: QobuzGenre;
  id: string;
  maximum_sampling_rate: number;
  release_date_original: string;
  hires: boolean;
  upc: string;
  streamable: boolean;
};

export type QobuzTrack = {
  isrc: string | null;
  copyright: string;
  maximum_bit_depth: number;
  maximum_sampling_rate: number;
  performer: { name: string; id: number };
  composer?: { name: string; id: number };
  album: QobuzAlbum;
  track_number: number;
  released_at: number;
  title: string;
  version: string | null;
  duration: number;
  parental_warning: boolean;
  id: number;
  hires: boolean;
  streamable: boolean;
  media_number: number;
};

export type FetchedQobuzAlbum = QobuzAlbum & {
  tracks: {
    offset: number;
    limit: number;
    total: number;
    items: QobuzTrack[];
  };
};

export type QobuzSearchResults = {
  query: string;
  switchTo: QobuzSearchFilters | null;
  albums: { limit: number; offset: number; total: number; items: QobuzAlbum[] };
  tracks: { limit: number; offset: number; total: number; items: QobuzTrack[] };
  artists: { limit: number; offset: number; total: number; items: QobuzArtist[] };
};

export type QobuzSearchFilters = 'albums' | 'tracks' | 'artists';

export type Quality = '27' | '7' | '6' | '5';
export type OutputCodec = 'FLAC' | 'WAV' | 'ALAC' | 'MP3' | 'AAC' | 'OPUS';

export type Config = {
  appId: string;
  secret: string;
  tokens: string[];
  country?: string;
  quality: Quality;
  codec: OutputCodec;
  bitrate?: number;
  applyMetadata: boolean;
  fixMD5: boolean;
  albumArtSize: number;
  albumArtQuality: number;
  trackTemplate: string;
  albumTemplate: string;
  outDir: string;
  socks5Proxy?: string;
  corsProxy?: string;
};

export type ApiOptions = {
  country?: string;
};
