# 🗺️ চাকরির বাজার (Chakrir Bazar) — Complete Features Guide

Welcome to the comprehensive features guide for **চাকরির বাজার (Chakrir Bazar)**. This document explains every single feature built into the platform, detailing its **purpose**, **inner workings**, **codebase locations**, and **how to use it**. 

Whether you are a developer looking to understand the system or an end-user seeking to maximize your career hunt, this guide will help you understand what is going on.

---

## 🧭 Document Map & Core Pillars

চাকরির বাজার (Chakrir Bazar) is designed around four main pillars, supplemented by advanced tools for interview preparation, salary negotiation, global command control, and secure database synchronization.

```
                  ┌─────────────────────────────────────┐
                  │      চাকরির বাজার (Chakrir Bazar)      │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
 🔍 PILLAR 1: Job Hunter     📄 PILLAR 2: CV Intel      💬 PILLAR 3: AI Chat
 ├─ Multi-API Aggregator    ├─ PDF/DOCX/TXT Parser     ├─ Cosine-Similarity RAG
 ├─ NLP Parameter Parsing   ├─ TF-IDF Vectorizer       ├─ Grounded Conversational AI
 └─ Dynamic Fit Scoring     └─ AI CV Quality Audit     └─ Quick Action Shortcuts
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
                        📋 PILLAR 4: Progress Tracker
                        ├─ Drag-and-Drop Kanban
                        ├─ Goal Tracker & Heatmaps
                        └─ Interactive roadmap checklists
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
 🎤 ADVANCED: Mock Interview                            💰 COACHING: Salary Coach
 ├─ 8-Question Simulators                               ├─ Offer Analysis & Market rates
 ├─ Voice/Mic Speech Input                              ├─ Objections handler
 └─ STAR Feedback (Score 1-10)                          └─ Word-for-word scripts
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
 ⌨️ COMMAND: Command Palette                            🛡️ CORE: Supabase Sync
 ├─ Cmd+K Navigation                                    ├─ Dual Auth (Email & Guest)
 └─ Preset AI Prompts                                   └─ Real-time DB persistence
```

---

## 1. 🔍 Pillar 1 — Job Hunter Agent
### 💡 Purpose
Job searching is fragmented across dozens of sites. The **Job Hunter Agent** aggregates results from 7 live platforms in parallel, translates loose search commands (like *"ML internships in Dhaka"*) into targeted queries, and programmatically computes a **Fit Score** indicating how well each job description aligns with the user's CV.

### ⚙️ Inner Workings
1. **NLP Query Parsing**: When a user inputs a search query, if it contains more than 2 words, it is sent to `/api/jobs` where Gemini 2.5 Flash parses the phrase into structured parameters (e.g. `roleKeywords`, `location`, `remotePreferred`).
2. **Parallel Aggregation**: The route executes queries to 7 search systems in parallel:
   - **Serper (Google Jobs)**: Primary engine for regional and corporate job boards.
   - **Adzuna**: Standard global employment aggregator.
   - **Remotive & Jobicy**: Specialized platforms targeting remote software development jobs.
   - **The Muse**: Cultural and startup-focused job postings.
   - **Reed.co.uk**: Core UK employment listing service.
   - **Upwork**: Captures freelance contracts.
3. **Dynamic Fit Scoring**: The backend compares the job details against the parsed text of the user's CV using a weighted formula:
   $$\text{Fit Score} = (\text{Skills Match} \times 0.45) + (\text{Experience Match} \times 0.30) + (\text{Education Match} \times 0.15) + (\text{Location Match} \times 0.10)$$
   - **Skills Score**: Measures keyword intersections between CV texts and job requirements.
   - **Experience Score**: Scans for match counts of target roles in CV titles.
   - **Education Score**: Looks for degree matches (e.g., Bachelor, Master, PhD, CS).
   - **Location Score**: Adjusts match values based on remote status and targeted locations.
4. **Explainable Match & Gaps**: Gemini lists specific matched keywords ("Strengths") and missing attributes ("Gaps") so the candidate knows exactly why the score was computed.

### 📂 Code Locations
- **Frontend View**: [JobSearch.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/JobSearch.tsx)
- **API Handler**: [/api/jobs/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/jobs/route.ts)
- **Scoring Logic**: Implemented directly in the API handler to ensure fast execution.

### 🖱️ How to Interact
1. Navigate to the **Job Search** tab.
2. Type a natural language query: *"Find me remote senior React roles with $100k salary"* or use the standard input inputs for keyword and location.
3. Browse the job cards sorted automatically by **Fit Score %**.
4. Click **"View Match Analysis"** to see the detailed breakdown of skills matched and gaps.
5. Click **"Track Application"** to instantly add the role to the Kanban tracker.

---

## 2. 📄 Pillar 2 — CV Intelligence & RAG Core
### 💡 Purpose
To personalize career coaching, the platform needs to "understand" the candidate. The **CV Intelligence** system parses uploaded resume documents, segments them into searchable logical chunks, vectorizes them on the client side, and performs an automated audit recommending improvements.

### ⚙️ Inner Workings
1. **Multi-Format Ingestion**: Supports `.pdf`, `.docx`, and `.txt` files.
2. **Extraction Engine**: 
   - PDFs are parsed using `pdf-parse` server-side to extract text.
   - DOCX files are compiled to text using `mammoth`.
   - Text files are processed directly using the standard file reader APIs.
3. **CV Section Chunking**: The server-side code splits the raw text into sections based on typical headers: *Summary, Experience, Education, Skills, Projects, and Certifications*.
4. **Client-Side TF-IDF Embedding**: The chunks are returned to the client where a custom Vectorizer [tfidf.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/lib/tfidf.ts) converts chunks into TF-IDF floating-point vectors. This creates a lightweight, local vector database inside the client's application state (persisted in Supabase or LocalStorage).
5. **AI Quality Audit**: The uploaded text is evaluated by Gemini across five domains:
   - **Content Clarity**: Readability and phrasing.
   - **Keyword Optimization**: Matches against popular industry tags.
   - **Quantified Impact**: Verifying if accomplishments mention metrics (e.g., *"increased sales by 20%"*).
   - **Formatting & Grammar**: Cleanliness check.
   - **Completeness**: Checking for missing standard blocks.

### 📂 Code Locations
- **Frontend View**: [ProfileView.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/ProfileView.tsx)
- **API File Parser**: [/api/parse-cv/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/parse-cv/route.ts)
- **API Audit Reviewer**: [/api/analyze-cv/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/analyze-cv/route.ts)
- **TF-IDF Vector Library**: [tfidf.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/lib/tfidf.ts)

### 🖱️ How to Interact
1. Navigate to the **Profile & CV** tab.
2. Drag and drop your CV file, or click to select a file from your system.
3. Once parsed, review your parsed chunks in the **"CV Chunks"** tab to see how the system split your file.
4. Click **"Analyze CV Quality"** to read the Gemini-generated audit report. It will give you an overall rating and detailed suggestions on what phrases to rewrite.
5. **In-Platform CV Builder**: If you do not have a CV file, fill out the form fields in the **"Resume Builder"** section. Click **"Generate & Save Resume"** to compile a formatted text CV, which downloads as a text file and automatically loads into the RAG vector engine.

---

## 3. 💬 Pillar 3 — Interactive AI Chat Assistant (RAG)
### 💡 Purpose
Standard LLM chats do not know who you are. The **AI Chat Assistant** acts as a personal career advisor that pulls matching background information from your CV in real-time, grounding every answer in your real experience.

### ⚙️ Inner Workings
1. **Semantic RAG Queries**: When you submit a message, the client-side vector engine tokenizes your query and computes the **Cosine Similarity** between your query vector and all CV chunk vectors.
2. **Context Enrichment**: The top 3 matching chunks (e.g., your Skills chunk, or your Experience chunk) are extracted.
3. **Prompts Grounding**: The assistant sends your prompt along with the extracted chunks to the `/api/chat` endpoint. Gemini is instructed: *"Answer the candidate's query using ONLY the provided CV context. If the answer cannot be found in the context, help them formulate a professional response but note what is missing."*
4. **Streaming Outputs**: The response is streamed back to the client word-by-word for high performance.

### 📂 Code Locations
- **Frontend View**: [ChatView.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/ChatView.tsx)
- **API Handler**: [/api/chat/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/chat/route.ts)
- **System Prompts**: [prompts.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/lib/prompts.ts)

### 🖱️ How to Interact
1. Navigate to the **AI Assistant** tab.
2. Select one of the pre-made shortcut prompt pills (e.g., *"Am I ready for this role?"*, *"Draft a cover letter"*, or *"Review my gaps"*).
3. Alternatively, chat freely: *"Based on my experience, how would I explain my Python skills in an interview?"*
4. Read the streamed response complete with clean markdown formatting, lists, and bold text.

---

## 4. 📋 Pillar 4 — Progress & Goal Tracker
### 💡 Purpose
Organizes the chaotic application process. It offers a visual layout of active jobs, calendar views of interview deadlines, goals checklist, and proactive notifications.

### ⚙️ Inner Workings
1. **Kanban Board**: Drag-and-drop board tracking cards across five stages: `Saved`, `Applied`, `Interviewing`, `Offer`, and `Rejected`. Changing columns triggers state changes and updates local/Supabase storage.
2. **Overdue Goals & Follow-up Notifications**: Automatically scans goals with deadlines. If a deadline has passed, a notification is sent to the global alert system. If a job application has been in the `Applied` column for more than 14 days without an update, the system triggers a follow-up reminder.
3. **Goals System**: Allows users to write custom checklist tasks. Completed items update a visual progress ring and count towards the user's daily activity metric.
4. **Monthly Calendar**: Generates a standard month grid that places markers on dates matching job application submissions and interview appointments.
5. **Activity Heatmap**: Renders a GitHub-like contribution grid showing how many actions (adding jobs, finishing roadmap targets, checking off goals) were executed on each day.

### 📂 Code Locations
- **Frontend View**: [TrackerView.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/TrackerView.tsx)
- **Global Header Notifications**: [Sidebar.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/Sidebar.tsx) (houses the notification bell popover)

### 🖱️ How to Interact
1. Navigate to the **Tracker** tab.
2. Drag cards between columns as your applications progress.
3. Click a card to open the detail modal. Here you can write interview notes, adjust the salary range, set the interview date, or paste the link.
4. Scroll down to add **Goals** (e.g., *"Solve 5 LeetCode questions"*) with deadlines.
5. Look at the **Monthly Calendar** and **Activity Heatmap** at the bottom to gauge your long-term progress.
6. Click the 🔔 bell icon in the top header to view active follow-up nudges or overdue goal notices.

---

## 5. 🗺️ AI Learning Roadmap Builder
### 💡 Purpose
Helps candidates fill skill gaps identified during job matching. It creates a personalized learning pathway to structure study schedules.

### ⚙️ Inner Workings
1. **Gap Gathering**: Reads the user's CV target role and current skills.
2. **AI Curated Plan**: Sends the information to `/api/generate-roadmap` where Gemini 2.5 Flash outputs a structured JSON array representing a 3-month roadmap, complete with weekly goals, study topics, and practical exercise projects.
3. **Interactive Tracking**: The structured data is rendered as checklist items. Checking off a topic calculates overall completion percentage, triggers global application state changes, and automatically registers as a completed goal.

### 📂 Code Locations
- **Frontend View**: [RoadmapView.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/RoadmapView.tsx)
- **API Handler**: [/api/generate-roadmap/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/generate-roadmap/route.ts)

### 🖱️ How to Interact
1. Navigate to the **Roadmap** tab.
2. If no roadmap is set, click **"Generate AI Roadmap"**. Wait a few seconds for Gemini to analyze your CV gaps.
3. Browse the monthly and weekly modules.
4. Check off topics as you learn them. The progress tracker will update in real-time.
5. Click **"Reset Roadmap"** to generate a new path if your target role changes.

---

## 6. 🎤 AI Mock Interview Mode
### 💡 Purpose
Practicing interviews in a low-stakes environment. Candidates get realistic questions based on their CV and target position, followed by evaluations detailing strengths and STAR gaps.

### ⚙️ Inner Workings
1. **Interactive Session**: Conducts a structured session of 8 consecutive questions:
   - **Questions 1–2**: Behavioral / General introduction.
   - **Questions 3–5**: Situational / Problem-solving scenarios.
   - **Questions 6–8**: Technical / Role-specific challenges.
2. **Speech Ingestion (Web Speech API)**: Uses browser-based Speech Recognition so the user can speak their responses out loud.
3. **STAR Evaluation Metrics**: When an answer is submitted, `/api/mock-interview` reviews the text and grades Situation, Task, Action, and Result coverage as either `present`, `vague`, or `missing`.
4. **Scoring & Review**: Calculates individual question scores (0-10) and suggests a professional model answer calibrated to the user's CV context.

### 📂 Code Locations
- **Frontend View**: [MockInterviewView.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/MockInterviewView.tsx)
- **API Handler**: [/api/mock-interview/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/mock-interview/route.ts)

### 🖱️ How to Interact
1. Navigate to the **Mock Interview** tab (accessible from the sidebar).
2. Input your target role and select your difficulty: **Easy**, **Medium**, or **Hard**. Click **"Start Interview"**.
3. Read the prompt. You can click **"🎙️ Speak Answer"** and talk into your microphone, or type your answer in the text box.
4. Click **"Submit Answer"**. Review the AI strengths, improvements, and STAR checklist tags.
5. Click **"Show Model Answer"** to see what a perfect response would look like.
6. Click **"Next Question"**. After 8 questions, look at your overall interview score dashboard recap.

---

## 7. 💰 Salary Negotiation Coach
### 💡 Purpose
Prevents candidates from leaving money on the table by providing concrete numbers, market ranges, and word-for-word templates to address recruiter pushback.

### ⚙️ Inner Workings
1. **Context-Rich Stream**: Takes inputs from the user's CV summary, target role, and text detailing the current offer, feeding them to `/api/salary-coach`.
2. **Strict Structure Rules**: Gemini streams the response as a markdown chat message structured under five specific sections:
   - `## 📊 Offer Analysis`: Reviewing the base salary, equity, and bonus.
   - `## 💰 Market Rate Research`: Realistic ranges from Levels.fyi/Glassdoor.
   - `## 🎯 Recommended Counter`: A specific, non-timid counter-offer number.
   - `## 📝 Script to Use`: Exact templates (emails/verbal scripts) the candidate can copy.
   - `## ⚠️ Watch Out For`: Signposts regarding sign-on bonuses, clawbacks, and benefits.

### 📂 Code Locations
- **Frontend View**: [SalaryCoachView.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/SalaryCoachView.tsx)
- **API Handler**: [/api/salary-coach/route.ts](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/app/api/salary-coach/route.ts)

### 🖱️ How to Interact
1. Navigate to the **Salary Coach** tab.
2. In the top text box, paste your current offer details (e.g. *"React Dev at TechCorp, Dhaka: 60k BDT/mo base, festival bonus, medical"*).
3. Click one of the starter questions (e.g., *"How do I counter?"*, *"The company said it is non-negotiable"*) or type your own question.
4. Copy the scripts generated under **"Script to Use"** to draft your replies.

---

## 8. ⌨️ Global Command Palette
### 💡 Purpose
A keyboard-driven controller allowing power users to navigate the app, execute actions, and prompt the AI without clicking around the UI.

### ⚙️ Inner Workings
1. **Shortcut Listener**: Watches for the global key combination: `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux).
2. **Commands Registry**: Matches queries against registered actions across three categories:
   - **Navigation**: Instant tab changes.
   - **Actions**: Triggering job searches or resetting roadmaps.
   - **Presets**: Injects pre-written prompts directly into the AI Chat state and opens the Chat window.

### 📂 Code Locations
- **Component**: [CommandPalette.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/CommandPalette.tsx)

### 🖱️ How to Interact
1. Press `Cmd+K` (or `Ctrl+K` on Windows) from anywhere in the application.
2. Type in the search box: e.g. *"roadmap"* or *"chat"*.
3. Use your keyboard's **Up/Down arrows** to navigate options.
4. Press **Enter** to trigger the selected navigation, action, or AI preset prompt.
5. Press **ESC** to exit the palette.

---

## 9. 🚀 Onboarding Flow
### 💡 Purpose
Introduces new users to the app and configures their career details on their first visit.

### ⚙️ Inner Workings
1. **Condition Check**: Runs when the page mounts. If the localStorage onboarding key is false, no CV is present, and there are no active applications, the modal overlay opens.
2. **Step Setup**:
   - **Step 1: Welcome & File Upload**: Prompts the user to drag and drop their resume. Successful file upload parses their text via `/api/parse-cv`, extracts their name, and proceeds to the next step.
   - **Step 2: Preferences**: Gathers target role title, target location, experience levels, and target salaries.
   - **Step 3: Completion**: Saves configurations to the application state context and closes.

### 📂 Code Locations
- **Component**: [Onboarding.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/Onboarding.tsx)

### 🖱️ How to Interact
1. The onboarding overlay displays automatically on your first visit.
2. Complete Step 1 by dragging in a PDF or DOCX resume.
3. Fill in your role preferences and click **"Get Started"** to access your dashboard.

---

## 10. 🛡️ Supabase Syncing & Authentication
### 💡 Purpose
Ensures users do not lose their data when clearing browser histories or changing devices. It supports both Supabase database syncing and local Guest Mode.

### ⚙️ Inner Workings
1. **Authentication State Listener**: The global state provider `store.tsx` monitors auth states.
   - **Supabase Auth Mode**: Active sessions load files, profile parameters, Kanban lists, and check goals from Supabase tables (`profiles`, `cv_chunks`, `applications`, `goals`). 
   - **Guest Mode**: Disables online features. Reads and writes all state attributes directly to the browser's `localStorage` as a fallback.
2. **Synchronized State Reducer**: Dispatch events (e.g. `ADD_APPLICATION`, `TOGGLE_GOAL`, `SET_PROFILE`) update the React context and trigger corresponding SQL calls (`upsert`, `delete`) in the background to keep the DB in sync.

### 📂 Code Locations
- **Global Context Provider**: [store.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/lib/store.tsx)
- **Auth Interface UI**: [Auth.tsx](file:///Users/md.isfakiqbalchowdhury/Documents/project/hackathon/src/components/Auth.tsx)
- **Database Schema**: [supabase_schema.sql](file:///Users/md.isfakiqbalchowdhury/supabase_schema.sql)

### 🖱️ How to Interact
1. Use the login screen on application startup.
2. Sign up with an email and password or log in to sync all changes to the cloud database.
3. Alternatively, click **"Continue as Guest"** to work locally in Guest Mode. You can log in later to sync your local data to your account.

---

## 💡 Quick Tips: How to Verify Everything is Working
- **AI Credentials**: Ensure you have loaded your `GEMINI_API_KEY` and `SERPER_API_KEY` into your `.env.local` file. If they are missing, AI chats and job searches will fall back to mockup responses or return errors.
- **RAG Log Verification**: Open your browser's inspection console while chatting with the AI. You will see logs detailing which chunks of your CV were selected and their similarity scores, confirming that RAG is working correctly.
- **Supabase Connectivity**: If you are in authenticated mode, check your network tab. You should see REST requests executing `POST` and `PATCH` commands to your Supabase tables as you edit your profile or move cards.
- **Database Schema Setup**: Ensure your Supabase database has been initialized with the tables specified in `supabase_schema.sql` so that profile updates sync successfully.
