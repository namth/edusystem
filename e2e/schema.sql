-- Schema public của DB thật (pg_dump --schema-only, 01/11/2026), dùng dựng DB E2E. Dump lại khi schema đổi.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
      BEGIN
        DELETE FROM public.users WHERE email = NEW.email AND id::text != NEW.id::text;

        INSERT INTO public.users (
          id,
          email,
          name,
          phone,
          role,
          target_band,
          must_change_password
        )
        VALUES (
          NEW.id::text,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
          NEW.raw_user_meta_data->>'phone',
          COALESCE(NEW.raw_user_meta_data->>'role', 'STUDENT'),
          NEW.raw_user_meta_data->>'target_band',
          COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false)
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = COALESCE(EXCLUDED.name, public.users.name),
          phone = COALESCE(EXCLUDED.phone, public.users.phone),
          role = COALESCE(EXCLUDED.role, public.users.role),
          target_band = COALESCE(EXCLUDED.target_band, public.users.target_band),
          must_change_password = COALESCE(EXCLUDED.must_change_password, public.users.must_change_password),
          updated_at = NOW();

        RETURN NEW;
      END;
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_logs (
    id text NOT NULL,
    teacher_id text,
    student_id text,
    submission_id text,
    model text,
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    cost_usd numeric(10,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: class_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_assignments (
    id character varying(50) NOT NULL,
    class_id character varying(50) NOT NULL,
    exam_id character varying(50) NOT NULL,
    due_date timestamp with time zone,
    max_attempts integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: class_unlocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_unlocks (
    class_id character varying(50) NOT NULL,
    curriculum_item_id character varying(50) NOT NULL,
    student_id character varying(50),
    due_date timestamp with time zone,
    unlocked_by character varying(50) NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now()
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(20) NOT NULL,
    teacher_id character varying(50) NOT NULL,
    max_slots integer DEFAULT 30,
    schedule character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'ACTIVE'::text,
    course_id text,
    unlocked_progress jsonb DEFAULT '[]'::jsonb,
    unlock_mode character varying(20) DEFAULT 'MANUAL'::character varying NOT NULL,
    pass_percent integer DEFAULT 70 NOT NULL
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id character varying NOT NULL,
    title character varying NOT NULL,
    description text,
    level character varying DEFAULT 'Intermediate'::character varying,
    thumbnail text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(50),
    curriculum jsonb DEFAULT '[]'::jsonb,
    default_scoring_standard_id character varying(50)
);


--
-- Name: curriculum_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum_items (
    id character varying(50) NOT NULL,
    course_id character varying(50) NOT NULL,
    parent_id character varying(50),
    title character varying(255) NOT NULL,
    type character varying(20) NOT NULL,
    exam_id character varying(50),
    order_index integer DEFAULT 0,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    lesson_id character varying(50)
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id character varying(50) NOT NULL,
    student_id character varying(50) NOT NULL,
    class_id character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    id character varying(50) NOT NULL,
    title character varying(150) NOT NULL,
    duration_minutes integer DEFAULT 60,
    skills text[] NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    stimulus_type character varying DEFAULT 'TEXT_ONLY'::character varying,
    stimulus_text text,
    stimulus_audio_url text,
    passing_score numeric DEFAULT 6.0,
    question_ids jsonb DEFAULT '[]'::jsonb,
    created_by character varying(50),
    scoring_standard_id character varying(50)
);


--
-- Name: flashcards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flashcards (
    id character varying NOT NULL,
    vietnamese_name character varying NOT NULL,
    correct_english_word character varying NOT NULL,
    options jsonb NOT NULL,
    image_url text,
    audio_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(50)
);


--
-- Name: lesson_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_attempts (
    id character varying(50) NOT NULL,
    lesson_id character varying(50) NOT NULL,
    class_id character varying(50) NOT NULL,
    student_id character varying(50) NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    objective_earned numeric DEFAULT 0 NOT NULL,
    objective_max numeric DEFAULT 0 NOT NULL,
    ai_earned numeric,
    ai_max numeric DEFAULT 0 NOT NULL,
    score_percent numeric,
    status character varying(20) DEFAULT 'GRADED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    graded_at timestamp with time zone
);


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    skills text[] DEFAULT '{}'::text[] NOT NULL,
    question_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying(60) NOT NULL,
    user_id character varying(50) NOT NULL,
    type character varying(40) NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    link text,
    ref_id character varying(60) NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id character varying NOT NULL,
    skill character varying NOT NULL,
    category character varying NOT NULL,
    prompt text,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    stimulus_text text,
    stimulus_audio_url text,
    created_by character varying(50)
);


--
-- Name: scoring_rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_rubrics (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    scale_min numeric DEFAULT 0 NOT NULL,
    scale_max numeric DEFAULT 9 NOT NULL,
    scale_step numeric DEFAULT 0.5 NOT NULL,
    criteria jsonb NOT NULL,
    output_language text DEFAULT 'vi'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scoring_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoring_standards (
    id character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    framework character varying(50),
    description text,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    aggregation jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_by character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: slot_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_requests (
    id character varying(50) NOT NULL,
    teacher_id character varying(50) NOT NULL,
    teacher_name character varying(100) NOT NULL,
    teacher_email character varying(100) NOT NULL,
    requested_slots integer NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id character varying(50) NOT NULL,
    exam_id character varying(50) NOT NULL,
    student_id character varying(50) NOT NULL,
    answers jsonb NOT NULL,
    ai_score numeric(3,1),
    ai_feedback text,
    final_score numeric(3,1),
    final_feedback text,
    status character varying(30) DEFAULT 'AI_GRADED'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    grading_attempts integer DEFAULT 0 NOT NULL,
    last_grading_error text,
    teacher_review jsonb,
    final_evaluation_details jsonb,
    candidate_name character varying(100),
    candidate_email character varying(100),
    candidate_phone character varying(50),
    class_id uuid,
    reading_score numeric(4,2),
    listening_score numeric(4,2),
    writing_score numeric(4,2),
    speaking_score numeric(4,2),
    overall_band numeric(4,2),
    teacher_feedback text,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    graded_at timestamp with time zone,
    class_ref character varying(50),
    deadline_at timestamp with time zone,
    is_late boolean DEFAULT false NOT NULL,
    results jsonb,
    section_scores jsonb,
    total_score numeric,
    passed boolean,
    standard_snapshot jsonb
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_by character varying(255),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    phone character varying(50),
    target_band character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    must_change_password boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    password character varying(255) DEFAULT ''::character varying,
    slot_limit integer DEFAULT 250,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    last_login_at timestamp without time zone,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone
);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: class_assignments class_assignments_class_id_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_assignments
    ADD CONSTRAINT class_assignments_class_id_exam_id_key UNIQUE (class_id, exam_id);


--
-- Name: class_assignments class_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_assignments
    ADD CONSTRAINT class_assignments_pkey PRIMARY KEY (id);


--
-- Name: classes classes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_code_key UNIQUE (code);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: curriculum_items curriculum_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_items
    ADD CONSTRAINT curriculum_items_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_student_id_class_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_class_id_key UNIQUE (student_id, class_id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: flashcards flashcards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcards
    ADD CONSTRAINT flashcards_pkey PRIMARY KEY (id);


--
-- Name: lesson_attempts lesson_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_attempts
    ADD CONSTRAINT lesson_attempts_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: scoring_rubrics scoring_rubrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_rubrics
    ADD CONSTRAINT scoring_rubrics_pkey PRIMARY KEY (id);


--
-- Name: scoring_standards scoring_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoring_standards
    ADD CONSTRAINT scoring_standards_pkey PRIMARY KEY (id);


--
-- Name: slot_requests slot_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_requests
    ADD CONSTRAINT slot_requests_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_usage_logs_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_student_id ON public.ai_usage_logs USING btree (student_id);


--
-- Name: idx_ai_usage_logs_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_teacher_id ON public.ai_usage_logs USING btree (teacher_id);


--
-- Name: idx_class_assignments_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_assignments_class ON public.class_assignments USING btree (class_id);


--
-- Name: idx_classes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_code ON public.classes USING btree (code);


--
-- Name: idx_classes_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_teacher_id ON public.classes USING btree (teacher_id);


--
-- Name: idx_enrollments_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_class ON public.enrollments USING btree (class_id);


--
-- Name: idx_flashcards_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_flashcards_created_by ON public.flashcards USING btree (created_by);


--
-- Name: idx_lesson_attempts_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lesson_attempts_lookup ON public.lesson_attempts USING btree (class_id, student_id, lesson_id);


--
-- Name: idx_lessons_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lessons_created_by ON public.lessons USING btree (created_by);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_questions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_created_by ON public.questions USING btree (created_by);


--
-- Name: idx_slot_requests_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_requests_teacher_id ON public.slot_requests USING btree (teacher_id);


--
-- Name: idx_submissions_class_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_class_id ON public.submissions USING btree (class_id);


--
-- Name: idx_submissions_exam_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_exam_id ON public.submissions USING btree (exam_id);


--
-- Name: idx_submissions_exam_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_exam_student ON public.submissions USING btree (exam_id, student_id);


--
-- Name: idx_submissions_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_student_id ON public.submissions USING btree (student_id);


--
-- Name: idx_submissions_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_submitted_at ON public.submissions USING btree (submitted_at DESC);


--
-- Name: idx_system_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_settings_key ON public.system_settings USING btree (key);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: uq_class_unlocks; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_class_unlocks ON public.class_unlocks USING btree (class_id, curriculum_item_id, COALESCE(student_id, ''::character varying));


--
-- Name: uq_notifications_user_type_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notifications_user_type_ref ON public.notifications USING btree (user_id, type, ref_id);


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


