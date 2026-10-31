// Kịch bản demo: phát sự kiện giả lặp lại để xem văn phòng chạy khi chưa nối Antigravity.
//   node office/demo.mjs          lặp mãi (Ctrl+C để dừng)
//   node office/demo.mjs --once   chạy một vòng
import { appendEvent } from './events.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = Math.floor(Date.now() / 1000) % 900;

async function round() {
  const a = `TSK-${++n}`;
  const b = `TSK-${++n}`;
  const script = [
    [{ who: 'giamdoc', type: 'assign', to: 'truongphong', text: 'Làm trang thống kê điểm thi' }, 9000],
    [{ who: 'truongphong', type: 'work', text: 'Đọc docs/features/thong-ke.md' }, 2000],
    [{ who: 'truongphong', type: 'work', text: 'Viết test thống kê' }, 2500],
    [{ who: 'truongphong', type: 'assign', to: 'agy1', task: a, text: 'API thống kê điểm' }, 7000],
    [{ who: 'truongphong', type: 'assign', to: 'agy2', task: b, text: 'Biểu đồ điểm theo lớp' }, 7000],
    [{ who: 'agy1', type: 'accept', task: a }, 1500],
    [{ who: 'agy2', type: 'accept', task: b }, 1500],
    [{ who: 'agy1', type: 'work', task: a, text: 'Sửa app/api/stats/route.ts' }, 3000],
    [{ who: 'agy2', type: 'work', task: b, text: 'Viết ScoreChart.tsx' }, 3000],
    [{ who: 'truongphong', type: 'idle' }, 3000],
    [{ who: 'agy1', type: 'work', task: a, text: '$ npm test stats' }, 3500],
    [{ who: 'agy1', type: 'submit', to: 'truongphong', task: a }, 7000],
    [{ who: 'truongphong', type: 'review', task: a }, 3000],
    [{ who: 'truongphong', type: 'reject', to: 'agy1', task: a, text: 'Thiếu kiểm tra quyền giáo viên' }, 7000],
    [{ who: 'agy1', type: 'work', task: a, text: 'Thêm kiểm tra RBAC' }, 3000],
    [{ who: 'agy2', type: 'work', task: b, text: '$ npm run lint' }, 3000],
    [{ who: 'agy2', type: 'submit', to: 'truongphong', task: b }, 7000],
    [{ who: 'truongphong', type: 'review', task: b }, 3000],
    [{ who: 'truongphong', type: 'approve', to: 'agy2', task: b }, 3000],
    [{ who: 'agy2', type: 'idle' }, 2000],
    [{ who: 'agy1', type: 'submit', to: 'truongphong', task: a }, 7000],
    [{ who: 'truongphong', type: 'approve', to: 'agy1', task: a }, 3000],
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
