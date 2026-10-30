/**
 * SkillMatch IT - Main Application Controller
 * Professional Clean Job Portal Interface
 */
(function () {
  const data = window.SKILLMATCH_DATA;
  const engine = window.SkillMatchEngine;

  // Application State
  const state = {
    userSkills: ["python", "sql", "git", "rest api"],
    selectedRole: "ALL",
    filterExperience: "ALL",
    searchJobText: "",
    skillInputText: "",
    activeTab: "matcher", // "matcher" | "careers" | "skills"
    matchedResults: [],
    prediction: null,
    readiness: {},
    isBackendLive: false,
    selectedJobForModal: null,
  };

  // Quick Presets
  const PRESETS = [
    { label: "💻 Software Dev (G1)", role: "G1", skills: ["python", "sql", "git", "rest api", "docker"] },
    { label: "🗄️ Database Admin (G2)", role: "G2", skills: ["oracle", "sql", "postgresql", "database administration", "ms sql"] },
    { label: "📐 System Analyst (G3)", role: "G3", skills: ["uml", "sql", "system analysis", "requirement gathering", "business analysis"] },
    { label: "🛠️ IT Support (G4)", role: "G4", skills: ["windows", "troubleshooting", "hardware", "active directory", "basic networking"] },
    { label: "🖥️ System Admin (G5)", role: "G5", skills: ["linux", "windows server", "network security", "cisco", "vmware"] },
    { label: "🌐 Web Developer (G6)", role: "G6", skills: ["html5", "css3", "javascript", "react", "tailwind", "next.js"] },
    { label: "📋 IT PM (G7)", role: "G7", skills: ["agile", "scrum", "jira", "project management", "sdlc"] },
    { label: "🎨 Content Creator (G8)", role: "G8", skills: ["canva", "tiktok", "video editing", "photoshop", "social media"] },
  ];

  // Initialize
  async function init() {
    renderNavigation();
    renderPresets();
    setupSkillInput();
    await checkBackendHealth();
    await updateRecommendations();
    renderCareersDirectory();
    renderSkillsDirectory();
  }

  // Check if FastAPI is running at http://127.0.0.1:8000
  async function checkBackendHealth() {
    const statusPill = document.getElementById("backendStatusPill");
    try {
      const res = await fetch("http://127.0.0.1:8000/docs", { method: "HEAD", mode: "no-cors" });
      state.isBackendLive = true;
      if (statusPill) {
        statusPill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-semibold text-emerald-700">FastAPI Live (Port 8000)</span>
        `;
        statusPill.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200";
      }
    } catch (e) {
      state.isBackendLive = false;
      if (statusPill) {
        statusPill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <span class="text-xs font-semibold text-blue-700">Client Engine (115 Jobs)</span>
        `;
        statusPill.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200";
      }
    }
  }

  // Navigation tabs
  function renderNavigation() {
    const navItems = [
      { id: "matcher", label: "ค้นหาตำแหน่งงาน", icon: "fa-bullseye" },
      { id: "careers", label: "8 กลุ่มอาชีพ มคอ.2", icon: "fa-compass" },
      { id: "skills", label: "คลังทักษะไอที (444)", icon: "fa-layer-group" },
    ];

    const navContainer = document.getElementById("mainNav");
    if (!navContainer) return;

    navContainer.innerHTML = navItems
      .map(
        (tab) => `
        <button onclick="window.App.switchTab('${tab.id}')"
          class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition ${
            state.activeTab === tab.id
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }">
          <i class="fa-solid ${tab.icon}"></i>
          <span>${tab.label}</span>
        </button>
      `
      )
      .join("");
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    renderNavigation();

    document.getElementById("tabViewMatcher").classList.toggle("hidden", tabId !== "matcher");
    document.getElementById("tabViewCareers").classList.toggle("hidden", tabId !== "careers");
    document.getElementById("tabViewSkills").classList.toggle("hidden", tabId !== "skills");
  }

  // Quick presets buttons
  function renderPresets() {
    const container = document.getElementById("presetButtons");
    if (!container) return;

    container.innerHTML = PRESETS.map(
      (p) => `
      <button onclick="window.App.applyPreset('${p.role}')"
        class="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 font-medium text-slate-600 shadow-2xs transition active:scale-95">
        ${p.label}
      </button>
    `
    ).join("");
  }

  function applyPreset(roleKey) {
    const p = PRESETS.find((x) => x.role === roleKey);
    if (!p) return;
    state.userSkills = [...p.skills];
    state.selectedRole = p.role;
    const roleSelect = document.getElementById("roleSelect");
    if (roleSelect) roleSelect.value = p.role;
    updateRecommendations();
  }

  // Setup Autocomplete Skill input
  function setupSkillInput() {
    const input = document.getElementById("skillInput");
    const suggestionBox = document.getElementById("skillSuggestions");
    if (!input || !suggestionBox) return;

    input.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        suggestionBox.classList.add("hidden");
        return;
      }

      const normQ = engine.normalizeSkill(q);
      const matches = data.canonicalSkills
        .filter((s) => s.includes(normQ) && !state.userSkills.includes(s))
        .slice(0, 8);

      if (matches.length === 0) {
        suggestionBox.classList.add("hidden");
        return;
      }

      suggestionBox.innerHTML = matches
        .map(
          (s) => `
          <button type="button" onclick="window.App.addSkill('${s}')"
            class="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between">
            <span>${s}</span>
            <span class="text-[10px] text-slate-400"><i class="fa-solid fa-plus"></i> เพิ่ม</span>
          </button>
        `
        )
        .join("");

      suggestionBox.classList.remove("hidden");
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = input.value.trim();
        if (val) {
          addSkill(val);
          input.value = "";
          suggestionBox.classList.add("hidden");
        }
      }
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
        suggestionBox.classList.add("hidden");
      }
    });
  }

  function addSkill(skillName) {
    const norm = engine.normalizeSkill(skillName);
    if (norm && !state.userSkills.includes(norm)) {
      state.userSkills.push(norm);
      updateRecommendations();
    }
    const input = document.getElementById("skillInput");
    if (input) input.value = "";
    const box = document.getElementById("skillSuggestions");
    if (box) box.classList.add("hidden");
  }

  function removeSkill(skillName) {
    state.userSkills = state.userSkills.filter((s) => s !== skillName);
    updateRecommendations();
  }

  function clearAllSkills() {
    state.userSkills = [];
    updateRecommendations();
  }

  // Render selected skills chips
  function renderSelectedSkills() {
    const container = document.getElementById("selectedSkillsTray");
    const countBadge = document.getElementById("skillsCountBadge");
    if (!container) return;

    if (countBadge) {
      countBadge.textContent = state.userSkills.length;
    }

    if (state.userSkills.length === 0) {
      container.innerHTML = `
        <span class="text-xs text-slate-400 italic">ยังไม่ได้เลือกทักษะ (พิมพ์ในช่องค้นหาหรือคลิกปุ่มตัวอย่างด้านบน)</span>
      `;
      return;
    }

    container.innerHTML = state.userSkills
      .map(
        (s) => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <span>${s}</span>
          <button type="button" onclick="window.App.removeSkill('${s}')" class="text-blue-400 hover:text-blue-700">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>
      `
      )
      .join("");
  }

  // Main Calculation & Recommendation Updater
  async function updateRecommendations() {
    renderSelectedSkills();

    const res = await engine.recommend(state.userSkills, state.selectedRole);
    state.prediction = res.prediction;
    state.matchedResults = res.jobs;
    state.readiness = res.readiness;

    renderPredictionBanner();
    renderCareerReadinessSidebar();
    renderJobList();
  }

  // Render AI Prediction Banner
  function renderPredictionBanner() {
    const container = document.getElementById("predictionBanner");
    if (!container) return;

    if (!state.prediction || state.userSkills.length === 0) {
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");
    const pred = state.prediction;
    const roleMeta = data.curriculumRoles[pred.predictedRoleId] || {};

    container.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md">
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-xl shrink-0">
            🎯
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
                ${pred.predictedRoleId}
              </span>
              <span class="text-xs text-blue-100 font-medium">ทำนายโดย Machine Learning (TQF:HEd)</span>
            </div>
            <h3 class="text-base md:text-lg font-bold mt-0.5">
              ${pred.predictedTitle} <span class="font-normal text-sm text-blue-200">(${pred.predictedEnTitle})</span>
            </h3>
            <p class="text-xs text-blue-100 mt-0.5 line-clamp-1">
              ${roleMeta.desc || "สายงานที่ทักษะของผู้ใช้มีความสอดคล้องและมีโอกาสประสบความสำเร็จสูงสุด"}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end md:self-center shrink-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
          <div class="text-right">
            <p class="text-[10px] text-blue-200 font-medium uppercase tracking-wider">Confidence</p>
            <p class="text-sm font-black font-heading">${pred.confidenceScore}%</p>
          </div>
          <div class="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center text-xs font-bold">
            <i class="fa-solid fa-chart-line"></i>
          </div>
        </div>
      </div>
    `;
  }

  // Render Career Readiness Sidebar (Left Column)
  function renderCareerReadinessSidebar() {
    const container = document.getElementById("careerReadinessList");
    if (!container) return;

    const roles = Object.entries(data.curriculumRoles);

    container.innerHTML = roles
      .map(([id, info]) => {
        const ready = state.readiness[id] || { percent: 0, matched: 0, total: 0 };
        const isSelected = state.selectedRole === id;
        const isPredicted = state.prediction && state.prediction.predictedRoleId === id;

        let badgeColor = "bg-slate-100 text-slate-600";
        let barColor = "bg-slate-400";
        if (ready.percent >= 80) {
          badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
          barColor = "bg-emerald-500";
        } else if (ready.percent >= 50) {
          badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
          barColor = "bg-blue-500";
        }

        return `
        <div onclick="window.App.filterByRole('${id}')"
          class="cursor-pointer p-3 rounded-xl border transition ${
            isSelected
              ? "bg-blue-50/80 border-blue-300 shadow-xs"
              : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50"
          }">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-slate-900 line-clamp-1">${id}: ${info.title}</span>
              ${isPredicted ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">AI แนะนำ</span>' : ""}
            </div>
            <span class="text-xs font-bold font-heading px-1.5 py-0.5 rounded border ${badgeColor}">
              ${ready.percent}%
            </span>
          </div>

          <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1">
            <div class="${barColor} h-full transition-all duration-300" style="width: ${ready.percent}%"></div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>${info.en_title}</span>
            <span>${ready.matched}/${ready.total} Core Skills</span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // Filter jobs by Role
  function filterByRole(roleId) {
    if (state.selectedRole === roleId) {
      state.selectedRole = "ALL";
    } else {
      state.selectedRole = roleId;
    }
    const sel = document.getElementById("roleSelect");
    if (sel) sel.value = state.selectedRole;
    updateRecommendations();
  }

  // Render Job Cards List (Right Column)
  function renderJobList() {
    const container = document.getElementById("jobsListContainer");
    const countSpan = document.getElementById("jobResultCount");
    if (!container) return;

    let jobs = state.matchedResults;

    // Filter by text search
    if (state.searchJobText) {
      const q = state.searchJobText.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          (j.skills && j.skills.some((s) => s.toLowerCase().includes(q)))
      );
    }

    if (countSpan) {
      countSpan.textContent = jobs.length;
    }

    if (jobs.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 text-center">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-3">
            🔍
          </div>
          <h4 class="text-base font-bold text-slate-800">ไม่พบตำแหน่งงานที่ตรงกับเงื่อนไข</h4>
          <p class="text-xs text-slate-400 max-w-sm mt-1">
            ลองปรับเปลี่ยนทักษะที่เลือก หรือคลิก "แสดงทุกสายงาน" เพื่อค้นหาโอกาสที่หลากหลายขึ้น
          </p>
          <button onclick="window.App.resetFilters()"
            class="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition">
            แสดงงานทั้งหมด
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = jobs
      .map((job) => {
        let badgeClass = "badge-match-low";
        let barClass = "bg-slate-400";
        if (job.matchPercentage >= 70) {
          badgeClass = "badge-match-high";
          barClass = "bg-emerald-500";
        } else if (job.matchPercentage >= 40) {
          badgeClass = "badge-match-mid";
          barClass = "bg-amber-500";
        }

        return `
        <div class="job-card bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <!-- Top Row: Role Badge & Match Percentage Ring -->
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  ${job.curriculumRoleId}: ${job.curriculumRoleTitle}
                </span>
                <span class="text-xs text-slate-400">
                  <i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${job.province}
                </span>
              </div>
              <h3 class="text-base md:text-lg font-bold text-slate-900 leading-snug hover:text-blue-600 transition cursor-pointer"
                onclick="window.App.openJobModal('${job.jobId}')">
                ${job.title}
              </h3>
              <p class="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <i class="fa-regular fa-building text-slate-400"></i> ${job.company}
              </p>
            </div>

            <!-- Match Score Box -->
            <div class="text-right shrink-0">
              <div class="inline-flex flex-col items-end px-3 py-1.5 rounded-xl border ${badgeClass}">
                <span class="text-[10px] font-bold uppercase tracking-wider">Skill Match</span>
                <span class="text-xl font-black font-heading leading-tight">${job.matchPercentage}%</span>
              </div>
            </div>
          </div>

          <!-- Matched vs Missing Skills Breakdown -->
          <div class="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <!-- Matched Skills -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-semibold text-emerald-700 shrink-0">
                <i class="fa-solid fa-check text-emerald-600 mr-0.5"></i> ทักษะที่ตรง (${job.matchedSkills.length}):
              </span>
              ${
                job.matchedSkills.length > 0
                  ? job.matchedSkills
                      .map(
                        (s) => `
                    <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[11px] border border-emerald-200">
                      ${s}
                    </span>
                  `
                      )
                      .join("")
                  : '<span class="text-slate-400 text-[11px] italic">ไม่มี</span>'
              }
            </div>

            <!-- Skill Gap (Missing) -->
            ${
              job.missingSkills.length > 0
                ? `
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-semibold text-slate-500 shrink-0">
                  <i class="fa-solid fa-lightbulb text-amber-500 mr-0.5"></i> ทักษะที่ต้องเติม (${job.missingSkills.length}):
                </span>
                ${job.missingSkills
                  .slice(0, 6)
                  .map(
                    (s) => `
                    <span class="px-2 py-0.5 rounded bg-slate-50 text-slate-600 font-mono text-[11px] border border-dashed border-slate-300">
                      + ${s}
                    </span>
                  `
                  )
                  .join("")}
                ${job.missingSkills.length > 6 ? `<span class="text-[10px] text-slate-400">+${job.missingSkills.length - 6} อีก</span>` : ""}
              </div>
            `
                : ""
            }
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span class="text-slate-400 font-medium">
              <i class="fa-solid fa-briefcase mr-1 text-slate-400"></i> ${job.experienceLevel || "ไม่ระบุ"}
            </span>

            <div class="flex items-center gap-2">
              <button onclick="window.App.openJobModal('${job.jobId}')"
                class="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition">
                ดูรายละเอียด
              </button>
              <a href="${job.applyUrl}" target="_blank" rel="noopener noreferrer"
                class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition flex items-center gap-1.5">
                <span>สมัครงาน</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              </a>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // Open Job Detail Modal
  function openJobModal(jobId) {
    const job = data.jobs.find((j) => j.JobID === jobId);
    if (!job) return;

    state.selectedJobForModal = job;
    const modal = document.getElementById("jobDetailModal");
    const content = document.getElementById("jobModalContent");
    if (!modal || !content) return;

    const matched = [];
    const missing = [];
    const normUser = new Set(engine.normalizeSkillsList(state.userSkills));
    const jobSkills = job.normalized_skills || [];

    for (const js of jobSkills) {
      if (normUser.has(js)) matched.push(js);
      else missing.push(js);
    }
    const matchPct = Math.round((matched.length / (jobSkills.length || 1)) * 100);

    content.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                ${job.CurriculumRoleID}: ${job.CurriculumRoleTitle} (${job.CurriculumRoleEN})
              </span>
              <span class="text-xs text-slate-400">รหัสงาน: ${job.JobID}</span>
            </div>
            <h2 class="text-xl md:text-2xl font-bold text-slate-900">${job.Title}</h2>
            <p class="text-sm text-slate-600 font-semibold mt-0.5 flex items-center gap-2">
              <i class="fa-regular fa-building text-slate-400"></i> ${job.Company}
              <span class="text-slate-300">•</span>
              <i class="fa-solid fa-location-dot text-slate-400"></i> ${job.Province}
            </p>
          </div>

          <div class="text-right shrink-0">
            <div class="px-4 py-2 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800">
              <p class="text-[10px] font-bold uppercase tracking-wider">Skill Match</p>
              <p class="text-2xl font-black font-heading">${matchPct}%</p>
            </div>
          </div>
        </div>

        <!-- Job Details Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <p class="text-slate-400 font-medium">เงินเดือน</p>
            <p class="font-bold text-slate-800 mt-0.5">${job.Salary || "ตามโครงสร้างบริษัท"}</p>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <p class="text-slate-400 font-medium">ระดับประสบการณ์</p>
            <p class="font-bold text-slate-800 mt-0.5">${job.ExperienceLevel || "ยินดีรับเด็กจบใหม่"}</p>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <p class="text-slate-400 font-medium">อายุงานที่ต้องการ</p>
            <p class="font-bold text-slate-800 mt-0.5">${job.YearsOfExperience || "0-2"} ปี</p>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <p class="text-slate-400 font-medium">มาตรฐานหลักสูตร</p>
            <p class="font-bold text-slate-800 mt-0.5">มคอ.2 IT สาขา</p>
          </div>
        </div>

        <!-- Skills Breakdown -->
        <div class="space-y-3">
          <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i class="fa-solid fa-dna text-blue-600"></i>
            <span>การวิเคราะห์ทักษะ (Skill Gap Analysis)</span>
          </h4>

          <div class="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
            <p class="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <i class="fa-solid fa-circle-check text-emerald-600"></i> ทักษะที่คุณมีตรงกับตำแหน่งนี้ (${matched.length})
            </p>
            <div class="flex flex-wrap gap-1.5">
              ${
                matched.length > 0
                  ? matched.map((s) => `<span class="px-2.5 py-1 rounded-lg bg-white text-emerald-800 font-mono text-xs font-medium border border-emerald-200 shadow-2xs">${s}</span>`).join("")
                  : '<span class="text-xs text-slate-400 italic">ยังไม่มีทักษะที่ตรงกัน</span>'
              }
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1.5">
            <p class="text-xs font-bold text-amber-800 flex items-center gap-1">
              <i class="fa-solid fa-graduation-cap text-amber-600"></i> ทักษะที่แนะนำให้เรียนรู้เพิ่มเติมเพื่อเพิ่มโอกาสรับเข้าทำงาน (${missing.length})
            </p>
            <div class="flex flex-wrap gap-1.5">
              ${
                missing.length > 0
                  ? missing.map((s) => `<span class="px-2.5 py-1 rounded-lg bg-white text-amber-900 font-mono text-xs font-medium border border-amber-200 shadow-2xs">+ ${s}</span>`).join("")
                  : '<span class="text-xs text-emerald-600 font-bold">🎉 คุณมีทักษะครบถ้วนตามที่ตำแหน่งงานต้องการ 100%!</span>'
              }
            </div>
          </div>
        </div>

        <!-- Responsibilities -->
        <div class="space-y-2 text-xs">
          <h4 class="text-sm font-bold text-slate-900">ลักษณะงานและความรับผิดชอบ</h4>
          <p class="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
            ${job.Responsibilities || "ปฏิบัติงานตามที่ได้รับมอบหมายตามตำแหน่งหน้าที่"}
          </p>
        </div>

        <!-- Apply CTA -->
        <div class="flex items-center justify-between pt-4 border-t border-slate-200">
          <button onclick="window.App.closeJobModal()"
            class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50">
            ปิดหน้าต่าง
          </button>
          <a href="${job.ApplyURL}" target="_blank" rel="noopener noreferrer"
            class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2">
            <span>ส่งใบสมัครงาน (JobsDB)</span>
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `;

    modal.classList.remove("hidden");
  }

  function closeJobModal() {
    const modal = document.getElementById("jobDetailModal");
    if (modal) modal.classList.add("hidden");
  }

  function resetFilters() {
    state.selectedRole = "ALL";
    state.searchJobText = "";
    const roleSelect = document.getElementById("roleSelect");
    if (roleSelect) roleSelect.value = "ALL";
    const searchInput = document.getElementById("jobSearchInput");
    if (searchInput) searchInput.value = "";
    updateRecommendations();
  }

  // Render Tab 2: 8 Careers Directory
  function renderCareersDirectory() {
    const container = document.getElementById("careersDirectoryContainer");
    if (!container) return;

    const roles = Object.entries(data.curriculumRoles);

    container.innerHTML = roles
      .map(([id, info]) => {
        const coreSkills = info.core_skills || [];
        const relatedJobs = data.jobs.filter((j) => j.CurriculumRoleID === id);

        return `
        <div class="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                ${id}
              </span>
              <h3 class="text-lg font-bold text-slate-900 mt-1">${info.title}</h3>
              <p class="text-xs text-slate-400 font-heading">${info.en_title}</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              ${relatedJobs.length} ตำแหน่งงาน
            </span>
          </div>

          <p class="text-xs text-slate-600 leading-relaxed">${info.desc}</p>

          <div class="space-y-1.5 pt-2 border-t border-slate-100">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Core Curriculum Skills:</p>
            <div class="flex flex-wrap gap-1">
              ${coreSkills.map((s) => `<span class="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px]">${s}</span>`).join("")}
            </div>
          </div>

          <button onclick="window.App.exploreRoleInMatcher('${id}')"
            class="w-full py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 transition">
            ดูตำแหน่งงานสายนี้ (${relatedJobs.length})
          </button>
        </div>
      `;
      })
      .join("");
  }

  function exploreRoleInMatcher(roleId) {
    state.selectedRole = roleId;
    switchTab("matcher");
    const roleSelect = document.getElementById("roleSelect");
    if (roleSelect) roleSelect.value = roleId;
    updateRecommendations();
  }

  // Render Tab 3: 444 Skills Directory
  function renderSkillsDirectory() {
    const container = document.getElementById("skillsDirectoryContainer");
    if (!container) return;

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-500">
            รายการ <strong>444 ทักษะมาตรฐาน (Canonical Skills)</strong> ที่ผ่านการแปลงคำพ้อง (Normalization) จากตำแหน่งงานจริงในไทย
          </p>
          <input type="text" id="skillsDirectoryFilter" placeholder="ค้นหาทักษะ..."
            class="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500" />
        </div>

        <div id="skillsPillGrid" class="flex flex-wrap gap-2 max-h-[600px] overflow-y-auto p-4 bg-white rounded-2xl border border-slate-200">
          ${data.canonicalSkills
            .map(
              (s) => `
            <button onclick="window.App.toggleSkillFromDirectory('${s}')"
              class="skill-chip px-3 py-1 rounded-xl text-xs font-medium border ${
                state.userSkills.includes(s)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
              }">
              ${state.userSkills.includes(s) ? "✓ " : "+ "}${s}
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    const filterInput = document.getElementById("skillsDirectoryFilter");
    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        const buttons = document.querySelectorAll("#skillsPillGrid button");
        buttons.forEach((btn) => {
          btn.style.display = btn.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }
  }

  function toggleSkillFromDirectory(skillName) {
    if (state.userSkills.includes(skillName)) {
      removeSkill(skillName);
    } else {
      addSkill(skillName);
    }
    renderSkillsDirectory();
  }

  // Global Exports
  window.App = {
    init,
    switchTab,
    applyPreset,
    addSkill,
    removeSkill,
    clearAllSkills,
    filterByRole,
    openJobModal,
    closeJobModal,
    resetFilters,
    exploreRoleInMatcher,
    toggleSkillFromDirectory,
  };

  // Run on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
