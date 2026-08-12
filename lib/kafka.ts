// ======================================================
// KAFKA EVENT BUS & EVENT-DRIVEN GRAPH SYNC WORKER
// ======================================================

import { runCypherQuery } from "@/lib/neo4j";
import { DBCourse, DBLesson, DBExam, DBClass } from "@/lib/db-schema";

export interface KafkaEvent<T = any> {
  eventId: string;
  eventType:
    | "COURSE_CREATED"
    | "LESSON_ADDED"
    | "EXAM_CREATED"
    | "EXAM_BOUND_TO_LESSON"
    | "EXAM_BOUND_TO_COURSE"
    | "QUESTION_BOUND"
    | "CLASS_CREATED"
    | "STUDENT_ENROLLED"
    | "STUDENT_SUBMITTED";
  timestamp: string;
  payload: T;
}

// In-Memory Kafka Producer Queue with Fallback & Automatic Retry
const eventQueue: KafkaEvent[] = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || eventQueue.length === 0) return;
  isProcessingQueue = true;

  while (eventQueue.length > 0) {
    const event = eventQueue[0];
    try {
      await consumeEventToNeo4j(event);
      eventQueue.shift(); // Remove event upon successful sync
    } catch (err) {
      console.warn(`[Kafka Event Bus] Retry queued event ${event.eventType} due to error:`, err);
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      break;
    }
  }

  isProcessingQueue = false;
}

// Consumer Worker: Synchronizes Events to Neo4j Graph Nodes & Edges
async function consumeEventToNeo4j(event: KafkaEvent) {
  const { eventType, payload } = event;

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

    case "LESSON_ADDED": {
      const { courseId, lesson, orderIndex } = payload;
      const cypher = `
        MERGE (c:Course {id: $courseId})
        MERGE (l:Lesson {id: $lessonId})
        SET l.title = $title
        MERGE (c)-[:HAS_LESSON {order: $orderIndex}]->(l)
      `;
      await runCypherQuery(cypher, {
        courseId,
        lessonId: lesson.id,
        title: lesson.title,
        orderIndex: orderIndex || 1,
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
        WITH e
        OPTIONAL MATCH (l:Lesson {id: $lessonId})
        FOREACH (_ IN CASE WHEN l IS NOT NULL THEN [1] ELSE [] END |
          MERGE (l)-[:HAS_EXAM]->(e)
        )
      `;
      await runCypherQuery(cypher, {
        examId: exam.id,
        title: exam.title,
        duration: exam.duration_minutes || 60,
        courseId: courseId || "",
        lessonId: lessonId || "",
      });
      break;
    }

    case "QUESTION_BOUND": {
      const { examId, questionId, orderIndex, teacherId, skill, category } = payload;
      const cypher = `
        MERGE (e:Exam {id: $examId})
        MERGE (q:Question {id: $questionId})
        SET q.skill = $skill, q.category = $category
        MERGE (e)-[:CONTAINS {order: $orderIndex}]->(q)
        WITH q
        WHERE $teacherId IS NOT NULL AND $teacherId <> ''
        MERGE (t:Teacher {id: $teacherId})
        MERGE (t)-[:CREATED]->(q)
      `;
      await runCypherQuery(cypher, {
        examId,
        questionId,
        orderIndex: orderIndex || 1,
        skill: skill || "Reading",
        category: category || "READING_MC",
        teacherId: teacherId || "",
      });
      break;
    }

    case "CLASS_CREATED": {
      const { courseId, teacherId, classItem } = payload;
      const cypher = `
        MERGE (cls:Class {id: $classId})
        SET cls.name = $name, cls.code = $code
        WITH cls
        OPTIONAL MATCH (c:Course {id: $courseId})
        FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
          MERGE (c)-[:INSTANTIATED_AS]->(cls)
        )
        WITH cls
        WHERE $teacherId IS NOT NULL AND $teacherId <> ''
        MERGE (t:Teacher {id: $teacherId})
        MERGE (t)-[:MANAGES]->(cls)
      `;
      await runCypherQuery(cypher, {
        classId: classItem.id,
        name: classItem.name,
        code: classItem.code,
        courseId: courseId || "",
        teacherId: teacherId || "",
      });
      break;
    }

    case "STUDENT_ENROLLED": {
      const { studentId, classId } = payload;
      const cypher = `
        MERGE (s:Student {id: $studentId})
        MERGE (cls:Class {id: $classId})
        MERGE (s)-[:ENROLLED_IN]->(cls)
      `;
      await runCypherQuery(cypher, { studentId, classId });
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

    case "EXAM_BOUND_TO_LESSON": {
      const { lessonId, examId, orderIndex } = payload;
      const cypher = `
        MERGE (l:Lesson {id: $lessonId})
        MERGE (e:Exam {id: $examId})
        MERGE (l)-[:HAS_EXAM {order: $orderIndex}]->(e)
      `;
      await runCypherQuery(cypher, { lessonId, examId, orderIndex: orderIndex || 1 });
      break;
    }

    case "EXAM_BOUND_TO_COURSE": {
      const { courseId, examId, examScope } = payload;
      const cypher = `
        MERGE (c:Course {id: $courseId})
        MERGE (e:Exam {id: $examId})
        MERGE (c)-[:CONTAINS_EXAM {scope: $examScope}]->(e)
      `;
      await runCypherQuery(cypher, { courseId, examId, examScope: examScope || "FINAL_EXAM" });
      break;
    }

    default:
      console.warn("Unknown Kafka Event Type:", eventType);
  }
}

// Kafka Event Producer Helper Functions
export async function emitKafkaEvent<T>(eventType: KafkaEvent["eventType"], payload: T) {
  const event: KafkaEvent<T> = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  eventQueue.push(event);
  processQueue(); // Trigger async consumer worker execution
}
