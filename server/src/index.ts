import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import mime from 'mime';

const app = express();
app.use(cors({
  origin: 'http://localhost:4200'
}));

const port = 3000;

const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];

type TreeNode = {
  name: string;
  path: string;
  type: 'directory' | 'video';
  children?: TreeNode[];
};

function isVideoFile(fileName: string): boolean {
  return videoExtensions.includes(path.extname(fileName).toLowerCase());
}

function readDirectoryTree(
  dirPath: string,
  maxDepth: number,
  currentDepth = 0
): TreeNode | null {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) return null;

  const tree: TreeNode = {
    name: path.basename(dirPath),
    path: dirPath,
    type: 'directory',
    children: [],
  };

  if (currentDepth >= maxDepth) {
    return tree;
  }

  const items = fs.readdirSync(dirPath);

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
    } catch (err) {
      console.warn(`Erro ao acessar ${fullPath}: ${(err as Error).message}`);
    }
  }

  return tree;
}

app.get('/tree', (req, res) => {
  const dir = req.query.dir as string;
  const depth = parseInt(req.query.depth as string) || 10; // valor padrão é 10

  if (!dir) {
    return res.status(400).json({ error: 'Parâmetro "dir" é obrigatório' });
  }

  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Diretório não encontrado' });
  }

  const tree = readDirectoryTree(dir, depth);
  res.json(tree);
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
      'Content-Type': contentType
    });

    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType
    });

    fs.createReadStream(videoPath).pipe(res);
  }
});




app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
