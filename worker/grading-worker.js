// ======================================================
// STANDALONE REDIS CONSUMER GROUP WORKER FOR AI GRADING
// ======================================================

const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const STREAM = "stream:learning:grading";
const GROUP = "grading-workers";
const CONSUMER = `worker-${process.env.WORKER_ID || "1"}`;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:3000";

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

  // 2. Continuous Consumer Loop
  while (true) {
    try {
      const response = await redis.xreadgroup(
        "GROUP", GROUP, CONSUMER,
        "BLOCK", 5000,
        "COUNT", 1,
        "STREAMS", STREAM, ">"
      );

      if (!response || response.length === 0) continue;

      for (const [streamName, messages] of response) {
        for (const [messageId, fields] of messages) {
          const fieldMap = {};
          for (let i = 0; i < fields.length; i += 2) {
            fieldMap[fields[i]] = fields[i + 1];
          }

          const eventType = fieldMap["eventType"];
          const payload = JSON.parse(fieldMap["payload"] || "{}");

          console.log(`🚀 [Grading Worker] Processing event '${eventType}' for submission: ${payload.submissionId}`);

          if (eventType === "GRADING_REQUESTED" && payload.submissionId) {
            // Trigger internal grade-async API endpoint
            try {
              const res = await fetch(`${APP_URL}/api/exam/grade-async`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-token": process.env.INTERNAL_API_TOKEN || "",
                },
                body: JSON.stringify({ submissionId: payload.submissionId }),
              });
              const json = await res.json();
              console.log(`✅ [Grading Worker] Submission ${payload.submissionId} graded:`, json);
            } catch (gradingErr) {
              console.error(`❌ [Grading Worker] Grading trigger error for ${payload.submissionId}:`, gradingErr);
            }
          } else if (eventType === "LESSON_GRADING_REQUESTED" && payload.attemptId) {
            // Trigger internal lesson grade-async API endpoint
            try {
              const res = await fetch(`${APP_URL}/api/lessons/grade-async`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-token": process.env.INTERNAL_API_TOKEN || "",
                },
                body: JSON.stringify({ attemptId: payload.attemptId }),
              });
              const json = await res.json();
              console.log(`✅ [Grading Worker] Attempt ${payload.attemptId} graded:`, json);
            } catch (gradingErr) {
              console.error(`❌ [Grading Worker] Grading trigger error for ${payload.attemptId}:`, gradingErr);
            }
          }

          // Acknowledge message in Redis Stream
          await redis.xack(streamName, GROUP, messageId);
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
