import express from 'express';
import fs from 'fs';
import type { Dirent } from 'fs';
import path from 'path';
import cors from 'cors';
import mime from 'mime';

const fsp = fs.promises;
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
      // Electron em produção carrega o front via file:// (origem "null")
      'null',
      'file://',
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

type CourseStatus = 'in-progress' | 'completed' | 'abandoned';

type CourseProgress = {
  bannerImage: string | null;
  totalVideos: number;
  courseStatus: CourseStatus;
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

function normalizeCourseStatus(value: unknown): CourseStatus {
  return value === 'completed' || value === 'abandoned'
    ? value
    : 'in-progress';
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
      totalVideos: 0,
      courseStatus: 'in-progress',
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
      totalVideos:
        typeof candidate.totalVideos === 'number' &&
        Number.isFinite(candidate.totalVideos) &&
        candidate.totalVideos >= 0
          ? candidate.totalVideos
          : 0,
      courseStatus: normalizeCourseStatus(candidate.courseStatus),
      history: normalizeHistory(candidate.history),
    };
  }

  return {
    bannerImage: null,
    totalVideos: 0,
    courseStatus: 'in-progress',
    history: normalizeHistory(candidate),
  };
}

function getProgressFilePath(coursePath: string): string {
  return path.join(coursePath, progressFileName);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function emptyCourseProgress(): CourseProgress {
  return {
    bannerImage: null,
    totalVideos: 0,
    courseStatus: 'in-progress',
    history: {},
  };
}

async function readCourseProgressFile(coursePath: string): Promise<CourseProgress> {
  let raw: string;

  try {
    raw = (await fsp.readFile(getProgressFilePath(coursePath), 'utf-8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyCourseProgress();
    }
    throw error;
  }

  if (!raw) {
    return emptyCourseProgress();
  }

  return normalizeCourseProgress(raw);
}

const progressBackupMinIntervalMs = 5 * 60 * 1000;

// Serializa gravacoes por curso: com I/O assincrono, duas gravacoes simultaneas
// no mesmo arquivo temporario poderiam se sobrepor.
const progressWriteQueues = new Map<string, Promise<unknown>>();

function writeCourseProgressFile(
  coursePath: string,
  progress: CourseProgress
): Promise<void> {
  const previous = progressWriteQueues.get(coursePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => writeCourseProgressFileNow(coursePath, progress));

  progressWriteQueues.set(coursePath, next);
  const cleanup = () => {
    if (progressWriteQueues.get(coursePath) === next) {
      progressWriteQueues.delete(coursePath);
    }
  };
  next.then(cleanup, cleanup);

  return next;
}

async function writeCourseProgressFileNow(
  coursePath: string,
  progress: CourseProgress
): Promise<void> {
  const filePath = getProgressFilePath(coursePath);
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  if (await pathExists(filePath)) {
    let existing: CourseProgress | null = null;

    try {
      existing = await readCourseProgressFile(coursePath);
    } catch {
      // arquivo ilegivel: segue sem comparar
    }

    if (existing && Object.keys(existing.history).length > 0) {
      // Nunca troca um historico existente por um vazio (ex.: localStorage perdido apos crash).
      if (Object.keys(progress.history).length === 0) {
        progress = { ...progress, history: existing.history };
      }

      // Backup espacado para nao castigar o disco a cada salvamento.
      let backupAge = Infinity;
      try {
        backupAge = Date.now() - (await fsp.stat(backupPath)).mtimeMs;
      } catch {
        // sem backup anterior
      }

      if (backupAge >= progressBackupMinIntervalMs) {
        try {
          await fsp.copyFile(filePath, backupPath);
        } catch {
          // backup e best-effort
        }
      }
    }
  }

  // Escrita atomica: grava em arquivo temporario e renomeia.
  await fsp.writeFile(tempPath, JSON.stringify(progress, null, 2), 'utf-8');
  await fsp.rename(tempPath, filePath);
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

// Dirent evita um stat por arquivo; links simbolicos sao resolvidos sob demanda.
async function direntIsFile(entry: Dirent, fullPath: string): Promise<boolean> {
  if (entry.isFile()) {
    return true;
  }

  if (entry.isSymbolicLink()) {
    try {
      return (await fsp.stat(fullPath)).isFile();
    } catch {
      return false;
    }
  }

  return false;
}

async function direntIsDirectory(
  entry: Dirent,
  fullPath: string
): Promise<boolean> {
  if (entry.isDirectory()) {
    return true;
  }

  if (entry.isSymbolicLink()) {
    try {
      return (await fsp.stat(fullPath)).isDirectory();
    } catch {
      return false;
    }
  }

  return false;
}

async function findAutomaticBanner(coursePath: string): Promise<string | null> {
  const entries = await fsp.readdir(coursePath, { withFileTypes: true });
  const candidates: string[] = [];

  for (const entry of entries) {
    if (
      allowedBannerExtensions.has(path.extname(entry.name).toLowerCase()) &&
      (await direntIsFile(entry, path.join(coursePath, entry.name)))
    ) {
      candidates.push(entry.name);
    }
  }

  candidates.sort((left, right) => {
    const leftLower = left.toLowerCase();
    const rightLower = right.toLowerCase();
    const leftIndex = automaticBannerPriorityNames.findIndex((name) =>
      leftLower.includes(name)
    );
    const rightIndex = automaticBannerPriorityNames.findIndex((name) =>
      rightLower.includes(name)
    );
    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }

    return left.localeCompare(right);
  });

  return candidates[0] ?? null;
}

async function removeExistingBannerFiles(
  coursePath: string,
  keepFileName: string | null = null
): Promise<void> {
  for (const entry of await fsp.readdir(coursePath)) {
    if (!entry.startsWith(`${bannerFileBaseName}.`)) {
      continue;
    }

    if (keepFileName && entry === keepFileName) {
      continue;
    }

    const filePath = path.join(coursePath, entry);

    try {
      if ((await fsp.stat(filePath)).isFile()) {
        await fsp.unlink(filePath);
      }
    } catch {
      // arquivo removido entre a listagem e a exclusao
    }
  }
}

async function ensureExistingDirectory(dirPath: string): Promise<boolean> {
  try {
    return (await fsp.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

async function countVideoFiles(
  dirPath: string,
  maxDepth = 10,
  currentDepth = 0
): Promise<number> {
  if (currentDepth > maxDepth) {
    return 0;
  }

  let totalVideos = 0;

  for (const entry of await fsp.readdir(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);

    try {
      if (await direntIsDirectory(entry, fullPath)) {
        totalVideos += await countVideoFiles(fullPath, maxDepth, currentDepth + 1);
      } else if (isVideoFile(entry.name) && (await direntIsFile(entry, fullPath))) {
        totalVideos++;
      }
    } catch (error) {
      console.warn(`Erro ao contar videos em ${fullPath}: ${(error as Error).message}`);
    }
  }

  return totalVideos;
}

async function getCourseProgressWithAutomaticBanner(
  coursePath: string
): Promise<CourseProgress> {
  const [storedProgress, totalVideos] = await Promise.all([
    readCourseProgressFile(coursePath),
    countVideoFiles(coursePath),
  ]);
  const progress = { ...storedProgress, totalVideos };
  const currentBannerPath =
    progress.bannerImage && resolveBannerPath(coursePath, progress.bannerImage);

  if (currentBannerPath && (await pathExists(currentBannerPath))) {
    return progress;
  }

  const automaticBanner = await findAutomaticBanner(coursePath);

  if (!automaticBanner) {
    if (progress.bannerImage === null) {
      return progress;
    }

    const updatedProgress = {
      ...progress,
      bannerImage: null,
    };
    await writeCourseProgressFile(coursePath, updatedProgress);
    return updatedProgress;
  }

  if (progress.bannerImage === automaticBanner) {
    return progress;
  }

  const updatedProgress = {
    ...progress,
    bannerImage: automaticBanner,
  };
  await writeCourseProgressFile(coursePath, updatedProgress);
  return updatedProgress;
}

async function readDirectoryTree(
  dirPath: string,
  maxDepth: number,
  currentDepth = 0
): Promise<TreeNode> {
  const tree: TreeNode = {
    name: path.basename(dirPath),
    path: dirPath,
    type: 'directory',
    children: [],
  };

  if (currentDepth >= maxDepth) {
    return tree;
  }

  const entries = (await fsp.readdir(dirPath, { withFileTypes: true })).sort(
    (left, right) => naturalSort(left.name, right.name)
  );

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    try {
      if (await direntIsDirectory(entry, fullPath)) {
        const subTree = await readDirectoryTree(fullPath, maxDepth, currentDepth + 1);
        if (subTree.children && subTree.children.length > 0) {
          tree.children!.push(subTree);
        }
      } else if (isVideoFile(entry.name) && (await direntIsFile(entry, fullPath))) {
        tree.children!.push({
          name: entry.name,
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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tree', async (req, res) => {
  const dir = req.query.dir as string;
  const depth = parseInt(req.query.depth as string, 10) || 10;

  if (!dir) {
    return res.status(400).json({ error: 'Parâmetro "dir" é obrigatório.' });
  }

  if (!(await ensureExistingDirectory(dir))) {
    return res.status(404).json({ error: 'Diretório não encontrado.' });
  }

  const tree = await readDirectoryTree(dir, depth);
  return res.json(tree);
});

app.get('/course-progress', async (req, res) => {
  const coursePath = req.query.path as string;

  if (!coursePath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório.' });
  }

  if (!(await ensureExistingDirectory(coursePath))) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  return res.json(await getCourseProgressWithAutomaticBanner(coursePath));
});

app.post('/course-progress', async (req, res) => {
  const coursePath = req.body.path as string;
  const progress = normalizeCourseProgress(req.body.progress);

  if (!coursePath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório.' });
  }

  if (!(await ensureExistingDirectory(coursePath))) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  await writeCourseProgressFile(coursePath, progress);
  return res.json(progress);
});

app.post('/course-banner', async (req, res) => {
  const coursePath = req.body.path as string;
  const fileName = req.body.fileName as string;
  const content = req.body.content as string;

  if (!coursePath || !fileName || !content) {
    return res.status(400).json({
      error: 'Parâmetros "path", "fileName" e "content" são obrigatórios.',
    });
  }

  if (!(await ensureExistingDirectory(coursePath))) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  try {
    const bannerFileName = getBannerFileName(fileName);
    const bannerPath = path.join(coursePath, bannerFileName);
    const base64Content = content.includes(',') ? content.split(',').pop() ?? '' : content;

    await removeExistingBannerFiles(coursePath, bannerFileName);
    await fsp.writeFile(bannerPath, Buffer.from(base64Content, 'base64'));

    const currentProgress = await getCourseProgressWithAutomaticBanner(coursePath);
    const updatedProgress: CourseProgress = {
      ...currentProgress,
      bannerImage: bannerFileName,
    };

    await writeCourseProgressFile(coursePath, updatedProgress);
    return res.json(updatedProgress);
  } catch (error) {
    console.error('Erro ao salvar banner do curso:', error);
    return res.status(500).json({ error: 'Erro ao salvar banner do curso.' });
  }
});

app.post('/course-banner/remove', async (req, res) => {
  const coursePath = req.body.path as string;

  if (!coursePath) {
    return res.status(400).json({ error: 'Parâmetro "path" é obrigatório.' });
  }

  if (!(await ensureExistingDirectory(coursePath))) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  try {
    await removeExistingBannerFiles(coursePath);

    const currentProgress = await getCourseProgressWithAutomaticBanner(coursePath);
    const updatedProgress: CourseProgress = {
      ...currentProgress,
      bannerImage: null,
    };

    await writeCourseProgressFile(coursePath, updatedProgress);
    return res.json(updatedProgress);
  } catch (error) {
    console.error('Erro ao remover banner do curso:', error);
    return res.status(500).json({ error: 'Erro ao remover banner do curso.' });
  }
});

function streamFile(stream: fs.ReadStream, res: express.Response) {
  const cleanup = () => stream.destroy();
  res.on('close', cleanup);
  stream.on('error', () => {
    cleanup();
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

app.get('/course-banner-file', async (req, res) => {
  const coursePath = req.query.coursePath as string;
  const banner = req.query.banner as string;

  if (!coursePath || !banner) {
    return res.status(400).json({
      error: 'Parâmetros "coursePath" e "banner" são obrigatórios.',
    });
  }

  const bannerPath = resolveBannerPath(coursePath, banner);

  if (!bannerPath || !(await pathExists(bannerPath))) {
    return res.status(404).json({ error: 'Banner não encontrado.' });
  }

  const contentType = mime.getType(bannerPath) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  streamFile(fs.createReadStream(bannerPath), res);
});

app.get('/video', async (req, res) => {
  const videoPath = decodeURIComponent(req.query.path as string);

  let stat: fs.Stats;

  try {
    stat = await fsp.stat(videoPath);
  } catch {
    return res.status(404).send('Vídeo não encontrado');
  }

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

    streamFile(file, res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });

    streamFile(fs.createReadStream(videoPath), res);
  }
});

app.post('/update-history', async (req, res) => {
  const history = req.body.history;
  const coursePath = req.body.path as string;

  if (!history || !coursePath) {
    return res.status(400).json({
      error: 'Parâmetros "history" e "path" são obrigatórios.',
    });
  }

  if (!(await ensureExistingDirectory(coursePath))) {
    return res.status(404).json({ error: 'Pasta do curso não encontrada.' });
  }

  const currentProgress = await getCourseProgressWithAutomaticBanner(coursePath);
  const updatedProgress: CourseProgress = {
    ...currentProgress,
    history:
      typeof history === 'string'
        ? normalizeCourseProgress(history).history
        : normalizeHistory(history),
  };

  await writeCourseProgressFile(coursePath, updatedProgress);
  return res.json(updatedProgress);
});

// Quando roda como utilityProcess do Electron, avisa o processo principal.
const parentPort = (
  process as unknown as {
    parentPort?: { postMessage(message: unknown): void };
  }
).parentPort;

const server = app.listen(process.env.PORT, () => {
  console.log(`API rodando em http://localhost:${process.env.PORT}`);
  parentPort?.postMessage({ type: 'ready' });
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Porta ${process.env.PORT} já está em uso. Assumindo que a API já está rodando.`
    );
    parentPort?.postMessage({ type: 'ready', reused: true });
    return;
  }
  throw error;
});
