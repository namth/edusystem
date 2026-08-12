// ======================================================
// REDIS STREAMS & BULLMQ ASYNC EVENT QUEUE FOR NEO4J & AI GRADING
// ======================================================

import Redis from "ioredis";
import { runCypherQuery } from "@/lib/neo4j";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy(times) {
      if (times > 2) {
        isRedisAvailable = false;
        return null;
      }
      return 1000;
    },
  });

  redisClient.on("connect", () => {
    isRedisAvailable = true;
    console.log("⚡ [Redis Streams] Connected to Redis Queue Server.");
    initRedisStreamConsumers();
  });

  redisClient.on("error", () => {
    isRedisAvailable = false;
  });
} catch (err) {
  isRedisAvailable = false;
}

const fallbackMemoryQueue: Array<{ streamKey: string; eventType: string; payload: any }> = [];
let isProcessingFallback = false;

// Produce Event to Redis Streams
export async function pushRedisStreamEvent(streamKey: string, eventType: string, payload: any) {
  if (redisClient && isRedisAvailable) {
    try {
      await redisClient.xadd(
        streamKey,
        "*",
        "eventType",
        eventType,
        "payload",
        JSON.stringify(payload)
      );
      return;
    } catch (err) {
      console.warn("[Redis Streams] XADD failed, routing to fallback queue:", err);
    }
  }

  fallbackMemoryQueue.push({ streamKey, eventType, payload });
  processFallbackQueue();
}

/**
 * Pushes a grading job event into Redis Stream 'stream:learning:grading'
 */
export async function pushGradingEvent(submissionId: string, examId: string, studentId: string) {
  await pushRedisStreamEvent("stream:learning:grading", "GRADING_REQUESTED", {
    submissionId,
    examId,
    studentId,
    timestamp: new Date().toISOString(),
  });
}

// Redis Stream Consumer Loop for Neo4j Sync
async function initRedisStreamConsumers() {
  if (!redisClient || !isRedisAvailable) return;

  const streams = [
    "stream:learning:courses",
    "stream:learning:exams",
    "stream:learning:classes",
    "stream:learning:submissions",
  ];

  setInterval(async () => {
    if (!redisClient || !isRedisAvailable) return;
    try {
      for (const stream of streams) {
        const entries = await redisClient.xread("COUNT", 5, "STREAMS", stream, "0-0");
        if (entries && entries.length > 0) {
          for (const [streamName, messages] of entries) {
            for (const [messageId, fields] of messages) {
              const fieldMap: Record<string, string> = {};
              for (let i = 0; i < fields.length; i += 2) {
                fieldMap[fields[i]] = fields[i + 1];
              }

              const eventType = fieldMap["eventType"];
              const payload = JSON.parse(fieldMap["payload"] || "{}");

              await processGraphSync(eventType, payload);
              await redisClient.xdel(streamName, messageId);
            }
          }
        }
      }
    } catch (err) {
      // Ignore polling errors
    }
  }, 2000);
}

async function processFallbackQueue() {
  if (isProcessingFallback || fallbackMemoryQueue.length === 0) return;
  isProcessingFallback = true;

  while (fallbackMemoryQueue.length > 0) {
    const item = fallbackMemoryQueue[0];
    try {
      await processGraphSync(item.eventType, item.payload);
      fallbackMemoryQueue.shift();
    } catch (err) {
      console.warn("[Fallback Queue] Retrying Neo4j sync:", err);
      await new Promise((res) => setTimeout(res, 1000));
      break;
    }
  }

  isProcessingFallback = false;
}

async function processGraphSync(eventType: string, payload: any) {
  switch (eventType) {
    case "COURSE_CREATED": {
      const { teacherId, course } = payload;
      const cypher = `
        MERGE (c:Course {id: $courseId})
        SET c.title = $title, c.level = $level
        WITH c
        WHERE $teacherId IS NOT NULL AND $teacherId <> ''
        MERGE (t:Teacher {id: $teacherId})
        MERGE (t)-[:CREATED]->(c)
      `;
      await runCypherQuery(cypher, {
        courseId: course.id,
        title: course.title,
        level: course.level || "Intermediate",
        teacherId: teacherId || "",
      });
      break;
    }

    case "EXAM_CREATED": {
      const { lessonId, courseId, exam } = payload;
      const cypher = `
        MERGE (e:Exam {id: $examId})
        SET e.title = $title, e.duration = $duration
        WITH e
        OPTIONAL MATCH (c:Course {id: $courseId})
        FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
          MERGE (c)-[:HAS_EXAM]->(e)
        )
      `;
      await runCypherQuery(cypher, {
        examId: exam.id,
        title: exam.title,
        duration: exam.duration_minutes || 60,
        courseId: courseId || "",
      });
      break;
    }

    case "QUESTION_BOUND": {
      const { examId, questionId, orderIndex, skill, category } = payload;
      const cypher = `
        MERGE (e:Exam {id: $examId})
        MERGE (q:Question {id: $questionId})
        SET q.skill = $skill, q.category = $category
        MERGE (e)-[:CONTAINS {order: $orderIndex}]->(q)
      `;
      await runCypherQuery(cypher, {
        examId,
        questionId,
        orderIndex: orderIndex || 1,
        skill: skill || "Reading",
        category: category || "READING_MC",
      });
      break;
    }

    case "STUDENT_SUBMITTED": {
      const { studentId, examId, classId, submissionId, score } = payload;
      const cypher = `
        MERGE (s:Student {id: $studentId})
        MERGE (e:Exam {id: $examId})
        MERGE (cls:Class {id: $classId})
        MERGE (s)-[:SUBMITTED {submission_id: $submissionId, score: $score, date: datetime()}]->(e)
        MERGE (s)-[:SUBMITTED_IN]->(cls)
      `;
      await runCypherQuery(cypher, { studentId, examId, classId, submissionId, score });
      break;
    }
  }
}
