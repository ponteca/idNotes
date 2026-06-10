const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const tempReleaseDir = path.join(os.tmpdir(), 'idnotes-release');
const releaseDir = path.join(rootDir, 'release');
const binExt = process.platform === 'win32' ? '.cmd' : '';
const expoCommand = path.join(rootDir, 'node_modules', '.bin', `expo${binExt}`);
const electronBuilderCommand = path.join(rootDir, 'node_modules', '.bin', `electron-builder${binExt}`);

const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

const run = (command, args) => {
  const commandLine = [quote(command), ...args.map(quote)].join(' ');
  const result = spawnSync(commandLine, {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

fs.rmSync(tempReleaseDir, { recursive: true, force: true });
fs.mkdirSync(tempReleaseDir, { recursive: true });

run(expoCommand, ['export', '--platform', 'web', '--output-dir', 'dist']);
run(electronBuilderCommand, [
  '--win',
  'nsis',
  `--config.directories.output=${tempReleaseDir}`,
]);

fs.mkdirSync(releaseDir, { recursive: true });
fs.rmSync(path.join(releaseDir, 'win-unpacked.tmp'), { recursive: true, force: true });
fs.rmSync(path.join(releaseDir, 'win-unpacked'), { recursive: true, force: true });

for (const fileName of fs.readdirSync(tempReleaseDir)) {
  const source = path.join(tempReleaseDir, fileName);
  const target = path.join(releaseDir, fileName);

  if (
    fs.statSync(source).isFile() &&
    (fileName.endsWith('.exe') || fileName.endsWith('.blockmap') || fileName === 'latest.yml')
  ) {
    fs.copyFileSync(source, target);
  }
}

console.log(`Instalador gerado em: ${releaseDir}`);
