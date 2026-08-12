import neo4j, { Driver } from "neo4j-driver";

const uri = process.env.NEO4J_URI || "neo4j+s://b2fe9d81.databases.neo4j.io";
const user = process.env.NEO4J_USERNAME || "b2fe9d81";
const password = process.env.NEO4J_PASSWORD || "XCK91qP3dMKCcBhwpQBBoYnQ6HQXuYm2zYayuZ-KOak";
const databaseName = process.env.NEO4J_DATABASE || "b2fe9d81";

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver | null {
  if (!driver) {
    try {
      driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        maxConnectionLifetime: 3 * 60 * 1000,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 5000,
      });
    } catch (err) {
      console.warn("Neo4j driver init warning:", err);
    }
  }
  return driver;
}

export async function runCypherQuery(query: string, params: Record<string, any> = {}) {
  const drv = getNeo4jDriver();
  if (!drv) {
    console.warn("Neo4j driver unavailable, skipping Cypher execution.");
    return [];
  }
  const session = drv.session({ database: databaseName });
  try {
    const result = await session.run(query, params);
    return result.records;
  } catch (error) {
    console.error("Cypher Query Error:", error);
    return [];
  } finally {
    await session.close();
  }
}

// Graph Relationship Helpers per PRD Specification
export async function syncTeacherManagesClass(teacherId: string, classId: string) {
  const cypher = `
    MERGE (t:Teacher {id: $teacherId})
    MERGE (c:Class {id: $classId})
    MERGE (t)-[:MANAGES]->(c)
  `;
  return await runCypherQuery(cypher, { teacherId, classId });
}

export async function syncStudentEnrolledInClass(studentId: string, classId: string) {
  const cypher = `
    MERGE (s:Student {id: $studentId})
    MERGE (c:Class {id: $classId})
    MERGE (s)-[:ENROLLED_IN]->(c)
  `;
  return await runCypherQuery(cypher, { studentId, classId });
}

export async function recordStudentSkillScore(studentId: string, skillId: string, score: number) {
  const cypher = `
    MERGE (s:Student {id: $studentId})
    MERGE (sk:SkillNode {id: $skillId})
    MERGE (s)-[r:LEARNED]->(sk)
    ON CREATE SET r.score = $score, r.date = datetime()
    ON MATCH SET r.score = $score, r.date = datetime()
  `;
  return await runCypherQuery(cypher, { studentId, skillId, score });
}

export async function syncCourseExam(courseId: string, courseTitle: string, examId: string, examTitle: string) {
  const cypher = `
    MERGE (c:Course {id: $courseId})
    SET c.title = $courseTitle
    MERGE (e:Exam {id: $examId})
    SET e.title = $examTitle
    MERGE (c)-[:HAS_EXAM]->(e)
  `;
  return await runCypherQuery(cypher, { courseId, courseTitle, examId, examTitle });
}

export async function getExamCourseMapping() {
  const cypher = `
    MATCH (c:Course)-[:HAS_EXAM]->(e:Exam)
    RETURN e.id AS examId, c.id AS courseId, c.title AS courseTitle
  `;
  const records = await runCypherQuery(cypher);
  return records.map(r => ({
    examId: r.get("examId") as string,
    courseId: r.get("courseId") as string,
    courseTitle: r.get("courseTitle") as string,
  }));
}

