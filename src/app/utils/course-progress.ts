import { environment } from '../../environments/environment';
import { ICourseProgress } from '../domain/interfaces/ICourseProgress';
import { IVideoProgress } from '../domain/interfaces/IVideoProgress';

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeVideoProgress(value: unknown): IVideoProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      watched: false,
      currentTime: 0,
      completedAt: null,
      watchCount: 0,
    };
  }

  const progress = value as Record<string, unknown>;

  return {
    watched: progress['watched'] === true,
    lastWatched: progress['lastWatched'] === true,
    currentTime:
      typeof progress['currentTime'] === 'number' &&
      Number.isFinite(progress['currentTime'])
        ? progress['currentTime']
        : 0,
    completedAt:
      typeof progress['completedAt'] === 'string' &&
      progress['completedAt'].trim().length > 0
        ? progress['completedAt']
        : null,
    watchCount:
      typeof progress['watchCount'] === 'number' &&
      Number.isFinite(progress['watchCount'])
        ? progress['watchCount']
        : 0,
  };
}

function normalizeHistory(value: unknown): ICourseProgress['history'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const history = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(history).map(([key, progress]) => [
      key,
      normalizeVideoProgress(progress),
    ])
  );
}

export function normalizeCourseProgress(raw: unknown): ICourseProgress {
  let parsed = raw;

  if (typeof parsed === 'string') {
    parsed = parseJson(parsed);

    if (typeof parsed === 'string') {
      parsed = parseJson(parsed);
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      bannerImage: null,
      history: {},
    };
  }

  const candidate = parsed as Record<string, unknown>;

  if ('history' in candidate || 'bannerImage' in candidate) {
    return {
      bannerImage:
        typeof candidate['bannerImage'] === 'string' &&
        candidate['bannerImage'].trim().length > 0
          ? candidate['bannerImage']
          : null,
      history: normalizeHistory(candidate['history']),
    };
  }

  return {
    bannerImage: null,
    history: normalizeHistory(candidate),
  };
}

export function serializeCourseProgress(progress: ICourseProgress): string {
  return JSON.stringify({
    bannerImage: progress.bannerImage ?? null,
    history: progress.history ?? {},
  });
}

export function getCourseNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? path;
}

export function buildCourseBannerUrl(
  coursePath: string,
  bannerImage: string | null
): string | null {
  if (!bannerImage) {
    return null;
  }

  const params = new URLSearchParams({
    coursePath,
    banner: bannerImage,
  });

  return `${environment.apiUrl}/course-banner-file?${params.toString()}`;
}
