import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import mime from 'mime';

const app = express();
const progressFileName = 'progress.json';
const bannerFileBaseName = 'history-course-banner';
const allowedBannerExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
]);
const automaticBannerPriorityNames = [
  'banner',
  'cover',
  'capa',
  'thumb',
  'thumbnail',
  'wallpaper',
  'background',
  'folder',
];

app.use(
  cors({
    origin: [
      'http://localhost:4048',
      'http://localhost:4058',
      'http://localhost:4200',
    ],
  })
);
app.use(express.json({ limit: '25mb' }));

const videoExtensions = [
  '.mp4',
  '.avi',
  '.mkv',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
];

type TreeNode = {
  name: string;
  path: string;
  type: 'directory' | 'video';
  children?: TreeNode[];
};

type VideoProgress = {
  watched?: boolean;
  currentTime?: number;
  lastWatched?: boolean;
  completedAt?: string | null;
  watchCount?: number;
};

type CourseProgress = {
  bannerImage: string | null;
  history: Record<string, VideoProgress>;
};

function isVideoFile(fileName: string): boolean {
  return videoExtensions.includes(path.extname(fileName).toLowerCase());
}

function naturalSort(left: string, right: string): number {
  const alphanumericRegex = /\d+/g;
  const leftNumbers = left.match(alphanumericRegex)
    ? left.match(alphanumericRegex)!.map(Number)
    : [];
  const rightNumbers = right.match(alphanumericRegex)
    ? right.match(alphanumericRegex)!.map(Number)
    : [];

  for (let index = 0; index < Math.min(leftNumbers.length, rightNumbers.length); index++) {
    if (leftNumbers[index] < rightNumbers[index]) {
      return -1;
    }

    if (leftNumbers[index] > rightNumbers[index]) {
      return 1;
    }
  }

  return left.localeCompare(right);
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeVideoProgress(value: unknown): VideoProgress {
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
    watched: progress.watched === true,
    lastWatched: progress.lastWatched === true,
    currentTime:
      typeof progress.currentTime === 'number' &&
      Number.isFinite(progress.currentTime)
        ? progress.currentTime
        : 0,
    completedAt:
      typeof progress.completedAt === 'string' &&
      progress.completedAt.trim().length > 0
        ? progress.completedAt
        : null,
    watchCount:
      typeof progress.watchCount === 'number' &&
      Number.isFinite(progress.watchCount)
        ? progress.watchCount
        : 0,
  };
}

function normalizeHistory(value: unknown): CourseProgress['history'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, progress]) => [
      key,
      normalizeVideoProgress(progress),
    ])
  );
}

function normalizeCourseProgress(value: unknown): CourseProgress {
  let parsed = value;

  if (typeof parsed === 'string') {
    parsed = safeJsonParse(parsed);

    if (typeof parsed === 'string') {
      parsed = safeJsonParse(parsed);
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
        typeof candidate.bannerImage === 'string' && candidate.bannerImage.trim().length > 0
          ? candidate.bannerImage
          : null,
      history: normalizeHistory(candidate.history),
    };
  }

  return {
    bannerImage: null,
    history: normalizeHistory(candidate),
  };
}

function getProgressFilePath(coursePath: string): string {
  return path.join(coursePath, progressFileName);
}

function readCourseProgressFile(coursePath: string): CourseProgress {
  const progressFilePath = getProgressFilePath(coursePath);

  if (!fs.existsSync(progressFilePath)) {
    return {
      bannerImage: null,
      history: {},
    };
  }

  const raw = fs.readFileSync(progressFilePath, 'utf-8').trim();

  if (!raw) {
    return {
      bannerImage: null,
      history: {},
    };
  }

  return normalizeCourseProgress(raw);
}

function writeCourseProgressFile(coursePath: string, progress: CourseProgress): void {
  fs.writeFileSync(
    getProgressFilePath(coursePath),
    JSON.stringify(progress, null, 2),
    'utf-8'
  );
}

function isPathInside(targetPath: string, parentPath: string): boolean {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(targetPath));
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveBannerPath(coursePath: string, bannerImage: string): string | null {
  const bannerPath = path.resolve(coursePath, bannerImage);

  if (!isPathInside(bannerPath, coursePath)) {
    return null;
  }

  return bannerPath;
}

function getBannerFileName(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const safeExtension = allowedBannerExtensions.has(extension) ? extension : '.png';
  return `${bannerFileBaseName}${safeExtension}`;
}

function findAutomaticBanner(coursePath: string): string | null {
  const candidates = fs
    .readdirSync(coursePath)
    .filter((entry) => {
      const fullPath = path.join(coursePath, entry);

      return (
        fs.statSync(fullPath).isFile() &&
        allowedBannerExtensions.has(path.extname(entry).toLowerCase())
      );
    })
    .sort((left, right) => {
      const leftLower = left.toLowerCase();
      const rightLower = right.toLowerCase();
      const leftIndex = automaticBannerPriorityNames.findIndex((name) =>
        leftLower.includes(name)
      );
      const rightIndex = automaticBannerPriorityNames.findIndex((name) =>
        rightLower.includes(name)
      );
      const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const safeRight =
        rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

      if (safeLeft !== safeRight) {
        return safeLeft - safeRight;
      }

      return left.localeCompare(right);
    });

  return candidates[0] ?? null;
}

function removeExistingBannerFiles(coursePath: string, keepFileName: string | null = null): void {
  for (const entry of fs.readdirSync(coursePath)) {
    if (!entry.startsWith(`${bannerFileBaseName}.`)) {
      continue;
    }

    if (keepFileName && entry === keepFileName) {
      continue;
    }

    const filePath = path.join(coursePath, entry);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    }
  }
}

function ensureExistingDirectory(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function getCourseProgressWithAutomaticBanner(
  coursePath: string
): CourseProgress {
  const progress = readCourseProgressFile(coursePath);
  const currentBannerPath =
    progress.bannerImage && resolveBannerPath(coursePath, progress.bannerImage);

  if (currentBannerPath && fs.existsSync(currentBannerPath)) {
    return progress;
  }

  const automaticBanner = findAutomaticBanner(coursePath);

  if (!automaticBanner) {
    if (progress.bannerImage === null) {
      return progress;
    }

    const updatedProgress = {
      ...progress,
      bannerImage: null,
    };
    writeCourseProgressFile(coursePath, updatedProgress);
    return updatedProgress;
  }

  if (progress.bannerImage === automaticBanner) {
    return progress;
  }

  const updatedProgress = {
    ...progress,
    bannerImage: automaticBanner,
  };
  writeCourseProgressFile(coursePath, updatedProgress);
  return updatedProgress;
}

function readDirectoryTree(
  dirPath: string,
  maxDepth: number,
  currentDepth = 0
): TreeNode | null {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    return null;
  }

  const tree: TreeNode = {
    name: path.basename(dirPath),
    path: dirPath,
    type: 'directory',
    children: [],
  };

  if (currentDepth >= maxDepth) {
    return tree;
  }

  const items = fs.readdirSync(dirPath).sort(naturalSort);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);

    try {
      const itemStats = fs.statSync(fullPath);

      if (itemStats.isDirectory()) {
        const subTree = readDirectoryTree(fullPath, maxDepth, currentDepth + 1);
        if (subTree && subTree.children && subTree.children.length > 0) {
          tree.children!.push(subTree);
        }
      } else if (itemStats.isFile() && isVideoFile(item)) {
        tree.children!.push({
          name: item,
          path: fullPath,
          type: 'video',
        });
      }
    } catch (error) {
      console.warn(`Erro ao acessar ${fullPath}: ${(error as Error).message}`);
    }
  }

  return tree;
}

app.get('/tree', (req, res) => {
  const dir = req.query.dir as string;
  const depth = parseInt(req.query.depth as string, 10) || 10;

  if (!dir) {
    return res.status(400).json({ error: 'Parâmetro "dir" é obrigatório.' });
  }

  if (!ensureExistingDirectory(dir)) {
    return res.status(404).json({ error: 'Diretório não encontrado.' });
  }

  const tree = readDirectoryTree(dir, depth);
  return res.json(tree);
});

app.get('/course-progress', (req, res) => {
  const coursePath = req.query.path as string;

  if (!coursePath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório.' });
  }

  if (!ensureExistingDirectory(coursePath)) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  return res.json(getCourseProgressWithAutomaticBanner(coursePath));
});

app.post('/course-progress', (req, res) => {
  const coursePath = req.body.path as string;
  const progress = normalizeCourseProgress(req.body.progress);

  if (!coursePath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório.' });
  }

  if (!ensureExistingDirectory(coursePath)) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  writeCourseProgressFile(coursePath, progress);
  return res.json(progress);
});

app.post('/course-banner', (req, res) => {
  const coursePath = req.body.path as string;
  const fileName = req.body.fileName as string;
  const content = req.body.content as string;

  if (!coursePath || !fileName || !content) {
    return res.status(400).json({
      error: 'Parâmetros "path", "fileName" e "content" são obrigatórios.',
    });
  }

  if (!ensureExistingDirectory(coursePath)) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  try {
    const bannerFileName = getBannerFileName(fileName);
    const bannerPath = path.join(coursePath, bannerFileName);
    const base64Content = content.includes(',') ? content.split(',').pop() ?? '' : content;

    removeExistingBannerFiles(coursePath, bannerFileName);
    fs.writeFileSync(bannerPath, Buffer.from(base64Content, 'base64'));

    const currentProgress = getCourseProgressWithAutomaticBanner(coursePath);
    const updatedProgress: CourseProgress = {
      ...currentProgress,
      bannerImage: bannerFileName,
    };

    writeCourseProgressFile(coursePath, updatedProgress);
    return res.json(updatedProgress);
  } catch (error) {
    console.error('Erro ao salvar banner do curso:', error);
    return res.status(500).json({ error: 'Erro ao salvar banner do curso.' });
  }
});

app.post('/course-banner/remove', (req, res) => {
  const coursePath = req.body.path as string;

  if (!coursePath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório.' });
  }

  if (!ensureExistingDirectory(coursePath)) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  try {
    removeExistingBannerFiles(coursePath);

    const currentProgress = getCourseProgressWithAutomaticBanner(coursePath);
    const updatedProgress: CourseProgress = {
      ...currentProgress,
      bannerImage: null,
    };

    writeCourseProgressFile(coursePath, updatedProgress);
    return res.json(updatedProgress);
  } catch (error) {
    console.error('Erro ao remover banner do curso:', error);
    return res.status(500).json({ error: 'Erro ao remover banner do curso.' });
  }
});

app.get('/course-banner-file', (req, res) => {
  const coursePath = req.query.coursePath as string;
  const banner = req.query.banner as string;

  if (!coursePath || !banner) {
    return res.status(400).json({
      error: 'Parâmetros "coursePath" e "banner" são obrigatórios.',
    });
  }

  const bannerPath = resolveBannerPath(coursePath, banner);

  if (!bannerPath || !fs.existsSync(bannerPath)) {
    return res.status(404).json({ error: 'Banner não encontrado.' });
  }

  const contentType = mime.getType(bannerPath) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  fs.createReadStream(bannerPath).pipe(res);
});

app.get('/video', (req, res) => {
  const videoPath = decodeURIComponent(req.query.path as string);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Vídeo não encontrado');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = mime.getType(videoPath) || 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const chunkSize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });

    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });

    fs.createReadStream(videoPath).pipe(res);
  }
});

app.post('/update-history', (req, res) => {
  const history = req.body.history;
  const coursePath = req.body.path as string;

  if (!history || !coursePath) {
    return res.status(400).json({
      error: 'Parâmetros "history" e "path" são obrigatórios.',
    });
  }

  if (!ensureExistingDirectory(coursePath)) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  const currentProgress = getCourseProgressWithAutomaticBanner(coursePath);
  const updatedProgress: CourseProgress = {
    ...currentProgress,
    history:
      typeof history === 'string'
        ? normalizeCourseProgress(history).history
        : normalizeHistory(history),
  };

  writeCourseProgressFile(coursePath, updatedProgress);
  return res.json(updatedProgress);
});

app.listen(process.env.PORT, () => {
  console.log(`API rodando em http://localhost:${process.env.PORT}`);
});
