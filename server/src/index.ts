import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
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


app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
