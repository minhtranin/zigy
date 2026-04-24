import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

const RELEASES_URL = 'https://github.com/minhtranin/zigy/releases/latest';
const RELEASES_API = 'https://api.github.com/repos/minhtranin/zigy/releases/latest';

export interface UpdateInfo {
  available: boolean;
  latestVersion: string | null;
  releasesUrl: string;
  dmgUrl: string | null;      // macOS: direct DMG download URL
  appImageUrl: string | null; // Linux: direct AppImage download URL
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export function useUpdateCheck(): UpdateInfo {
  const [available, setAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dmgUrl, setDmgUrl] = useState<string | null>(null);
  const [appImageUrl, setAppImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const [current, res] = await Promise.all([
          getVersion(),
          fetch(RELEASES_API),
        ]);
        if (!res.ok) return;
        const data = await res.json();
        const latest = data.tag_name as string;
        if (latest && isNewer(latest, current)) {
          setLatestVersion(latest);
          setAvailable(true);
          const assets: { name: string; browser_download_url: string }[] = data.assets ?? [];
          setDmgUrl(assets.find(a => a.name.endsWith('.dmg'))?.browser_download_url ?? null);
          setAppImageUrl(assets.find(a => a.name.endsWith('.AppImage'))?.browser_download_url ?? null);
        }
      } catch {
        // silently ignore — no network or API error
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  return { available, latestVersion, releasesUrl: RELEASES_URL, dmgUrl, appImageUrl };
}
