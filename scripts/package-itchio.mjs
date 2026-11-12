/**
 * Script de Empacotamento para o itch.io
 *
 * Gera o arquivo `nota-secreta-itchio.zip` na raiz do projeto contendo todos os
 * arquivos da pasta `dist/` diretamente na raiz do arquivo ZIP (com `index.html` na raiz),
 * garantindo compatibilidade imediata com jogos HTML5 no itch.io.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');
const zipPath = resolve(rootDir, 'nota-secreta-itchio.zip');

if (!existsSync(distDir)) {
  console.error('Erro: A pasta dist/ não existe. Execute "npm run build" antes de gerar o ZIP.');
  process.exit(1);
}

if (existsSync(zipPath)) {
  rmSync(zipPath, { force: true });
}

if (process.platform === 'win32') {
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${distDir}\\*" -DestinationPath "${zipPath}" -Force`,
    ],
    { stdio: 'inherit' }
  );
} else {
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
}

console.log(`ZIP gerado com sucesso em: ${zipPath}`);
