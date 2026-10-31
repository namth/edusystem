// Kịch bản demo: phát sự kiện giả lặp lại để xem văn phòng chạy khi chưa nối Antigravity.
// Agy 2 được giả như đang kết nối từ một máy khác (tên máy "demo-agy2").
//   node office/demo.mjs          lặp mãi (Ctrl+C để dừng)
//   node office/demo.mjs --once   chạy một vòng
import { appendEvent } from './events.mjs';

const PORT = Number(process.env.OFFICE_PORT || 4317);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = Math.floor(Date.now() / 1000) % 900;

const heartbeat = () =>
  fetch(`http://127.0.0.1:${PORT}/presence`, {
    method: 'POST',
    body: JSON.stringify({ who: 'agy2', host: 'demo-agy2', ip: '192.168.1.50', platform: 'Demo' }),
  }).catch(() => {});
heartbeat();
const beat = setInterval(heartbeat, 15000);

async function round() {
  const a = `TSK-${++n}`;
  const b = `TSK-${++n}`;
  const script = [
    [{ who: 'giamdoc', type: 'assign', to: 'truongphong', text: 'Làm trang thống kê điểm thi' }, 9000],
    [{ who: 'truongphong', type: 'work', text: 'Đọc docs/features/thong-ke.md' }, 2000],
    [{ who: 'truongphong', type: 'work', text: 'Viết test thống kê' }, 2500],
    [{ who: 'truongphong', type: 'assign', to: 'agy1', task: a, text: 'API thống kê điểm' }, 7000],
    [{ who: 'truongphong', type: 'assign', to: 'agy2', task: b, text: 'Biểu đồ điểm theo lớp' }, 11000],
    [{ who: 'agy1', type: 'accept', task: a }, 1500],
    [{ who: 'agy2', type: 'accept', task: b }, 1500],
    [{ who: 'agy1', type: 'work', task: a, text: 'Sửa route.ts' }, 3000],
    [{ who: 'agy2', type: 'work', task: b, text: 'Sửa ScoreChart.tsx' }, 3000],
    [{ who: 'truongphong', type: 'idle' }, 3000],
    [{ who: 'agy1', type: 'work', task: a, text: 'Sửa stats.test.ts' }, 3500],
    [{ who: 'agy1', type: 'submit', to: 'truongphong', task: a }, 3000],
    [{ who: 'truongphong', type: 'review', task: a, text: '$ handoff verify' }, 5000],
    [{ who: 'truongphong', type: 'work', text: '$ npx vitest run stats' }, 3000],
    [{ who: 'truongphong', type: 'work', text: 'Đọc report.md' }, 3000],
    [{ who: 'truongphong', type: 'reject', to: 'agy1', task: a, text: 'Thiếu kiểm tra quyền giáo viên' }, 7000],
    [{ who: 'agy1', type: 'accept', task: a }, 1500],
    [{ who: 'agy1', type: 'work', task: a, text: 'Sửa route.ts' }, 3000],
    [{ who: 'agy2', type: 'work', task: b, text: 'Sửa page.tsx' }, 3000],
    [{ who: 'agy2', type: 'submit', to: 'truongphong', task: b }, 3000],
    [{ who: 'truongphong', type: 'review', task: b, text: '$ handoff verify' }, 9000],
    [{ who: 'truongphong', type: 'work', text: '$ npm run build' }, 3000],
    [{ who: 'truongphong', type: 'approve', to: 'agy2', task: b }, 9000],
    [{ who: 'agy2', type: 'idle' }, 1000],
    [{ who: 'agy1', type: 'submit', to: 'truongphong', task: a }, 3000],
    [{ who: 'truongphong', type: 'review', task: a, text: '$ handoff accept' }, 5000],
    [{ who: 'truongphong', type: 'approve', to: 'agy1', task: a }, 7000],
    [{ who: 'agy1', type: 'idle' }, 1000],
    [{ who: 'truongphong', type: 'wait', text: 'Xin giám đốc duyệt merge' }, 6000],
    [{ who: 'truongphong', type: 'idle' }, 30000],
  ];
  for (const [ev, ms] of script) {
    appendEvent(ev);
    await sleep(ms);
  }
}

do {
  await round();
} while (!process.argv.includes('--once'));
clearInterval(beat);
