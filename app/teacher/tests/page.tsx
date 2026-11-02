"use client";

import { useState, useEffect, useRef } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import Link from "next/link";
import { isNoopGap, computeDrop, type DndItem } from "@/lib/curriculum-dnd";
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
  Plus,
  RefreshCw,
  ExternalLink
} from "lucide-react";

interface CurriculumItem extends DndItem {
  id: string;
  course_id: string;
  parent_id: string | null;
  title: string;
  type: "UNIT" | "LESSON" | "EXAM";
  exam_id?: string | null;
  lesson_id?: string | null;
  order_index: number;
  exam?: {
    id: string;
    title: string;
    duration_minutes?: number;
    skills?: string[];
  } | null;
}

interface LessonOption {
  id: string;
  title: string;
  block_count: number;
  skills?: string[];
}

interface ExamOption {
  id: string;
  title: string;
}

interface CourseItem {
  id: string;
  title: string;
  description?: string;
  default_scoring_standard_id?: string | null;
  subject_id?: string;
  level?: string;
  created_by?: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

const SELECTED_COURSE_KEY = "teacher_tests_selected_course";
const NEW_EXAM_DRAG_PREFIX = "new_exam_";

function readSavedCourseId(): string | null {
  try {
    return localStorage.getItem(SELECTED_COURSE_KEY);
  } catch {
    return null;
  }
}

export default function TeacherTestManagerPage() {
  // Rỗng tới khi nạp xong khóa học của chính giáo viên (không mặc định một khóa cố định)
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([{ id: "english", name: "Tiếng Anh" }]);
  const [scoringStandards, setScoringStandards] = useState<any[]>([]);
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [availableExams, setAvailableExams] = useState<ExamOption[]>([]);
  const [availableLessons, setAvailableLessons] = useState<LessonOption[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [lessonSearchQuery, setLessonSearchQuery] = useState<string>("");
  const [isLoadingLessons, setIsLoadingLessons] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Course Modals State
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseDefaultStandardId, setCourseDefaultStandardId] = useState<string>("");
  const [courseSubjectId, setCourseSubjectId] = useState<string>("english");
  const [isCourseSubmitting, setIsCourseSubmitting] = useState(false);

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
    // Kéo bài tập chưa có lộ trình từ sidebar: chỉ tạo mục khi thả trúng cây lộ trình
    newExam?: ExamOption;
    hasTarget: boolean;
  } | null>(null);

  // Tự cuộn trang khi kéo gần mép trên/dưới màn hình
  const autoScrollRef = useRef<{ rafId: number | null; x: number; y: number }>({ rafId: null, x: 0, y: 0 });

  // Expanded Units State
  // Units not in this map are shown expanded (see isExpanded below)
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

  // Modal State (Add or Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumItem | null>(null);
  const [modalType, setModalType] = useState<"LESSON" | "EXAM" | "UNIT">("LESSON");
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  // In-page non-blocking notification and action loading states
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setBannerMessage({ text: msg, type: "error" });
  };
  const showSuccess = (msg: string) => {
    setBannerMessage({ text: msg, type: "success" });
    setTimeout(() => setBannerMessage(null), 4000);
  };

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Fetch Curriculum Tree for selected course
  // Fetch Courses owned by logged-in teacher
  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/teacher/courses");
      const json = await res.json();
      if (json.success && Array.isArray(json.courses)) {
        const list: CourseItem[] = json.courses;
        setCourses(list);
        // Giữ khóa đang chọn nếu còn; nếu không lấy khóa đã nhớ, cuối cùng là khóa đầu tiên
        setSelectedCourseId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          const saved = readSavedCourseId();
          if (saved && list.some((c) => c.id === saved)) return saved;
          return list[0]?.id || "";
        });
        if (list.length === 0) {
          setItems([]);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Fetch courses error:", err);
    }
  };

  // Fetch Curriculum Tree for selected course
  const fetchCurriculum = async (courseId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/curriculum?courseId=${courseId}`);
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

  // Fetch all created exams owned by logged-in teacher to bind
  const fetchExams = async () => {
    try {
      const res = await fetch("/api/teacher/exams");
      const json = await res.json();
      if (json.success && Array.isArray(json.exams)) {
        setAvailableExams(json.exams);
      }
    } catch (err) {
      console.error("Fetch exams error:", err);
    }
  };

  // Fetch all lessons from lesson library
  const fetchLessons = async () => {
    setIsLoadingLessons(true);
    try {
      const res = await fetch("/api/teacher/lessons");
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.lessons)) {
        setAvailableLessons(json.lessons);
      }
    } catch (err) {
      console.error("Fetch lessons error:", err);
    } finally {
      setIsLoadingLessons(false);
    }
  };

  // Fetch scoring standards
  const fetchScoringStandards = async () => {
    try {
      const res = await fetch("/api/scoring-standards");
      const json = await res.json();
      if (json.standards && Array.isArray(json.standards)) {
        setScoringStandards(json.standards);
      }
    } catch (err) {
      console.error("Fetch scoring standards error:", err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/subjects?active=1");
      const json = await res.json();
      if (json?.success && Array.isArray(json.subjects) && json.subjects.length > 0) {
        setSubjects(json.subjects);
      }
    } catch (err) {
      console.error("Fetch subjects error:", err);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchExams();
    fetchScoringStandards();
    fetchSubjects();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) return;
    setIsCourseSubmitting(true);
    try {
      const res = await fetch("/api/teacher/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: courseTitle.trim(),
          description: courseDesc.trim(),
          default_scoring_standard_id: courseDefaultStandardId.trim() || null,
          subject_id: courseSubjectId || "english",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddCourseModal(false);
        setCourseTitle("");
        setCourseDesc("");
        setCourseDefaultStandardId("");
        setCourseSubjectId("english");
        await fetchCourses();
        if (json.course?.id) setSelectedCourseId(json.course.id);
      } else {
        alert("Lỗi tạo khóa học: " + (json.error || "Không thể tạo khóa học"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCourseSubmitting(false);
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !courseTitle.trim()) return;
    setIsCourseSubmitting(true);
    try {
      const res = await fetch("/api/teacher/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCourse.id,
          title: courseTitle.trim(),
          description: courseDesc.trim(),
          default_scoring_standard_id: courseDefaultStandardId.trim() || null,
          subject_id: courseSubjectId || "english",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowEditCourseModal(false);
        setEditingCourse(null);
        setCourseDefaultStandardId("");
        await fetchCourses();
      } else {
        alert("Lỗi cập nhật: " + (json.error || "Không thể cập nhật khóa học"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCourseSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa Khóa học "${courseName}"? Tất cả bài học trong khóa học này sẽ bị xóa.`)) return;
    try {
      const res = await fetch(`/api/teacher/courses?id=${courseId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        // fetchCourses tự chọn khóa khác khi khóa đang chọn đã bị xóa
        await fetchCourses();
      } else {
        alert("Lỗi xóa khóa học: " + (json.error || "Bạn không có quyền xóa khóa học này."));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    try {
      localStorage.setItem(SELECTED_COURSE_KEY, selectedCourseId);
    } catch {}
    fetchCurriculum(selectedCourseId);
  }, [selectedCourseId]);

  const toggleUnitExpand = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: prev[unitId] === false }));
  };

  // Filter exams that are not assigned to any curriculum item in the current course
  const unassignedExams = availableExams.filter(
    (ex) => !items.some((item) => item.exam_id === ex.id)
  );

  // Quick add unassigned exam to current syllabus
  const handleAddUnassignedExam = async (exam: ExamOption) => {
    setSubmittingActionId(`unassigned_${exam.id}`);
    try {
      const res = await fetch("/api/teacher/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourseId,
          title: exam.title,
          type: "EXAM",
          parent_id: null,
          exam_id: exam.id,
        }),
      });

      const json = await res.json();
      if (json.success && json.item) {
        const newItem: CurriculumItem = {
          ...json.item,
          exam: { id: exam.id, title: exam.title },
        };
        setItems((prev) => [...prev, newItem]);
        showSuccess(`Đã thêm "${exam.title}" vào lộ trình.`);
      } else {
        showError("Lỗi thêm bài tập vào lộ trình: " + (json.error || ""));
      }
    } catch (err: any) {
      showError("Lỗi kết nối: " + (err.message || ""));
    } finally {
      setSubmittingActionId(null);
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
    setSelectedLessonId("");
    setLessonSearchQuery("");
    if (type === "LESSON") {
      fetchLessons();
    }
    setShowModal(true);
  };

  // Open Unified Modal for Editing
  const openEditModal = (item: CurriculumItem) => {
    setEditingItem(item);
    setModalType(item.type === "UNIT" ? "UNIT" : item.type);
    setTargetParentId(item.parent_id || null);
    setNewTitle(item.title);
    setSelectedExamId(item.exam_id || (availableExams[0]?.id || ""));
    setSelectedLessonId(item.lesson_id || "");
    setLessonSearchQuery("");
    if (item.type === "LESSON") {
      fetchLessons();
    }
    setShowModal(true);
  };

  // Submit Modal (Create or Edit)
  const handleSubmitModal = async () => {
    const selectedExamObj = availableExams.find((e) => e.id === selectedExamId);
    const selectedLessonObj = availableLessons.find((l) => l.id === selectedLessonId);

    if (modalType === "LESSON" && !selectedLessonId) {
      showError("Vui lòng chọn một bài học từ kho.");
      return;
    }
    
    let finalTitle = newTitle.trim();
    if (!finalTitle) {
      if (modalType === "UNIT") {
        finalTitle = "Unit Mới";
      } else if (modalType === "LESSON" && selectedLessonObj) {
        finalTitle = selectedLessonObj.title;
      } else if (selectedExamObj) {
        finalTitle = selectedExamObj.title;
      } else {
        finalTitle = modalType === "LESSON" ? "Bài Học Mới" : "Đề Thi Mới";
      }
    }

    setSubmittingActionId("modal_submit");
    try {
      if (editingItem) {
        // Edit Mode
        const putItem: any = {
          id: editingItem.id,
          title: finalTitle,
        };
        if (modalType === "LESSON") {
          putItem.lesson_id = selectedLessonId;
          putItem.exam_id = null;
        } else if (modalType === "EXAM") {
          putItem.exam_id = selectedExamId || null;
          putItem.lesson_id = null;
        }

        const res = await fetch("/api/teacher/curriculum", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [putItem],
          }),
        });

        const json = await res.json();
        if (json.success && json.items?.[0]) {
          const updated = json.items[0];
          setItems((prev) =>
            prev.map((it) =>
              it.id === updated.id
                ? {
                    ...it,
                    ...updated,
                    lesson_id: modalType === "LESSON" ? selectedLessonId : it.lesson_id,
                    exam: selectedExamObj
                      ? { id: selectedExamObj.id, title: selectedExamObj.title }
                      : (updated.exam_id ? it.exam : null),
                  }
                : it
            )
          );
          setShowModal(false);
          showSuccess("Đã cập nhật mục thành công!");
        } else {
          showError("Lỗi cập nhật: " + (json.error || "Không thể cập nhật mục."));
        }
      } else {
        // Create Mode
        const postBody: any = {
          course_id: selectedCourseId,
          parent_id: targetParentId,
          title: finalTitle,
          type: modalType,
        };
        if (modalType === "LESSON") {
          postBody.lesson_id = selectedLessonId;
        } else if (modalType === "EXAM") {
          postBody.exam_id = selectedExamId || null;
        }

        const res = await fetch("/api/teacher/curriculum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postBody),
        });

        const json = await res.json();
        if (json.success && json.item) {
          const newItem: CurriculumItem = {
            ...json.item,
            lesson_id: modalType === "LESSON" ? selectedLessonId : null,
            exam: selectedExamObj ? { id: selectedExamObj.id, title: selectedExamObj.title } : null,
          };
          setItems((prev) => [...prev, newItem]);
          if (newItem.type === "UNIT") {
            setExpandedUnits((prev) => ({ ...prev, [newItem.id]: true }));
          }
          setShowModal(false);
          showSuccess("Đã tạo mục mới thành công!");
        } else {
          showError("Lỗi tạo mục mới: " + (json.error || "Không thể tạo mục mới."));
        }
      }
    } catch (err: any) {
      showError("Lỗi kết nối: " + (err.message || ""));
    } finally {
      setSubmittingActionId(null);
    }
  };

  // Delete Node
  const handleDeleteNode = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa mục này khỏi lộ trình học không?")) return;
    setSubmittingActionId(`delete_${id}`);
    try {
      const res = await fetch(`/api/teacher/curriculum?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success && Array.isArray(json.deletedIds)) {
        const deletedSet = new Set(json.deletedIds);
        setItems((prev) => prev.filter((it) => !deletedSet.has(it.id)));
        showSuccess("Đã xóa mục khỏi lộ trình!");
      } else {
        showError("Lỗi xóa mục: " + (json.error || "Không thể xóa mục."));
      }
    } catch (err: any) {
      showError("Lỗi kết nối khi xóa: " + (err.message || ""));
    } finally {
      setSubmittingActionId(null);
    }
  };

  // Reorder via Arrow Buttons
  const handleMoveArrow = async (index: number, direction: "UP" | "DOWN", parentId: string | null) => {
    const siblingList = items
      .filter((i) => (i.parent_id || null) === parentId)
      .sort((a, b) => a.order_index - b.order_index);

    const targetItem = siblingList[index];
    if (!targetItem) return;

    const gapIndex = direction === "UP" ? index - 1 : index + 2;
    const result = computeDrop(items, targetItem.id, parentId, gapIndex);

    if (result.noop) return;

    const prevItems = items;
    setItems(result.items);

    setSubmittingActionId(`arrow_${targetItem.id}`);
    try {
      const res = await fetch("/api/teacher/curriculum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: result.changed.map(({ id, parent_id, order_index }) => ({
            id,
            parent_id: parent_id ?? null,
            order_index,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setItems(prevItems);
        showError("Lỗi cập nhật vị trí: " + (json.error || ""));
      }
    } catch (err: any) {
      setItems(prevItems);
      showError("Lỗi kết nối: " + (err.message || ""));
    } finally {
      setSubmittingActionId(null);
    }
  };

  // Group items into Top-Level Root Items and Children
  const rootItems = items.filter((item) => !item.parent_id).sort((a, b) => a.order_index - b.order_index);
  const getChildItems = (parentId: string) =>
    items.filter((item) => item.parent_id === parentId).sort((a, b) => a.order_index - b.order_index);

  // =========================================================================
  // BOUNDARY-AWARE POINTER DRAG ENGINE
  // =========================================================================
  const isDraggingNewExam = !!activePointerDragId?.startsWith(NEW_EXAM_DRAG_PREFIX);

  // Bài tập mới kéo từ sidebar chưa có trong cây nên khe nào cũng hợp lệ
  const isGapNoop = (dragId: string, parentId: string | null, gapIndex: number) =>
    !isDraggingNewExam && isNoopGap(items, dragId, parentId, gapIndex);

  // Xác định vị trí thả (parent + khe) theo toạ độ con trỏ
  const updateDropTarget = (clientX: number, clientY: number) => {
    const info = pointerDragInfoRef.current;
    if (!info) return;

    const hoveredEl = document.elementFromPoint(clientX, clientY);
    if (!hoveredEl) return;

    if (info.newExam) {
      if (!hoveredEl.closest("[data-curriculum-tree]")) {
        info.hasTarget = false;
        setPointerTargetState(null);
        return;
      }
      // Cây đang trống: thả vào gốc
      if (!itemsRef.current.some((i) => !i.parent_id)) {
        info.targetParentId = null;
        info.targetIndex = 0;
        info.hasTarget = true;
        setPointerTargetState({ parentId: null, hoverIndex: 0 });
        return;
      }
    }

    if (info.isUnitCategory) {
      const rootSiblings = itemsRef.current.filter((i) => !i.parent_id).sort((a, b) => a.order_index - b.order_index);
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
      info.targetParentId = null;
      info.targetIndex = computedIdx;
      info.hasTarget = true;
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
        info.targetParentId = cardParentId;
        info.targetIndex = Math.max(0, finalTargetIdx);
        info.hasTarget = true;
        setPointerTargetState({ parentId: cardParentId, hoverIndex: Math.max(0, finalTargetIdx) });
      }
    }
  };

  const startAutoScroll = (x: number, y: number) => {
    const EDGE = 90;
    const HEADER = 64;
    autoScrollRef.current.x = x;
    autoScrollRef.current.y = y;
    const tick = () => {
      const { x: px, y: py } = autoScrollRef.current;
      let delta = 0;
      if (py < HEADER + EDGE) delta = -Math.ceil(((HEADER + EDGE - py) / EDGE) * 18);
      else if (py > window.innerHeight - EDGE) delta = Math.ceil(((py - (window.innerHeight - EDGE)) / EDGE) * 18);
      if (delta !== 0) {
        window.scrollBy(0, delta);
        updateDropTarget(px, py);
      }
      autoScrollRef.current.rafId = requestAnimationFrame(tick);
    };
    autoScrollRef.current.rafId = requestAnimationFrame(tick);
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current.rafId !== null) cancelAnimationFrame(autoScrollRef.current.rafId);
    autoScrollRef.current.rafId = null;
  };

  // Kéo bài tập chưa có lộ trình từ sidebar vào bất kỳ vị trí nào trong cây
  const handleStartExamDrag = (e: React.PointerEvent, exam: ExamOption) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("button, a, input, select, [role='button']")) {
      return;
    }
    if (!selectedCourseId) return;

    e.preventDefault();
    e.stopPropagation();

    // Thả con trỏ khỏi thẻ nguồn để elementFromPoint nhận đúng phần tử dưới chuột
    const dragSource = e.currentTarget as HTMLElement;
    try {
      dragSource.releasePointerCapture?.(e.pointerId);
    } catch (err) {}

    const dragId = `${NEW_EXAM_DRAG_PREFIX}${exam.id}`;
    pointerDragInfoRef.current = {
      activeId: dragId,
      initialParentId: null,
      initialIndex: -1,
      targetParentId: null,
      targetIndex: 0,
      title: exam.title,
      typeStr: "BÀI TẬP",
      isUnitCategory: false,
      newExam: exam,
      hasTarget: false,
    };

    setActivePointerDragId(dragId);
    setPointerTargetState(null);
    setPointerPos({ x: e.clientX, y: e.clientY });
    startAutoScroll(e.clientX, e.clientY);

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      autoScrollRef.current.x = moveEvt.clientX;
      autoScrollRef.current.y = moveEvt.clientY;
      setPointerPos({ x: moveEvt.clientX, y: moveEvt.clientY });
      updateDropTarget(moveEvt.clientX, moveEvt.clientY);
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      stopAutoScroll();

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const info = pointerDragInfoRef.current;
      if (info?.newExam && info.hasTarget) {
        insertExamAt(info.newExam, info.targetParentId, info.targetIndex);
      }

      setActivePointerDragId(null);
      setPointerTargetState(null);
      setPointerPos(null);
      pointerDragInfoRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // API luôn chèn mục mới vào cuối nhánh cha → dời về đúng khe bằng computeDrop rồi lưu thứ tự
  const insertExamAt = async (exam: ExamOption, parentId: string | null, gapIndex: number) => {
    setSubmittingActionId(`unassigned_${exam.id}`);
    try {
      const res = await fetch("/api/teacher/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourseId,
          title: exam.title,
          type: "EXAM",
          parent_id: parentId,
          exam_id: exam.id,
        }),
      });
      const json = await res.json();
      if (!json.success || !json.item) {
        showError("Lỗi thêm bài tập vào lộ trình: " + (json.error || ""));
        return;
      }

      const newItem: CurriculumItem = {
        ...json.item,
        exam: { id: exam.id, title: exam.title },
      };
      const withNew = [...itemsRef.current, newItem];
      const result = computeDrop(withNew, newItem.id, parentId, gapIndex);
      setItems(result.items);
      if (parentId) setExpandedUnits((prev) => ({ ...prev, [parentId]: true }));

      if (!result.noop && result.changed.length > 0) {
        const putRes = await fetch("/api/teacher/curriculum", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: result.changed.map(({ id, parent_id, order_index }) => ({
              id,
              parent_id: parent_id ?? null,
              order_index,
            })),
          }),
        });
        const putJson = await putRes.json();
        if (!putJson.success) {
          // Mục đã được tạo ở cuối nhánh; chỉ thứ tự là chưa lưu
          setItems(withNew);
          showError("Đã thêm bài tập nhưng chưa lưu được vị trí: " + (putJson.error || ""));
          return;
        }
      }
      showSuccess(`Đã thêm "${exam.title}" vào lộ trình.`);
    } catch (err: any) {
      showError("Lỗi kết nối: " + (err.message || ""));
    } finally {
      setSubmittingActionId(null);
    }
  };

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
      hasTarget: true,
    };

    setActivePointerDragId(item.id);
    setPointerTargetState({ parentId, hoverIndex: index });
    setPointerPos({ x: e.clientX, y: e.clientY });
    startAutoScroll(e.clientX, e.clientY);

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      autoScrollRef.current.x = moveEvt.clientX;
      autoScrollRef.current.y = moveEvt.clientY;
      setPointerPos({ x: moveEvt.clientX, y: moveEvt.clientY });
      updateDropTarget(moveEvt.clientX, moveEvt.clientY);
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      stopAutoScroll();

      if (dragHandleContainer && typeof dragHandleContainer.releasePointerCapture === "function") {
        try {
          dragHandleContainer.releasePointerCapture(upEvt.pointerId);
        } catch (err) {}
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (pointerDragInfoRef.current) {
        const { activeId, targetParentId, targetIndex } = pointerDragInfoRef.current;
        const currentItems = itemsRef.current;
        const result = computeDrop(currentItems, activeId, targetParentId, targetIndex);

        if (!result.noop) {
          const prevItems = currentItems;
          setItems(result.items);

          fetch("/api/teacher/curriculum", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: result.changed.map(({ id, parent_id, order_index }) => ({
                id,
                parent_id: parent_id ?? null,
                order_index,
              })),
            }),
          })
            .then(async (res) => {
              const json = await res.json();
              if (!json.success) {
                setItems(prevItems);
                showError("Lỗi cập nhật vị trí kéo thả: " + (json.error || ""));
              }
            })
            .catch((err) => {
              setItems(prevItems);
              showError("Lỗi kết nối khi kéo thả: " + (err.message || ""));
            });
        }
      }

      setActivePointerDragId(null);
      setPointerTargetState(null);
      setPointerPos(null);
      pointerDragInfoRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const selectedCourseObj = courses.find((c) => c.id === selectedCourseId);

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-ink select-none">
        {/* Floating Pointer Drag Preview Box */}
        {activePointerDragId && pointerPos && pointerDragInfoRef.current && (
          <div
            style={{
              top: `${pointerPos.y + 12}px`,
              left: `${pointerPos.x + 12}px`,
            }}
            className="fixed pointer-events-none z-50 px-4 py-3 rounded-2xl border-2 border-brand-600 bg-brand-50 text-brand-600 text-xs font-bold shadow-2xl opacity-95 flex items-center space-x-2 shrink-0 max-w-sm"
          >
            <GripVertical className="w-4 h-4 text-brand-600" />
            <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px]">
              {pointerDragInfoRef.current.typeStr}
            </span>
            <span className="truncate">{pointerDragInfoRef.current.title}</span>
          </div>
        )}

        {/* Page Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-6">
          <div>
            <h1 className="font-headline text-3xl font-bold text-ink tracking-tight">
              Quản Lý Lộ Trình & Khóa Học
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Giao diện đồng bộ: <b>Icon chỉnh sửa đặt cạnh icon xóa</b> và <b>Thanh điều hướng sắp xếp tối ưu</b>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/tests/import"
              className="px-4 py-2.5 bg-brand-50 text-brand-600 hover:bg-brand-100 border border-line rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>AI Exam Importer</span>
            </Link>

            <Link
              href="/teacher/tests/create"
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4 text-accent-400" />
              <span>Soạn Bộ Đề Mới</span>
            </Link>
          </div>
        </div>

        {/* In-page Non-blocking Alert Banner */}
        {bannerMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-all shadow-xs ${
              bannerMessage.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <span className="text-xs font-bold">{bannerMessage.text}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="p-1 rounded-lg hover:bg-black/5 text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar - Course Selection & Unassigned Exams */}
          {/* Sticky trên desktop: cuộn cây lộ trình dài vẫn giữ sidebar để kéo thả */}
          <div className="lg:col-span-3 space-y-5 lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto lg:pr-1">
            {/* Box 1: Course Categories */}
            <div className="bg-white p-5 rounded-2xl border border-line shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-600 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  <span>Danh Mục Khóa Học</span>
                </h2>
                <button
                  onClick={() => {
                    setCourseTitle("");
                    setCourseDesc("");
                    setCourseDefaultStandardId("");
                    setCourseSubjectId("english");
                    setShowAddCourseModal(true);
                  }}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold rounded-lg transition-all flex items-center space-x-1 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Mới</span>
                </button>
              </div>
              
              <div className="flex flex-col space-y-1.5">
                {courses.map((course) => {
                  const isSelected = selectedCourseId === course.id;
                  const subjName =
                    subjects.find((s) => s.id === (course.subject_id || "english"))?.name ||
                    "Tiếng Anh";
                  return (
                    <div
                      key={course.id}
                      className={`group w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                        isSelected
                          ? "bg-brand-600 text-white shadow-sm border-brand-600"
                          : "text-ink-muted hover:bg-surface-alt hover:text-brand-600 border-transparent hover:border-line/40"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedCourseId(course.id)}
                        className="flex items-center space-x-2 max-w-[70%] text-left flex-1 truncate cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="truncate block">{course.title}</span>
                          <span
                            className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-brand-50 text-brand-600"
                            }`}
                          >
                            {subjName}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center space-x-1 shrink-0">
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-accent-400 shrink-0 mr-1" />}
                        <button
                          title="Sửa khóa học"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCourse(course);
                            setCourseTitle(course.title);
                            setCourseDesc(course.description || "");
                            setCourseDefaultStandardId(course.default_scoring_standard_id || "");
                            setCourseSubjectId(course.subject_id || "english");
                            setShowEditCourseModal(true);
                          }}
                          className={`p-1 rounded-lg transition-all cursor-pointer ${
                            isSelected ? "hover:bg-white/20 text-white" : "hover:bg-line/30 text-ink-subtle"
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Xóa khóa học"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCourse(course.id, course.title);
                          }}
                          className={`p-1 rounded-lg transition-all cursor-pointer ${
                            isSelected ? "hover:bg-rose-950/40 text-rose-200" : "hover:bg-rose-100 text-rose-600"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 2: Unassigned Exams / Exercises */}
            <div className="bg-white p-5 rounded-2xl border border-line shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-600 flex items-center space-x-2">
                  <BookMarked className="w-4 h-4 text-brand-600" />
                  <span>Bài Tập Chưa Lộ Trình</span>
                </h2>
                <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full border border-line">
                  {unassignedExams.length}
                </span>
              </div>

              {unassignedExams.length === 0 ? (
                <p className="text-xs text-ink-muted italic py-2 text-center bg-surface-alt rounded-xl border border-dashed border-line">
                  Tất cả bài tập đã gắn vào lộ trình.
                </p>
              ) : (
                <div className="flex flex-col space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  <p className="text-[10px] text-ink-subtle italic">
                    Kéo thả bài tập vào vị trí bất kỳ trong cây lộ trình.
                  </p>
                  {unassignedExams.map((ex) => (
                    <div
                      key={ex.id}
                      onPointerDown={(e) => handleStartExamDrag(e, ex)}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 group cursor-grab active:cursor-grabbing ${
                        activePointerDragId === `${NEW_EXAM_DRAG_PREFIX}${ex.id}`
                          ? "opacity-40 border-dashed border-brand-600 bg-surface-alt"
                          : "border-line/50 bg-surface-alt hover:bg-surface-alt hover:border-brand-600"
                      }`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-ink-muted/50 group-hover:text-brand-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-brand-600 block truncate">
                          {ex.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={submittingActionId === `unassigned_${ex.id}`}
                        onClick={() => handleAddUnassignedExam(ex)}
                        className="p-1.5 bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white rounded-lg transition-all border border-line shrink-0 disabled:opacity-50"
                        title="Thêm vào cuối lộ trình"
                      >
                        {submittingActionId === `unassigned_${ex.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Prominently Wrapped Curriculum Syllabus Container */}
          <div className="lg:col-span-9">
            <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden space-y-0">
              
              {/* PROMINENT HEADER BANNER */}
              <div className="bg-gradient-to-r from-brand-600 via-brand-700 to-brand-600 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl text-white">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-400 block">
                      Lộ Trình Đào Tạo Đang Chọn
                    </span>
                    <h2 className="text-lg font-headline font-bold text-white flex items-center space-x-2.5 mt-0.5">
                      <span>{selectedCourseObj?.title || "Chưa có khóa học — hãy tạo khóa học mới"}</span>
                      {selectedCourseObj?.level && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold border border-white/20">
                          {selectedCourseObj.level}
                        </span>
                      )}
                    </h2>
                  </div>
                </div>
              </div>

              {/* EMBEDDED UNIT TREE LIST */}
              <div data-curriculum-tree className="p-5 bg-surface-alt/40">
                {loading ? (
                  <div className="flex items-center justify-center space-x-2 text-xs text-ink-muted py-16 bg-white rounded-2xl border border-line">
                    <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                    <span className="font-bold">Đang nạp cây lộ trình...</span>
                  </div>
                ) : rootItems.length === 0 ? (
                  <div className={`py-16 text-center rounded-2xl space-y-4 transition-all ${
                    isDraggingNewExam && pointerTargetState
                      ? "border-2 border-dashed border-brand-600 bg-surface-alt"
                      : "bg-white border border-line"
                  }`}>
                    <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mx-auto text-brand-600">
                      <BookMarked className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-ink">Chưa có bài học hoặc đề thi trong khóa này</h3>
                      <p className="text-xs text-ink-muted max-w-md mx-auto">
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
                          {isTargetHoveredRoot &&
                            !isBeingDragged &&
                            activePointerDragId &&
                            pointerTargetState &&
                            !isGapNoop(activePointerDragId, pointerTargetState.parentId, pointerTargetState.hoverIndex) && (
                              <div className="border-2 border-dashed border-brand-600 bg-surface-alt/80 rounded-2xl h-16 transition-all duration-200 animate-pulse my-2 shrink-0 pointer-events-none shadow-inner" />
                            )}

                          {/* Main Root Item Card (FULL BAR DRAG) */}
                          <div
                            onPointerDown={(e) => handleStartPointerDrag(e, rootNode, rootIdx)}
                            className={`bg-white rounded-2xl border transition-all duration-150 overflow-hidden cursor-grab active:cursor-grabbing ${
                              isBeingDragged
                                ? "opacity-40 border-2 border-dashed border-brand-600 bg-surface-alt shadow-inner"
                                : "border-line shadow-2xs hover:border-brand-600"
                            }`}
                          >
                            {/* Root Level Header Row (Unit or Course Exam) */}
                            <div className={`p-4 flex items-center justify-between gap-3 border-b ${
                              isUnit ? "bg-surface-alt border-line/60" : "bg-surface-alt border-line/30"
                            }`}>
                              <div className="flex items-center space-x-2 max-w-[70%]">
                                {/* Drag Handle Icon */}
                                <GripVertical className="w-4.5 h-4.5 text-ink-muted/60 group-hover:text-brand-600 shrink-0" />

                                {isUnit ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleUnitExpand(rootNode.id)}
                                    className="p-1 text-brand-600 hover:bg-brand-50 rounded-lg transition-all shrink-0"
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
                                        ? "bg-brand-600 text-white"
                                        : rootNode.type === "EXAM"
                                        ? "bg-amber-600 text-white"
                                        : "bg-blue-600 text-white"
                                    }`}>
                                      {isUnit ? "UNIT" : rootNode.type === "EXAM" ? "ĐỀ THI" : "BÀI HỌC"}
                                    </span>

                                    {rootNode.exam && (
                                      <span className="text-[10px] text-ink-muted flex items-center space-x-1">
                                        <Clock className="w-3 h-3 text-brand-600" />
                                        <span>{rootNode.exam.duration_minutes || 60} Phút</span>
                                      </span>
                                    )}
                                  </div>

                                  <h3 className="text-sm font-bold text-ink mt-0.5">{rootNode.title}</h3>
                                </div>
                              </div>

                              {/* Actions for Root Item */}
                              <div className="flex items-center space-x-1.5 shrink-0">
                                {/* Reorder Arrow Buttons */}
                                <button
                                  type="button"
                                  onClick={() => handleMoveArrow(rootIdx, "UP", null)}
                                  disabled={rootIdx === 0}
                                  className="p-1.5 text-ink-muted hover:bg-brand-50 rounded-lg disabled:opacity-30 transition-all border border-line/40"
                                  title="Lên"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveArrow(rootIdx, "DOWN", null)}
                                  disabled={rootIdx === rootItems.length - 1}
                                  className="p-1.5 text-ink-muted hover:bg-brand-50 rounded-lg disabled:opacity-30 transition-all border border-line/40"
                                  title="Xuống"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>

                                {/* Add Lesson to Unit */}
                                {isUnit && (
                                  <button
                                    type="button"
                                    onClick={() => openAddModal("LESSON", rootNode.id)}
                                    className="px-2.5 py-1.5 bg-brand-50 text-brand-600 hover:bg-brand-100 text-[11px] font-bold rounded-lg border border-line flex items-center space-x-1"
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
                                    className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-all border border-line/40"
                                    title="Xem thử"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                )}

                                {/* Edit Lesson in New Tab */}
                                {rootNode.type === "LESSON" && rootNode.lesson_id && (
                                  <Link
                                    href={`/teacher/lessons/${rootNode.lesson_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-all border border-line/40"
                                    title="Soạn bài học"
                                  >
                                    <BookMarked className="w-4 h-4" />
                                  </Link>
                                )}

                                {/* Edit Button - Positioned Right Next to Delete */}
                                <button
                                  type="button"
                                  onClick={() => openEditModal(rootNode)}
                                  className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-all border border-line/40"
                                  title="Chỉnh sửa"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>

                                {/* Delete Item */}
                                <button
                                  type="button"
                                  disabled={submittingActionId === `delete_${rootNode.id}`}
                                  onClick={() => handleDeleteNode(rootNode.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-rose-200 disabled:opacity-40"
                                  title="Xóa"
                                >
                                  {submittingActionId === `delete_${rootNode.id}` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Children Items List (Lessons inside Unit - LEVEL 2 Container) */}
                            {isUnit && isExpanded && (
                              <div
                                data-order-idx="0"
                                data-parent-id={rootNode.id}
                                className="p-3 pl-8 bg-white space-y-2 border-t border-line/20 transition-all duration-200"
                              >
                                {/* PREVIEW FRAME FOR EMPTY UNIT DROP ZONE */}
                                {children.length === 0 ? (
                                  pointerTargetState?.parentId === rootNode.id &&
                                  activePointerDragId &&
                                  !isGapNoop(activePointerDragId, rootNode.id, pointerTargetState.hoverIndex) ? (
                                    <div className="border-2 border-dashed border-brand-600 bg-surface-alt/80 rounded-xl h-14 transition-all duration-200 animate-pulse my-1 shrink-0 pointer-events-none shadow-inner flex items-center justify-center">
                                      <span className="text-xs font-bold text-brand-600 animate-pulse">Thả bài học vào đây...</span>
                                    </div>
                                  ) : (
                                    <div className="p-4 border-2 border-dashed border-line rounded-xl bg-surface-alt text-center space-y-1">
                                      <p className="text-xs text-ink-muted italic font-bold">
                                        Chưa có bài học nào trong Unit này.
                                      </p>
                                      <p className="text-[11px] text-brand-600 font-medium">
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
                                        {isTargetHoveredChild &&
                                          !isChildBeingDragged &&
                                          activePointerDragId &&
                                          pointerTargetState &&
                                          !isGapNoop(activePointerDragId, pointerTargetState.parentId, pointerTargetState.hoverIndex) && (
                                            <div className="border-2 border-dashed border-brand-600 bg-surface-alt/80 rounded-xl h-12 transition-all duration-200 animate-pulse my-1 shrink-0 pointer-events-none shadow-inner" />
                                          )}

                                        <div
                                          onPointerDown={(e) => handleStartPointerDrag(e, child, childIdx)}
                                          className={`p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing ${
                                            isChildBeingDragged
                                              ? "opacity-40 border-2 border-dashed border-brand-600 bg-gray-50 shadow-inner"
                                              : "border-line/40 hover:border-brand-600 bg-surface-alt hover:bg-surface-alt"
                                          }`}
                                        >
                                          <div className="flex items-center space-x-2.5">
                                            <GripVertical className="w-3.5 h-3.5 text-ink-muted/50 group-hover:text-brand-600 shrink-0" />

                                            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 font-bold text-xs flex items-center justify-center shrink-0">
                                              {childIdx + 1}
                                            </div>
                                            <div>
                                              <div className="flex items-center space-x-2">
                                                <span className="px-2 py-0.2 rounded-md bg-brand-600/10 text-brand-600 text-[10px] font-bold">
                                                  {child.type === "EXAM" ? "Đề Thi" : "Bài Học"}
                                                </span>
                                                {child.exam && (
                                                  <span className="text-[10px] text-ink-muted flex items-center space-x-1">
                                                    <Clock className="w-3 h-3 text-brand-600" />
                                                    <span>{child.exam.duration_minutes || 45} mins</span>
                                                  </span>
                                                )}
                                              </div>
                                              <h4 className="text-xs font-bold text-ink mt-0.5">{child.title}</h4>
                                            </div>
                                          </div>

                                          <div className="flex items-center space-x-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleMoveArrow(childIdx, "UP", rootNode.id)}
                                              disabled={childIdx === 0}
                                              className="p-1 text-ink-muted hover:bg-white rounded disabled:opacity-30 border border-line/30"
                                              title="Lên"
                                            >
                                              <ArrowUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveArrow(childIdx, "DOWN", rootNode.id)}
                                              disabled={childIdx === children.length - 1}
                                              className="p-1 text-ink-muted hover:bg-white rounded disabled:opacity-30 border border-line/30"
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
                                                className="p-1 text-brand-600 hover:bg-brand-50 rounded border border-line/30"
                                                title="Xem thử"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                              </Link>
                                            )}

                                            {/* Edit Lesson in New Tab */}
                                            {child.type === "LESSON" && child.lesson_id && (
                                              <Link
                                                href={`/teacher/lessons/${child.lesson_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1 text-brand-600 hover:bg-brand-50 rounded border border-line/30"
                                                title="Soạn bài học"
                                              >
                                                <BookMarked className="w-3.5 h-3.5" />
                                              </Link>
                                            )}

                                            {/* Edit Button - Positioned Right Next to Delete */}
                                            <button
                                              type="button"
                                              onClick={() => openEditModal(child)}
                                              className="p-1 text-brand-600 hover:bg-brand-50 rounded border border-line/30"
                                              title="Chỉnh sửa"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                              type="button"
                                              disabled={submittingActionId === `delete_${child.id}`}
                                              onClick={() => handleDeleteNode(child.id)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 disabled:opacity-40"
                                              title="Xóa"
                                            >
                                              {submittingActionId === `delete_${child.id}` ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                          </div>
                                        </div>

                                        {/* DASHED TARGET PREVIEW SLOT AT VERY END OF UNIT CHILDREN */}
                                        {isTargetHoveredChildEnd &&
                                          !isChildBeingDragged &&
                                          activePointerDragId &&
                                          pointerTargetState &&
                                          !isGapNoop(activePointerDragId, pointerTargetState.parentId, pointerTargetState.hoverIndex) && (
                                            <div className="border-2 border-dashed border-brand-600 bg-surface-alt/80 rounded-xl h-12 transition-all duration-200 animate-pulse my-1 shrink-0 pointer-events-none shadow-inner" />
                                          )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          {/* DASHED TARGET PREVIEW SLOT AT VERY END OF ROOT LIST */}
                          {isTargetHoveredRootEnd &&
                            !isBeingDragged &&
                            activePointerDragId &&
                            pointerTargetState &&
                            !isGapNoop(activePointerDragId, pointerTargetState.parentId, pointerTargetState.hoverIndex) && (
                              <div className="border-2 border-dashed border-brand-600 bg-surface-alt/80 rounded-2xl h-16 transition-all duration-200 animate-pulse my-2 shrink-0 pointer-events-none shadow-inner" />
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2 IDENTICAL BRIGHT ACTION BUTTONS AT BOTTOM */}
                <div className="mt-6 pt-5 border-t border-line/60 flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={() => openAddModal("UNIT", null)}
                    className="px-6 py-3 bg-brand-50 text-brand-600 hover:bg-brand-100 border border-line rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all shadow-xs hover:shadow-md"
                  >
                    <FolderPlus className="w-4 h-4 text-brand-600" />
                    <span>Thêm Unit / Chương Mới</span>
                  </button>

                  <button
                    onClick={() => openAddModal("LESSON", null)}
                    className="px-6 py-3 bg-brand-50 text-brand-600 hover:bg-brand-100 border border-line rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all shadow-xs hover:shadow-md"
                  >
                    <Plus className="w-4 h-4 text-brand-600" />
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-line space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line/40 pb-3">
              <h3 className="text-base font-bold text-ink">
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
              
              {/* FIELD 1: Select Category (Radio Buttons) */}
              {modalType !== "UNIT" && (
                <div className="space-y-1.5">
                  <label className="block font-bold text-ink-muted">1. Chọn Phân Loại</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        modalType === "LESSON"
                          ? "border-brand-600 bg-surface-alt ring-1 ring-brand-600"
                          : "border-line bg-white hover:bg-surface-alt"
                      }`}
                    >
                      <input
                        type="radio"
                        name="modalTypeRadio"
                        value="LESSON"
                        checked={modalType === "LESSON"}
                        onChange={() => {
                          setModalType("LESSON");
                          if (availableLessons.length === 0) fetchLessons();
                        }}
                        className="w-4 h-4 text-brand-600 focus:ring-brand-600 accent-brand-600"
                      />
                      <span className="text-xs font-bold text-ink">Bài Học</span>
                    </label>

                    <label
                      className={`flex items-center space-x-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        modalType === "EXAM"
                          ? "border-brand-600 bg-surface-alt ring-1 ring-brand-600"
                          : "border-line bg-white hover:bg-surface-alt"
                      }`}
                    >
                      <input
                        type="radio"
                        name="modalTypeRadio"
                        value="EXAM"
                        checked={modalType === "EXAM"}
                        onChange={() => setModalType("EXAM")}
                        className="w-4 h-4 text-brand-600 focus:ring-brand-600 accent-brand-600"
                      />
                      <span className="text-xs font-bold text-ink">Đề Thi</span>
                    </label>
                  </div>
                </div>
              )}

              {/* FIELD 2A: For LESSON -> Select Lesson from Library (SCR-L4) */}
              {modalType === "LESSON" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-ink-muted">2. Chọn Bài Học Từ Kho</label>
                    <div className="flex items-center space-x-2 text-[11px]">
                      <Link
                        href="/teacher/lessons/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 font-bold hover:underline flex items-center space-x-0.5"
                      >
                        <span>Tạo bài học mới</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={fetchLessons}
                        disabled={isLoadingLessons}
                        className="text-ink-muted hover:text-brand-600 font-semibold flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingLessons ? "animate-spin" : ""}`} />
                        <span>Tải lại danh sách</span>
                      </button>
                    </div>
                  </div>

                  {/* Search in modal */}
                  <input
                    type="text"
                    value={lessonSearchQuery}
                    onChange={(e) => setLessonSearchQuery(e.target.value)}
                    placeholder="Tìm theo tiêu đề bài học..."
                    className="w-full px-3 py-1.5 rounded-xl border border-line text-xs font-medium text-ink bg-white focus:outline-none focus:border-brand-600"
                  />

                  {/* List of lessons from library */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-line bg-surface-alt">
                    {isLoadingLessons ? (
                      <div className="py-4 text-center text-xs text-ink-muted flex items-center justify-center space-x-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                        <span>Đang tải kho bài học...</span>
                      </div>
                    ) : availableLessons.filter((l) =>
                        l.title.toLowerCase().includes(lessonSearchQuery.toLowerCase())
                      ).length === 0 ? (
                      <div className="py-4 text-center text-xs text-ink-muted">
                        {lessonSearchQuery.trim()
                          ? "Không tìm thấy bài học phù hợp."
                          : "Chưa có bài học nào trong kho."}
                      </div>
                    ) : (
                      availableLessons
                        .filter((l) =>
                          l.title.toLowerCase().includes(lessonSearchQuery.toLowerCase())
                        )
                        .map((l) => {
                          const isZero = l.block_count === 0;
                          const isSelected = selectedLessonId === l.id;
                          return (
                            <div
                              key={l.id}
                              onClick={() => {
                                if (isZero) return;
                                setSelectedLessonId(l.id);
                                setNewTitle(l.title);
                              }}
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                                isZero
                                  ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200"
                                  : isSelected
                                  ? "border-brand-600 bg-white ring-1 ring-brand-600 cursor-pointer shadow-2xs"
                                  : "border-line/60 bg-white hover:border-brand-600 hover:bg-surface-alt cursor-pointer"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-ink truncate">{l.title}</p>
                                <p className="text-[10px] text-ink-muted flex items-center space-x-1.5 mt-0.5">
                                  <span>{l.block_count} khối</span>
                                  {isZero && (
                                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-semibold border border-amber-200">
                                      Chưa có nội dung
                                    </span>
                                  )}
                                </p>
                              </div>
                              <input
                                type="radio"
                                readOnly
                                checked={isSelected}
                                disabled={isZero}
                                className="w-3.5 h-3.5 text-brand-600 accent-brand-600 shrink-0"
                              />
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {/* FIELD 2B: For EXAM -> Select Exam */}
              {modalType === "EXAM" && (
                <div className="space-y-1.5">
                  <label className="block font-bold text-ink-muted">2. Chọn Đề Thi</label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line text-xs font-medium text-ink bg-white focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition-all shadow-2xs"
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

              {/* FIELD 3: Custom Title Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-ink-muted">
                  {modalType === "UNIT" ? "Tên Unit / Chương" : "3. Tên Tùy Chọn"}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    modalType === "UNIT"
                      ? "Nhập tên Unit..."
                      : "Để trống để tự động lấy tên bài học/đề thi"
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line text-xs font-medium text-ink bg-white focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition-all shadow-2xs placeholder:text-gray-400"
                />
              </div>

            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-line/30">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                Hủy
              </button>
              <button
                disabled={submittingActionId === "modal_submit"}
                onClick={handleSubmitModal}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5"
              >
                {submittingActionId === "modal_submit" && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>{editingItem ? "Lưu Thay Đổi" : "Tạo Mới"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Course */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-line/40 pb-4">
              <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-brand-600" />
                <span>Thêm Khóa Học Mới</span>
              </h2>
              <button onClick={() => setShowAddCourseModal(false)} className="text-ink-subtle hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Tên Khóa Học (*)</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Ví dụ: IELTS Academic Master 7.5+"
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Mô Tả Chi Tiết Khóa Học</label>
                <textarea
                  rows={3}
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="Mô tả lộ trình học, mục tiêu đầu ra..."
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Môn Học</label>
                <select
                  value={courseSubjectId}
                  onChange={(e) => setCourseSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                >
                  {subjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Chuẩn Chấm Mặc Định</label>
                <select
                  value={courseDefaultStandardId}
                  onChange={(e) => setCourseDefaultStandardId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                >
                  <option value="">— Không đặt chuẩn mặc định —</option>
                  {scoringStandards.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.name} {std.framework ? `(${std.framework})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex space-x-3">
                <button type="button" onClick={() => setShowAddCourseModal(false)} className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium">Hủy</button>
                <button type="submit" disabled={isCourseSubmitting} className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-1">
                  {isCourseSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <span>Thêm Khóa Học</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Course */}
      {showEditCourseModal && editingCourse && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-line/40 pb-4">
              <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-brand-600" />
                <span>Chỉnh Sửa Khóa Học</span>
              </h2>
              <button onClick={() => setShowEditCourseModal(false)} className="text-ink-subtle hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Tên Khóa Học (*)</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Mô Tả Chi Tiết Khóa Học</label>
                <textarea
                  rows={3}
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Môn Học</label>
                <select
                  value={courseSubjectId}
                  onChange={(e) => setCourseSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                >
                  {subjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink mb-1">Chuẩn Chấm Mặc Định</label>
                <select
                  value={courseDefaultStandardId}
                  onChange={(e) => setCourseDefaultStandardId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                >
                  <option value="">— Không đặt chuẩn mặc định —</option>
                  {scoringStandards.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.name} {std.framework ? `(${std.framework})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex space-x-3">
                <button type="button" onClick={() => setShowEditCourseModal(false)} className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium">Hủy</button>
                <button type="submit" disabled={isCourseSubmitting} className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-1">
                  {isCourseSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <span>Lưu Thay Đổi</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}
