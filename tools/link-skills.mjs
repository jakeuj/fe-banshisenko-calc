// 讓 Claude Code 讀到 .agents/skills/ 裡的專案技能。
// Claude Code 只從 .claude/skills/ 載入技能，所以在那裡建立一個指向 .agents/skills/ 的連結
// （Windows 用 junction，不需要系統管理員或開發人員模式；其他系統用 symlink）。
// .claude/ 已被 gitignore，連結只存在本機；clone 之後執行一次：node tools/link-skills.mjs
import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.agents', 'skills');
const link = join(root, '.claude', 'skills');

if (!existsSync(target)) {
  console.error('找不到 .agents/skills/');
  process.exit(1);
}

let stat = null;
try {
  stat = lstatSync(link);
} catch {
  /* 不存在 */
}

if (stat) {
  if (stat.isSymbolicLink()) {
    let ok = false;
    try {
      ok = realpathSync(link) === realpathSync(target);
    } catch {
      /* 連結失效 */
    }
    if (ok) {
      console.log('已設定：.claude/skills → .agents/skills');
      process.exit(0);
    }
    console.error(`.claude/skills 已是連結但指向其他位置（${readlinkSync(link)}），請先手動移除再執行。`);
  } else {
    console.error('.claude/skills 已存在且是一般資料夾，為避免覆蓋其中的技能，請先手動處理再執行。');
  }
  process.exit(1);
}

mkdirSync(dirname(link), { recursive: true });
// junction 需要絕對路徑；symlink 用相對路徑，搬動 repo 也不會壞
if (process.platform === 'win32') symlinkSync(target, link, 'junction');
else symlinkSync(join('..', '.agents', 'skills'), link, 'dir');
console.log('已建立：.claude/skills → .agents/skills');
