// ======================================================
// STANDALONE REDIS CONSUMER GROUP WORKER FOR AI GRADING
// ======================================================

const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const STREAM = "stream:learning:grading";
const GROUP = "grading-workers";
const CONSUMER = `worker-${process.env.WORKER_ID || "1"}`;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:3000";
const MAX_DELIVERIES = 5;
const CLAIM_IDLE_MS = 60000;
const CLAIM_INTERVAL_MS = 60000;

const deliveryCounts = new Map();

async function processMessage(redis, streamName, messageId, fields) {
  if (!Array.isArray(fields)) return;

  const currentDeliveries = (deliveryCounts.get(messageId) || 0) + 1;
  deliveryCounts.set(messageId, currentDeliveries);

  const fieldMap = {};
  for (let i = 0; i < fields.length; i += 2) {
    fieldMap[fields[i]] = fields[i + 1];
  }

  const eventType = fieldMap["eventType"];
  let payload = {};
  try {
    payload = JSON.parse(fieldMap["payload"] || "{}");
  } catch {
    payload = {};
  }

  console.log(
    `🚀 [Grading Worker] Processing event '${eventType}' (attempt ${currentDeliveries}/${MAX_DELIVERIES}) for message ${messageId}`
  );

  let ok = false;

  if (eventType === "GRADING_REQUESTED" && payload.submissionId) {
    try {
      const res = await fetch(`${APP_URL}/api/exam/grade-async`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": process.env.INTERNAL_API_TOKEN || "",
        },
        body: JSON.stringify({ submissionId: payload.submissionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        ok = true;
        console.log(`✅ [Grading Worker] Submission ${payload.submissionId} graded:`, json);
      } else {
        console.error(
          `⚠️ [Grading Worker] Grading failed for ${payload.submissionId} (status ${res.status}):`,
          json
        );
      }
    } catch (gradingErr) {
      console.error(
        `❌ [Grading Worker] Grading trigger error for ${payload.submissionId}:`,
        gradingErr
      );
    }
  } else if (eventType === "LESSON_GRADING_REQUESTED" && payload.attemptId) {
    try {
      const res = await fetch(`${APP_URL}/api/lessons/grade-async`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": process.env.INTERNAL_API_TOKEN || "",
        },
        body: JSON.stringify({ attemptId: payload.attemptId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        ok = true;
        console.log(`✅ [Grading Worker] Attempt ${payload.attemptId} graded:`, json);
      } else {
        console.error(
          `⚠️ [Grading Worker] Lesson grading failed for ${payload.attemptId} (status ${res.status}):`,
          json
        );
      }
    } catch (gradingErr) {
      console.error(
        `❌ [Grading Worker] Grading trigger error for ${payload.attemptId}:`,
        gradingErr
      );
    }
  } else {
    // Sự kiện không hợp lệ: xác nhận để không kẹt hàng đợi
    ok = true;
  }

  if (ok) {
    await redis.xack(streamName, GROUP, messageId);
    deliveryCounts.delete(messageId);
  } else if (currentDeliveries >= MAX_DELIVERIES) {
    console.error(
      `❌ [Grading Worker] Message ${messageId} exceeded MAX_DELIVERIES (${MAX_DELIVERIES}); XACK to prevent infinite loop.`
    );
    await redis.xack(streamName, GROUP, messageId);
    deliveryCounts.delete(messageId);
  }
}

async function reclaimStuckMessages(redis) {
  try {
    const claimed = await redis.xautoclaim(
      STREAM,
      GROUP,
      CONSUMER,
      CLAIM_IDLE_MS,
      "0-0",
      "COUNT",
      10
    );
    const messages = Array.isArray(claimed) && Array.isArray(claimed[1]) ? claimed[1] : [];
    for (const entry of messages) {
      if (Array.isArray(entry) && entry[0] && Array.isArray(entry[1])) {
        await processMessage(redis, STREAM, entry[0], entry[1]);
      }
    }
  } catch (claimErr) {
    console.warn("[Grading Worker] XAUTOCLAIM warning:", claimErr.message || claimErr);
  }
}

async function main() {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  console.log(`⚡ [Grading Worker] Connecting to Redis at ${REDIS_URL}...`);

  // 1. Create Consumer Group if it does not exist
  try {
    await redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
    console.log(`⚡ [Grading Worker] Consumer group '${GROUP}' created on stream '${STREAM}'.`);
  } catch (err) {
    if (err.message && err.message.includes("BUSYGROUP")) {
      console.log(`⚡ [Grading Worker] Consumer group '${GROUP}' already exists.`);
    } else {
      console.warn(`[Grading Worker] Group creation warning:`, err.message);
    }
  }

  console.log(`⚡ [Grading Worker] Listening for GRADING_REQUESTED events as '${CONSUMER}'...`);

  let lastClaimAt = 0;

  // 2. Continuous Consumer Loop
  while (true) {
    try {
      const now = Date.now();
      if (now - lastClaimAt >= CLAIM_INTERVAL_MS) {
        lastClaimAt = now;
        await reclaimStuckMessages(redis);
      }

      const response = await redis.xreadgroup(
        "GROUP",
        GROUP,
        CONSUMER,
        "BLOCK",
        5000,
        "COUNT",
        1,
        "STREAMS",
        STREAM,
        ">"
      );

      if (!response || response.length === 0) continue;

      for (const [streamName, messages] of response) {
        for (const [messageId, fields] of messages) {
          await processMessage(redis, streamName, messageId, fields);
        }
      }
    } catch (loopErr) {
      console.error("[Grading Worker] Loop error:", loopErr.message);
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
