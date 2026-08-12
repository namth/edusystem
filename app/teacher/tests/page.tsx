"use client";

import { useState, useEffect, useRef } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  PlusCircle, 
  Sparkles, 
  Clock, 
  Trash2, 
  Eye, 
  Loader2, 
  GraduationCap, 
  BookOpen,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  FolderPlus,
  FilePlus,
  Award,
  BookMarked,
  CheckCircle2,
  X,
  GripVertical,
  ArrowRight,
  Pencil,
  Plus
} from "lucide-react";
import { INITIAL_COURSES } from "@/lib/mock-data";

interface CurriculumItem {
  id: string;
  course_id: string;
  parent_id?: string | null;
  title: string;
  type: "UNIT" | "LESSON" | "EXAM";
  exam_id?: string | null;
  order_index: number;
  exam?: {
    id: string;
    title: string;
    duration_minutes?: number;
    skills?: string[];
  } | null;
}

interface ExamOption {
  id: string;
  title: string;
}

export default function TeacherTestManagerPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("crs_01");
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [availableExams, setAvailableExams] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Flexible Cross-Level Drag State
  const [activePointerDragId, setActivePointerDragId] = useState<string | null>(null);
  const [pointerTargetState, setPointerTargetState] = useState<{
    parentId: string | null;
    hoverIndex: number;
  } | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  // DOM Refs for Tracking Cards
  const itemDomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const pointerDragInfoRef = useRef<{
    activeId: string;
    initialParentId: string | null;
    initialIndex: number;
    targetParentId: string | null;
    targetIndex: number;
    title: string;
    typeStr: string;
    isUnitCategory: boolean;
  } | null>(null);

  // Expanded Units State
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({
    curr_unit_01: true,
    curr_unit_02: true,
  });

  // Modal State (Add or Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumItem | null>(null);
  const [modalType, setModalType] = useState<"LESSON" | "EXAM" | "UNIT">("LESSON");
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  // Fetch Curriculum Tree for selected course
  const fetchCurriculum = async (courseId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/curriculum?course_id=${courseId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.items)) {
        setItems(json.items.sort((a: CurriculumItem, b: CurriculumItem) => a.order_index - b.order_index));
      }
    } catch (err) {
      console.error("Fetch curriculum error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all created exams to bind
  const fetchExams = async () => {
    try {
      const { data } = await supabase.from("exams").select("id, title").order("created_at", { ascending: false });
      if (data) {
        setAvailableExams(data);
      }
    } catch (err) {
      console.error("Fetch exams error:", err);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    fetchCurriculum(selectedCourseId);
  }, [selectedCourseId]);

  const toggleUnitExpand = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  // Filter exams that are not assigned to any curriculum item in the current course
  const unassignedExams = availableExams.filter(
    (ex) => !items.some((item) => item.exam_id === ex.id)
  );

  // Quick add unassigned exam to current syllabus
  const handleAddUnassignedExam = async (exam: ExamOption) => {
    try {
      const res = await fetch("/api/teacher/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourseId,
          title: exam.title,
          type: "LESSON",
          parent_id: null,
          exam_id: exam.id,
          order_index: items.length + 1,
        }),
      });

      const json = await res.json();
      if (json.success) {
        fetchCurriculum(selectedCourseId);
      } else {
        alert("Lỗi thêm bài tập vào lộ trình: " + json.error);
      }
    } catch (err) {
      console.error("Add unassigned exam error:", err);
    }
  };

  // Open Unified Modal for Adding
  const openAddModal = (type: "LESSON" | "EXAM" | "UNIT" = "LESSON", parentId: string | null = null) => {
    setEditingItem(null);
    setModalType(type);
    setTargetParentId(parentId);
    setNewTitle("");
    const initialExam = availableExams[0]?.id || "";
    setSelectedExamId(initialExam);
    setShowModal(true);
  };

  // Open Unified Modal for Editing
  const openEditModal = (item: CurriculumItem) => {
    setEditingItem(item);
    setModalType(item.type === "UNIT" ? "UNIT" : item.type);
    setTargetParentId(item.parent_id || null);
    setNewTitle(item.title);
    setSelectedExamId(item.exam_id || (availableExams[0]?.id || ""));
    setShowModal(true);
  };

  // Submit Modal (Create or Edit)
  const handleSubmitModal = async () => {
    const selectedExamObj = availableExams.find((e) => e.id === selectedExamId);
    
    let finalTitle = newTitle.trim();
    if (!finalTitle) {
      if (modalType === "UNIT") {
        finalTitle = "Unit Mới";
      } else if (selectedExamObj) {
        finalTitle = selectedExamObj.title;
      } else {
        finalTitle = "Bài Học Mới";
      }
    }

    try {
      if (editingItem) {
        // Edit Mode
        const res = await fetch("/api/teacher/curriculum", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              {
                id: editingItem.id,
                title: finalTitle,
                type: modalType,
                exam_id: modalType !== "UNIT" ? selectedExamId || null : null,
              },
            ],
          }),
        });

        const json = await res.json();
        if (json.success) {
          setShowModal(false);
          fetchCurriculum(selectedCourseId);
        } else {
          alert("Lỗi cập nhật: " + json.error);
        }
      } else {
        // Create Mode
        const res = await fetch("/api/teacher/curriculum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: selectedCourseId,
            title: finalTitle,
            type: modalType,
            parent_id: targetParentId,
            exam_id: modalType !== "UNIT" ? selectedExamId || null : null,
            order_index: items.length + 1,
          }),
        });

        const json = await res.json();
        if (json.success) {
          setShowModal(false);
          fetchCurriculum(selectedCourseId);
        } else {
          alert("Lỗi tạo mục mới: " + json.error);
        }
      }
    } catch (err: any) {
      console.error("Submit modal error:", err);
    }
  };

  // Delete Node
  const handleDeleteNode = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa mục này khỏi lộ trình học không?")) return;
    try {
      const res = await fetch(`/api/teacher/curriculum?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchCurriculum(selectedCourseId);
      }
    } catch (err) {
      console.error("Delete node error:", err);
    }
  };

  // Reorder via Arrow Buttons
  const handleMoveArrow = (index: number, direction: "UP" | "DOWN", parentId: string | null) => {
    const siblingList = items
      .filter((i) => (i.parent_id || null) === parentId)
      .sort((a, b) => a.order_index - b.order_index);

    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblingList.length) return;

    const reordered = [...siblingList];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    applyNewSiblingOrder(reordered, parentId);
  };

  // Apply new sibling order to React state & DB
  const applyNewSiblingOrder = (reorderedSiblings: CurriculumItem[], parentId: string | null) => {
    const updatedSiblings = reorderedSiblings.map((item, idx) => ({
      ...item,
      order_index: idx + 1,
      parent_id: parentId,
    }));

    setItems((prevItems) => {
      const nonSiblings = prevItems.filter((i) => (i.parent_id || null) !== parentId && i.id !== updatedSiblings[0]?.id);
      const newFullList = [...nonSiblings, ...updatedSiblings].sort((a, b) => a.order_index - b.order_index);
      syncToBackend(updatedSiblings);
      return newFullList;
    });
  };

  const syncToBackend = async (updatedItems: CurriculumItem[]) => {
    const payload = updatedItems.map((item) => ({
      id: item.id,
      order_index: item.order_index,
      parent_id: item.parent_id || null,
    }));

    try {
      const res = await fetch("/api/teacher/curriculum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const json = await res.json();
      if (!json.success) {
        console.warn("Backend order sync failed:", json.error);
      }
    } catch (err) {
      console.error("Sync order error:", err);
    }
  };

  // Group items into Top-Level Root Items and Children
  const rootItems = items.filter((item) => !item.parent_id).sort((a, b) => a.order_index - b.order_index);
  const getChildItems = (parentId: string) =>
    items.filter((item) => item.parent_id === parentId).sort((a, b) => a.order_index - b.order_index);

  // =========================================================================
  // BOUNDARY-AWARE POINTER DRAG ENGINE
  // =========================================================================
  const handleStartPointerDrag = (
    e: React.PointerEvent,
    item: CurriculumItem,
    index: number
  ) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("button, a, input, select, [role='button']")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const parentId = item.parent_id || null;
    const isUnitCategory = item.type === "UNIT";

    const dragHandleContainer = e.currentTarget as HTMLElement;
    if (dragHandleContainer && typeof dragHandleContainer.setPointerCapture === "function") {
      try {
        dragHandleContainer.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    pointerDragInfoRef.current = {
      activeId: item.id,
      initialParentId: parentId,
      initialIndex: index,
      targetParentId: parentId,
      targetIndex: index,
      title: item.title,
      typeStr: item.type === "UNIT" ? "UNIT" : item.type === "EXAM" ? "ĐỀ THI" : "BÀI HỌC",
      isUnitCategory,
    };

    setActivePointerDragId(item.id);
    setPointerTargetState({ parentId, hoverIndex: index });
    setPointerPos({ x: e.clientX, y: e.clientY });

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      const clientX = moveEvt.clientX;
      const clientY = moveEvt.clientY;
      setPointerPos({ x: clientX, y: clientY });

      if (!pointerDragInfoRef.current) return;

      const hoveredEl = document.elementFromPoint(clientX, clientY);
      if (!hoveredEl) return;

      if (isUnitCategory) {
        const rootSiblings = items.filter((i) => !i.parent_id).sort((a, b) => a.order_index - b.order_index);
        let computedIdx = rootSiblings.length;
        for (let i = 0; i < rootSiblings.length; i++) {
          const sib = rootSiblings[i];
          const dom = itemDomRefs.current[sib.id] || (document.getElementById(`item_${sib.id}`) as HTMLDivElement | null);
          if (dom) {
            const rect = dom.getBoundingClientRect();
            if (clientY < rect.top + rect.height / 2) {
              computedIdx = i;
              break;
            }
          }
        }
        pointerDragInfoRef.current.targetParentId = null;
        pointerDragInfoRef.current.targetIndex = computedIdx;
        setPointerTargetState({ parentId: null, hoverIndex: computedIdx });
        return;
      }

      const cardContainer = hoveredEl.closest("[data-order-idx]");
      if (cardContainer) {
        const rawParent = cardContainer.getAttribute("data-parent-id");
        const cardParentId = rawParent === "root" ? null : rawParent;
        const targetIdx = parseInt(cardContainer.getAttribute("data-order-idx") || "0", 10);

        const rect = cardContainer.getBoundingClientRect();
        const isBelowMid = clientY > rect.top + rect.height / 2;
        const finalTargetIdx = isBelowMid ? targetIdx + 1 : targetIdx;

        if (cardParentId !== undefined) {
          pointerDragInfoRef.current.targetParentId = cardParentId;
          pointerDragInfoRef.current.targetIndex = Math.max(0, finalTargetIdx);
          setPointerTargetState({ parentId: cardParentId, hoverIndex: Math.max(0, finalTargetIdx) });
        }
      }
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      if (dragHandleContainer && typeof dragHandleContainer.releasePointerCapture === "function") {
        try {
          dragHandleContainer.releasePointerCapture(upEvt.pointerId);
        } catch (err) {}
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (pointerDragInfoRef.current) {
        const { activeId, targetParentId, targetIndex } = pointerDragInfoRef.current;

        setItems((latestItems) => {
          const draggedObj = latestItems.find((i) => i.id === activeId);
          if (!draggedObj) return latestItems;

          const itemsWithoutDragged = latestItems.filter((i) => i.id !== activeId);

          const targetSiblings = itemsWithoutDragged
            .filter((i) => (i.parent_id || null) === targetParentId)
            .sort((a, b) => a.order_index - b.order_index);

          const updatedDraggedObj: CurriculumItem = {
            ...draggedObj,
            parent_id: targetParentId,
          };

          const clampTargetIdx = Math.max(0, Math.min(targetIndex, targetSiblings.length));
          targetSiblings.splice(clampTargetIdx, 0, updatedDraggedObj);

          const reorderedTargetSiblings = targetSiblings.map((it, idx) => ({
            ...it,
            order_index: idx + 1,
          }));

          const nonTargetSiblings = itemsWithoutDragged.filter((i) => (i.parent_id || null) !== targetParentId);
          const fullNewItems = [...nonTargetSiblings, ...reorderedTargetSiblings].sort((a, b) => a.order_index - b.order_index);

          syncToBackend(reorderedTargetSiblings);
          return fullNewItems;
        });
      }

      setActivePointerDragId(null);
      setPointerTargetState(null);
      setPointerPos(null);
      pointerDragInfoRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const selectedCourseObj = INITIAL_COURSES.find((c) => c.id === selectedCourseId) || INITIAL_COURSES[0];

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-[#211a16] select-none">
        {/* Floating Pointer Drag Preview Box */}
        {activePointerDragId && pointerPos && pointerDragInfoRef.current && (
          <div
            style={{
              top: `${pointerPos.y + 12}px`,
              left: `${pointerPos.x + 12}px`,
            }}
            className="fixed pointer-events-none z-50 px-4 py-3 rounded-2xl border-2 border-[#6d3807] bg-[#fff1ea] text-[#6d3807] text-xs font-bold shadow-2xl opacity-95 flex items-center space-x-2 shrink-0 max-w-sm"
          >
            <GripVertical className="w-4 h-4 text-[#6d3807]" />
            <span className="px-2 py-0.5 rounded-full bg-[#6d3807] text-white text-[10px]">
              {pointerDragInfoRef.current.typeStr}
            </span>
            <span className="truncate">{pointerDragInfoRef.current.title}</span>
          </div>
        )}

        {/* Page Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
              Quản Lý Bài Học &amp; Đề Thi Theo Cây Lộ Trình
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Giao diện đồng bộ: <b>Icon chỉnh sửa đặt cạnh icon xóa</b> và <b>Thanh điều hướng sắp xếp tối ưu</b>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/tests/import"
              className="px-4 py-2.5 bg-[#fff1ea] text-[#6d3807] hover:bg-[#ffdcc5] border border-[#d8c2b6] rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-[#6d3807]" />
              <span>AI Exam Importer</span>
            </Link>

            <Link
              href="/teacher/tests/create"
              className="px-4 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4 text-[#ffb782]" />
              <span>Soạn Bộ Đề Mới</span>
            </Link>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar - Course Selection & Unassigned Exams */}
          <div className="lg:col-span-3 space-y-5">
            {/* Box 1: Course Categories */}
            <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-3.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#6d3807] flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#6d3807]" />
                <span>Danh Mục Khóa Học</span>
              </h2>
              
              <div className="flex flex-col space-y-1.5">
                {INITIAL_COURSES.map((course) => {
                  const isSelected = selectedCourseId === course.id;
                  return (
                    <button
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-[#6d3807] text-white shadow-sm"
                          : "text-[#52443a] hover:bg-[#fff8f5] hover:text-[#6d3807] border border-transparent hover:border-[#d8c2b6]/40"
                      }`}
                    >
                      <span className="flex items-center space-x-2 max-w-[85%]">
                        <GraduationCap className="w-4 h-4 shrink-0" />
                        <span className="truncate">{course.title}</span>
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#ffb782] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Box 2: Unassigned Exams / Exercises */}
            <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#6d3807] flex items-center space-x-2">
                  <BookMarked className="w-4 h-4 text-[#6d3807]" />
                  <span>Bài Tập Chưa Lộ Trình</span>
                </h2>
                <span className="px-2 py-0.5 bg-[#fff1ea] text-[#6d3807] text-[10px] font-bold rounded-full border border-[#d8c2b6]">
                  {unassignedExams.length}
                </span>
              </div>

              {unassignedExams.length === 0 ? (
                <p className="text-xs text-[#52443a] italic py-2 text-center bg-[#fff8f5] rounded-xl border border-dashed border-[#d8c2b6]">
                  Tất cả bài tập đã gắn vào lộ trình.
                </p>
              ) : (
                <div className="flex flex-col space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {unassignedExams.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-2.5 rounded-xl border border-[#d8c2b6]/50 bg-[#faf8f6] hover:bg-[#fff8f5] transition-all flex items-center justify-between gap-2 group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-[#6d3807] block truncate">
                          {ex.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddUnassignedExam(ex)}
                        className="p-1.5 bg-[#fff1ea] text-[#6d3807] hover:bg-[#6d3807] hover:text-white rounded-lg transition-all border border-[#d8c2b6] shrink-0"
                        title="Thêm vào cuối lộ trình"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Prominently Wrapped Curriculum Syllabus Container */}
          <div className="lg:col-span-9">
            <div className="bg-white rounded-2xl border border-[#d8c2b6] shadow-sm overflow-hidden space-y-0">
              
              {/* PROMINENT HEADER BANNER */}
              <div className="bg-gradient-to-r from-[#6d3807] via-[#8a4f1e] to-[#6d3807] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl text-white">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffb782] block">
                      Lộ Trình Đào Tạo Đang Chọn
                    </span>
                    <h2 className="text-lg font-headline font-bold text-white flex items-center space-x-2.5 mt-0.5">
                      <span>{selectedCourseObj.title}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold border border-white/20">
                        {selectedCourseObj.level}
                      </span>
                    </h2>
                  </div>
                </div>
              </div>

              {/* EMBEDDED UNIT TREE LIST */}
              <div className="p-5 bg-[#faf8f6]/40">
                {loading ? (
                  <div className="flex items-center justify-center space-x-2 text-xs text-[#52443a] py-16 bg-white rounded-2xl border border-[#d8c2b6]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#6d3807]" />
                    <span className="font-bold">Đang nạp cây lộ trình...</span>
                  </div>
                ) : rootItems.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-4">
                    <div className="w-12 h-12 bg-[#fff1ea] rounded-full flex items-center justify-center mx-auto text-[#6d3807]">
                      <BookMarked className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[#211a16]">Chưa có bài học hoặc đề thi trong khóa này</h3>
                      <p className="text-xs text-[#52443a] max-w-md mx-auto">
                        Bắt đầu xây dựng chương trình bằng cách tạo Unit hoặc chèn đề thi phía dưới.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Level 1 Container (Root Items) */
                  <div className="space-y-3 transition-all duration-200">
                    {rootItems.map((rootNode, rootIdx) => {
                      const children = getChildItems(rootNode.id);
                      const isUnit = rootNode.type === "UNIT";
                      const isExpanded = expandedUnits[rootNode.id] !== false;
                      const isBeingDragged = activePointerDragId === rootNode.id;

                      const isTargetHoveredRoot =
                        pointerTargetState?.parentId === null && pointerTargetState?.hoverIndex === rootIdx;

                      const isTargetHoveredRootEnd =
                        pointerTargetState?.parentId === null &&
                        rootIdx === rootItems.length - 1 &&
                        pointerTargetState?.hoverIndex >= rootItems.length;

                      return (
                        <div
                          key={rootNode.id}
                          id={`item_${rootNode.id}`}
                          data-order-idx={rootIdx}
                          data-parent-id="root"
                          ref={(el) => { itemDomRefs.current[rootNode.id] = el; }}
                          className="space-y-2 transition-all duration-200"
                        >
                          {/* DASHED TARGET PREVIEW SLOT FOR ROOT LEVEL (BEFORE ITEM) */}
                          {isTargetHoveredRoot && !isBeingDragged && (
                            <div className="border-2 border-dashed border-[#6d3807] bg-[#fff8f5]/80 rounded-2xl h-16 transition-all duration-200 animate-pulse my-2 shrink-0 pointer-events-none shadow-inner" />
                          )}

                          {/* Main Root Item Card (FULL BAR DRAG) */}
                          <div
                            onPointerDown={(e) => handleStartPointerDrag(e, rootNode, rootIdx)}
                            className={`bg-white rounded-2xl border transition-all duration-150 overflow-hidden cursor-grab active:cursor-grabbing ${
                              isBeingDragged
                                ? "opacity-40 border-2 border-dashed border-[#6d3807] bg-[#fff8f5] shadow-inner"
                                : "border-[#d8c2b6] shadow-2xs hover:border-[#6d3807]"
                            }`}
                          >
                            {/* Root Level Header Row (Unit or Course Exam) */}
                            <div className={`p-4 flex items-center justify-between gap-3 border-b ${
                              isUnit ? "bg-[#fff8f5] border-[#d8c2b6]/60" : "bg-[#faf8f6] border-[#d8c2b6]/30"
                            }`}>
                              <div className="flex items-center space-x-2 max-w-[70%]">
                                {/* Drag Handle Icon */}
                                <GripVertical className="w-4.5 h-4.5 text-[#52443a]/60 group-hover:text-[#6d3807] shrink-0" />

                                {isUnit ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleUnitExpand(rootNode.id)}
                                    className="p-1 text-[#6d3807] hover:bg-[#fff1ea] rounded-lg transition-all shrink-0"
                                  >
                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                  </button>
                                ) : (
                                  <Award className="w-5 h-5 text-amber-600 shrink-0 ml-1" />
                                )}

                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isUnit
                                        ? "bg-[#6d3807] text-white"
                                        : rootNode.type === "EXAM"
                                        ? "bg-amber-600 text-white"
                                        : "bg-blue-600 text-white"
                                    }`}>
                                      {isUnit ? "UNIT" : rootNode.type === "EXAM" ? "ĐỀ THI" : "BÀI HỌC"}
                                    </span>

                                    {rootNode.exam && (
                                      <span className="text-[10px] text-[#52443a] flex items-center space-x-1">
                                        <Clock className="w-3 h-3 text-[#6d3807]" />
                                        <span>{rootNode.exam.duration_minutes || 60} Phút</span>
                                      </span>
                                    )}
                                  </div>

                                  <h3 className="text-sm font-bold text-[#211a16] mt-0.5">{rootNode.title}</h3>
                                </div>
                              </div>

                              {/* Actions for Root Item */}
                              <div className="flex items-center space-x-1.5 shrink-0">
                                {/* Reorder Arrow Buttons */}
                                <button
                                  type="button"
                                  onClick={() => handleMoveArrow(rootIdx, "UP", null)}
                                  disabled={rootIdx === 0}
                                  className="p-1.5 text-[#52443a] hover:bg-[#fff1ea] rounded-lg disabled:opacity-30 transition-all border border-[#d8c2b6]/40"
                                  title="Lên"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveArrow(rootIdx, "DOWN", null)}
                                  disabled={rootIdx === rootItems.length - 1}
                                  className="p-1.5 text-[#52443a] hover:bg-[#fff1ea] rounded-lg disabled:opacity-30 transition-all border border-[#d8c2b6]/40"
                                  title="Xuống"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>

                                {/* Add Lesson to Unit */}
                                {isUnit && (
                                  <button
                                    type="button"
                                    onClick={() => openAddModal("LESSON", rootNode.id)}
                                    className="px-2.5 py-1.5 bg-[#fff1ea] text-[#6d3807] hover:bg-[#ffdcc5] text-[11px] font-bold rounded-lg border border-[#d8c2b6] flex items-center space-x-1"
                                  >
                                    <FilePlus className="w-3.5 h-3.5" />
                                    <span>Bài Học</span>
                                  </button>
                                )}

                                {/* Preview Exam in New Tab */}
                                {rootNode.exam_id && (
                                  <Link
                                    href={`/student/exam/${rootNode.exam_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-[#6d3807] hover:bg-[#fff1ea] rounded-lg transition-all border border-[#d8c2b6]/40"
                                    title="Xem thử"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                )}

                                {/* Edit Button - Positioned Right Next to Delete */}
                                <button
                                  type="button"
                                  onClick={() => openEditModal(rootNode)}
                                  className="p-1.5 text-[#6d3807] hover:bg-[#fff1ea] rounded-lg transition-all border border-[#d8c2b6]/40"
                                  title="Chỉnh sửa"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>

                                {/* Delete Item */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNode(rootNode.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-rose-200"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Children Items List (Lessons inside Unit - LEVEL 2 Container) */}
                            {isUnit && isExpanded && (
                              <div
                                data-order-idx="0"
                                data-parent-id={rootNode.id}
                                className="p-3 pl-8 bg-white space-y-2 border-t border-[#d8c2b6]/20 transition-all duration-200"
                              >
                                {/* PREVIEW FRAME FOR EMPTY UNIT DROP ZONE */}
                                {children.length === 0 ? (
                                  pointerTargetState?.parentId === rootNode.id ? (
                                    <div className="border-2 border-dashed border-[#6d3807] bg-[#fff8f5]/80 rounded-xl h-14 transition-all duration-200 animate-pulse my-1 shrink-0 pointer-events-none shadow-inner flex items-center justify-center">
                                      <span className="text-xs font-bold text-[#6d3807] animate-pulse">Thả bài học vào đây...</span>
                                    </div>
                                  ) : (
                                    <div className="p-4 border-2 border-dashed border-[#d8c2b6] rounded-xl bg-[#fff8f5] text-center space-y-1">
                                      <p className="text-xs text-[#52443a] italic font-bold">
                                        Chưa có bài học nào trong Unit này.
                                      </p>
                                      <p className="text-[11px] text-[#6d3807] font-medium">
                                        Nhấp "Bài Học" hoặc <b>Kéo thả bài học vào đây</b>.
                                      </p>
                                    </div>
                                  )
                                ) : (
                                  children.map((child, childIdx) => {
                                    const isChildBeingDragged = activePointerDragId === child.id;
                                    const isTargetHoveredChild =
                                      pointerTargetState?.parentId === rootNode.id &&
                                      pointerTargetState?.hoverIndex === childIdx;

                                    const isTargetHoveredChildEnd =
                                      pointerTargetState?.parentId === rootNode.id &&
                                      childIdx === children.length - 1 &&
                                      pointerTargetState?.hoverIndex >= children.length;

                                    return (
                                      <div
                                        key={child.id}
                                        id={`item_${child.id}`}
                                        data-order-idx={childIdx}
                                        data-parent-id={rootNode.id}
                                        ref={(el) => { itemDomRefs.current[child.id] = el; }}
                                        className="space-y-1.5 transition-all duration-200"
                                      >
                                        {/* DASHED TARGET PREVIEW SLOT FOR CHILD LEVEL (BEFORE CHILD) */}
                                        {isTargetHoveredChild && !isChildBeingDragged && (
                                          <div className="border-2 border-dashed border-[#6d3807] bg-[#fff8f5]/80 rounded-xl h-12 transition-all duration-200 animate-pulse my-1 shrink-0 pointer-events-none shadow-inner" />
                                        )}

                                        <div
                                          onPointerDown={(e) => handleStartPointerDrag(e, child, childIdx)}
                                          className={`p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing ${
                                            isChildBeingDragged
                                              ? "opacity-40 border-2 border-dashed border-[#6d3807] bg-gray-50 shadow-inner"
                                              : "border-[#d8c2b6]/40 hover:border-[#6d3807] bg-[#faf8f6] hover:bg-[#fff8f5]"
                                          }`}
                                        >
                                          <div className="flex items-center space-x-2.5">
                                            <GripVertical className="w-3.5 h-3.5 text-[#52443a]/50 group-hover:text-[#6d3807] shrink-0" />

                                            <div className="w-7 h-7 rounded-lg bg-[#fff1ea] text-[#6d3807] font-bold text-xs flex items-center justify-center shrink-0">
                                              {childIdx + 1}
                                            </div>
                                            <div>
                                              <div className="flex items-center space-x-2">
                                                <span className="px-2 py-0.2 rounded-md bg-[#6d3807]/10 text-[#6d3807] text-[10px] font-bold">
                                                  {child.type === "EXAM" ? "Đề Thi" : "Bài Học"}
                                                </span>
                                                {child.exam && (
                                                  <span className="text-[10px] text-[#52443a] flex items-center space-x-1">
                                                    <Clock className="w-3 h-3 text-[#6d3807]" />
                                                    <span>{child.exam.duration_minutes || 45} mins</span>
                                                  </span>
                                                )}
                                              </div>
                                              <h4 className="text-xs font-bold text-[#211a16] mt-0.5">{child.title}</h4>
                                            </div>
                                          </div>

                                          <div className="flex items-center space-x-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleMoveArrow(childIdx, "UP", rootNode.id)}
                                              disabled={childIdx === 0}
                                              className="p-1 text-[#52443a] hover:bg-white rounded disabled:opacity-30 border border-[#d8c2b6]/30"
                                              title="Lên"
                                            >
                                              <ArrowUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveArrow(childIdx, "DOWN", rootNode.id)}
                                              disabled={childIdx === children.length - 1}
                                              className="p-1 text-[#52443a] hover:bg-white rounded disabled:opacity-30 border border-[#d8c2b6]/30"
                                              title="Xuống"
                                            >
                                              <ArrowDown className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Preview Exam in New Tab */}
                                            {child.exam_id && (
                                              <Link
                                                href={`/student/exam/${child.exam_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1 text-[#6d3807] hover:bg-[#fff1ea] rounded border border-[#d8c2b6]/30"
                                                title="Xem thử"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                              </Link>
                                            )}

                                            {/* Edit Button - Positioned Right Next to Delete */}
                                            <button
                                              type="button"
                                              onClick={() => openEditModal(child)}
                                              className="p-1 text-[#6d3807] hover:bg-[#fff1ea] rounded border border-[#d8c2b6]/30"
                                              title="Chỉnh sửa"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleDeleteNode(child.id)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-rose-200"
                                              title="Xóa"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* DASHED TARGET PREVIEW SLOT AT VERY END OF UNIT CHILDREN */}
                                        {isTargetHoveredChildEnd && !isChildBeingDragged && (
                                          <div className="border-2 border-dashed border-[#6d3807] bg-[#fff8f5]/80 rounded-xl h-12 transition-all duration-200 animate-pulse my-1 shrink-0 pointer-events-none shadow-inner" />
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          {/* DASHED TARGET PREVIEW SLOT AT VERY END OF ROOT LIST */}
                          {isTargetHoveredRootEnd && !isBeingDragged && (
                            <div className="border-2 border-dashed border-[#6d3807] bg-[#fff8f5]/80 rounded-2xl h-16 transition-all duration-200 animate-pulse my-2 shrink-0 pointer-events-none shadow-inner" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2 IDENTICAL BRIGHT ACTION BUTTONS AT BOTTOM */}
                <div className="mt-6 pt-5 border-t border-[#d8c2b6]/60 flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={() => openAddModal("UNIT", null)}
                    className="px-6 py-3 bg-[#fff1ea] text-[#6d3807] hover:bg-[#ffdcc5] border border-[#d8c2b6] rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all shadow-xs hover:shadow-md"
                  >
                    <FolderPlus className="w-4 h-4 text-[#6d3807]" />
                    <span>Thêm Unit / Chương Mới</span>
                  </button>

                  <button
                    onClick={() => openAddModal("LESSON", null)}
                    className="px-6 py-3 bg-[#fff1ea] text-[#6d3807] hover:bg-[#ffdcc5] border border-[#d8c2b6] rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all shadow-xs hover:shadow-md"
                  >
                    <Plus className="w-4 h-4 text-[#6d3807]" />
                    <span>Thêm Bài Học / Đề Thi Mới</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Streamlined Unified Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#d8c2b6] space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#d8c2b6]/40 pb-3">
              <h3 className="text-base font-bold text-[#211a16]">
                {editingItem
                  ? "Chỉnh Sửa Mục"
                  : modalType === "UNIT"
                  ? "Tạo Unit / Chương Mới"
                  : "Thêm Bài Học / Đề Thi Mới"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields - Streamlined Labels */}
            <div className="space-y-4 text-xs">
              
              {/* FIELD 1: Select Exam / Exercise */}
              {modalType !== "UNIT" && (
                <div className="space-y-1.5">
                  <label className="block font-bold text-[#52443a]">1. Chọn Đề Thi / Bài Tập</label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#d8c2b6] text-xs font-medium text-[#211a16] bg-white focus:outline-none focus:border-[#6d3807] focus:ring-2 focus:ring-[#6d3807]/15 transition-all shadow-2xs"
                  >
                    {availableExams.length === 0 ? (
                      <option value="">Chưa có đề thi sẵn</option>
                    ) : (
                      availableExams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* FIELD 2: Select Category (Radio Buttons) */}
              {modalType !== "UNIT" && (
                <div className="space-y-1.5">
                  <label className="block font-bold text-[#52443a]">2. Chọn Phân Loại</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        modalType === "LESSON"
                          ? "border-[#6d3807] bg-[#fff8f5] ring-1 ring-[#6d3807]"
                          : "border-[#d8c2b6] bg-white hover:bg-[#faf8f6]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="modalTypeRadio"
                        value="LESSON"
                        checked={modalType === "LESSON"}
                        onChange={() => setModalType("LESSON")}
                        className="w-4 h-4 text-[#6d3807] focus:ring-[#6d3807] accent-[#6d3807]"
                      />
                      <span className="text-xs font-bold text-[#211a16]">Bài Học</span>
                    </label>

                    <label
                      className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        modalType === "EXAM"
                          ? "border-[#6d3807] bg-[#fff8f5] ring-1 ring-[#6d3807]"
                          : "border-[#d8c2b6] bg-white hover:bg-[#faf8f6]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="modalTypeRadio"
                        value="EXAM"
                        checked={modalType === "EXAM"}
                        onChange={() => setModalType("EXAM")}
                        className="w-4 h-4 text-[#6d3807] focus:ring-[#6d3807] accent-[#6d3807]"
                      />
                      <span className="text-xs font-bold text-[#211a16]">Đề Thi</span>
                    </label>
                  </div>
                </div>
              )}

              {/* FIELD 3: Custom Title Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-[#52443a]">
                  {modalType === "UNIT" ? "Tên Unit / Chương" : "3. Tên Tùy Chọn"}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    modalType === "UNIT"
                      ? "Nhập tên Unit..."
                      : "Để trống để tự động lấy tên đề thi/bài tập"
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#d8c2b6] text-xs font-medium text-[#211a16] bg-white focus:outline-none focus:border-[#6d3807] focus:ring-2 focus:ring-[#6d3807]/15 transition-all shadow-2xs placeholder:text-gray-400"
                />
              </div>

            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-[#d8c2b6]/30">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitModal}
                className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-[#ffffff] font-bold rounded-xl text-xs shadow-sm transition-all"
              >
                {editingItem ? "Lưu Thay Đổi" : "Tạo Mới"}
              </button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}
