import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { ALL_OFFICIAL_STANDARDS_RUBRICS } from "@/lib/rubric-resolver";

// Helper to deduce framework and language safely
function inferFrameworkAndLanguage(id: string, name: string) {
  const lowerId = (id || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();

  let framework = "IELTS";
  let language = "EN";

  if (lowerId.includes("hsk") || lowerName.includes("hsk") || lowerName.includes("tiếng trung")) {
    framework = "HSK";
    language = "ZH";
  } else if (lowerId.includes("jlpt") || lowerName.includes("jlpt") || lowerName.includes("tiếng nhật")) {
    framework = "JLPT";
    language = "JA";
  } else if (lowerId.includes("toeic") || lowerName.includes("toeic")) {
    framework = "TOEIC";
    language = "EN";
  } else if (lowerId.includes("toefl") || lowerName.includes("toefl")) {
    framework = "TOEFL";
    language = "EN";
  } else if (lowerId.includes("cefr") || lowerName.includes("cefr")) {
    framework = "CEFR";
    language = "EN";
  } else if (lowerId.includes("internal") || lowerName.includes("nội bộ")) {
    framework = "INTERNAL";
    language = "VI";
  }

  return { framework, language };
}

// GET: Fetch all scoring rubrics from Supabase DB
export async function GET() {
  const supabase = getServerSupabaseClient();

  try {
    const { data: rubrics, error } = await supabase
      .from("scoring_rubrics")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching rubrics:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map rows with inferred framework and language properties for UI
    const mappedRubrics = (rubrics || []).map((r: any) => {
      const { framework, language } = inferFrameworkAndLanguage(r.id, r.name);
      return {
        ...r,
        skill: r.name.toLowerCase().includes("speaking") ? "Speaking" : "Writing",
        framework: r.framework || framework,
        language: r.language || language,
      };
    });

    return NextResponse.json({ success: true, rubrics: mappedRubrics });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

// POST: Create a new scoring rubric in Supabase DB
export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();

  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      scale_min,
      scale_max,
      scale_step,
      criteria,
      output_language,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Tên Bộ Rubric không được để trống" }, { status: 400 });
    }

    const rubricId = id || `rubric_${Date.now()}`;

    const { data, error } = await supabase
      .from("scoring_rubrics")
      .upsert([
        {
          id: rubricId,
          name: name.trim(),
          description: description?.trim() || "",
          scale_min: scale_min ?? 0,
          scale_max: scale_max ?? 9,
          scale_step: scale_step ?? 0.5,
          criteria: criteria || [],
          output_language: output_language || "vi",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating rubric:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { framework, language } = inferFrameworkAndLanguage(data.id, data.name);

    return NextResponse.json({
      success: true,
      rubric: {
        ...data,
        skill: data.name.toLowerCase().includes("speaking") ? "Speaking" : "Writing",
        framework,
        language,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

// PUT: Update an existing scoring rubric in Supabase DB
export async function PUT(request: Request) {
  const supabase = getServerSupabaseClient();

  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      scale_min,
      scale_max,
      scale_step,
      criteria,
      output_language,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing rubric id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("scoring_rubrics")
      .update({
        name: name?.trim(),
        description: description?.trim(),
        scale_min: scale_min,
        scale_max: scale_max,
        scale_step: scale_step,
        criteria: criteria,
        output_language: output_language,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating rubric:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { framework, language } = inferFrameworkAndLanguage(data.id, data.name);

    return NextResponse.json({
      success: true,
      rubric: {
        ...data,
        skill: data.name.toLowerCase().includes("speaking") ? "Speaking" : "Writing",
        framework,
        language,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

// DELETE: Delete a scoring rubric by ID
export async function DELETE(request: Request) {
  const supabase = getServerSupabaseClient();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing rubric id" }, { status: 400 });
    }

    const { error } = await supabase.from("scoring_rubrics").delete().eq("id", id);

    if (error) {
      console.error("Error deleting rubric:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
