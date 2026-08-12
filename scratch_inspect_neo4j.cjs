const neo4j = require("neo4j-driver");

const uri = process.env.NEO4J_URI || "neo4j+s://b2fe9d81.databases.neo4j.io";
const user = process.env.NEO4J_USERNAME || "b2fe9d81";
const password = process.env.NEO4J_PASSWORD || "XCK91qP3dMKCcBhwpQBBoYnQ6HQXuYm2zYayuZ-KOak";
const databaseName = process.env.NEO4J_DATABASE || "b2fe9d81";

async function inspectNeo4j() {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session({ database: databaseName });

  try {
    console.log("🔍 Inspecting Neo4j Graph Database...\n");

    // 1. Label Counts
    console.log("--- 1. NODE COUNTS BY LABEL ---");
    const labelRes = await session.run("MATCH (n) RETURN labels(n)[0] AS label, count(n) as count ORDER BY count DESC");
    labelRes.records.forEach(r => {
      console.log(`Label [${r.get("label")}]: ${r.get("count").toInt()} nodes`);
    });

    // 2. Nodes Details
    console.log("\n--- 2. ALL NODES DETAILS ---");
    const nodesRes = await session.run("MATCH (n) RETURN labels(n)[0] AS label, properties(n) AS props LIMIT 100");
    nodesRes.records.forEach((r, idx) => {
      console.log(`${idx + 1}. [${r.get("label")}]`, JSON.stringify(r.get("props")));
    });

    // 3. Relationships Details
    console.log("\n--- 3. ALL RELATIONSHIPS DETAILS ---");
    const relRes = await session.run("MATCH (a)-[r]->(b) RETURN labels(a)[0] AS from_label, a.id AS from_id, type(r) AS rel_type, properties(r) AS rel_props, labels(b)[0] AS to_label, b.id AS to_id LIMIT 100");
    relRes.records.forEach((r, idx) => {
      const relProps = JSON.stringify(r.get("rel_props"));
      console.log(`${idx + 1}. (: ${r.get("from_label")} {id: "${r.get("from_id")}"}) -[: ${r.get("rel_type")} ${relProps !== "{}" ? relProps : ""}]-> (: ${r.get("to_label")} {id: "${r.get("to_id")}"})`);
    });

  } catch (err) {
    console.error("❌ Neo4j Inspection Error:", err);
  } finally {
    await session.close();
    await driver.close();
  }
}

inspectNeo4j();
