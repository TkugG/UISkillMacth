/**
 * SkillMatch IT - Matching Engine & Client-Side Predictor
 * Implements Stage 1 Career Prediction & Stage 2 Skill Match Percentage (TQF:HEd IT Standards)
 */
(function (window) {
  const data = window.SKILLMATCH_DATA;

  // 1. Normalize Skill using Synonyms Table
  function normalizeSkill(raw) {
    if (!raw) return "";
    let s = raw.trim().toLowerCase();
    s = s.replace(/^[\["'`]+|[\]"'`]+$/g, "").trim();
    if (data.synonyms && data.synonyms[s]) {
      return data.synonyms[s];
    }
    return s;
  }

  function normalizeSkillsList(list) {
    if (!list) return [];
    const normalized = list.map(normalizeSkill).filter(Boolean);
    return Array.from(new Set(normalized));
  }

  // 2. Client-side Career Predictor (Stage 1 ML Simulation / Weighted Voting)
  function predictCareerRole(userSkills) {
    if (!userSkills || userSkills.length === 0) return null;
    const normSkills = new Set(userSkills.map(normalizeSkill));

    const scores = {};
    for (const [roleId, roleInfo] of Object.entries(data.curriculumRoles)) {
      scores[roleId] = {
        roleId,
        title: roleInfo.title,
        en_title: roleInfo.en_title,
        matchedCoreCount: 0,
        coreSkills: roleInfo.core_skills || [],
        jobSkillMatches: 0,
      };

      for (const core of roleInfo.core_skills || []) {
        if (normSkills.has(normalizeSkill(core))) {
          scores[roleId].matchedCoreCount += 2.0;
        }
      }
    }

    for (const job of data.jobs) {
      const roleId = job.CurriculumRoleID;
      if (!scores[roleId]) continue;
      const jobSkills = job.normalized_skills || [];
      for (const s of jobSkills) {
        if (normSkills.has(s)) {
          scores[roleId].jobSkillMatches += 1;
        }
      }
    }

    const ranked = Object.values(scores).map((item) => {
      const totalScore = item.matchedCoreCount * 3 + item.jobSkillMatches;
      return {
        ...item,
        totalScore,
      };
    });

    ranked.sort((a, b) => b.totalScore - a.totalScore);
    const top = ranked[0];
    const roleMeta = data.curriculumRoles[top.roleId] || {};

    return {
      predictedRoleId: top.roleId,
      predictedTitle: roleMeta.title || top.title,
      predictedEnTitle: roleMeta.en_title || top.en_title,
      confidenceScore: top.totalScore > 0 ? Math.min(95, Math.round(50 + top.totalScore * 2)) : 50,
      allRanked: ranked,
    };
  }

  // 3. Stage 2 Matching: Skill Match Percentage = |S_user ∩ S_job| / |S_job| * 100
  // With secondary sorting on matched.length (Tie-Breaker)
  function matchJobs(userSkills, targetRole = "") {
    const normUser = new Set(normalizeSkillsList(userSkills));
    if (normUser.size === 0) return [];

    let pool = data.jobs;
    if (targetRole && targetRole !== "ALL") {
      pool = pool.filter((j) => j.CurriculumRoleID === targetRole);
    }

    const results = [];

    for (const job of pool) {
      const jobSkills = job.normalized_skills || [];
      if (jobSkills.length === 0) continue;

      const matched = [];
      const missing = [];

      for (const js of jobSkills) {
        if (normUser.has(js)) {
          matched.push(js);
        } else {
          missing.push(js);
        }
      }

      const matchPct = Math.round((matched.length / jobSkills.length) * 100);

      results.push({
        jobId: job.JobID,
        title: job.Title,
        company: job.Company,
        province: job.Province,
        salary: job.Salary,
        experienceLevel: job.ExperienceLevel,
        curriculumRoleId: job.CurriculumRoleID,
        curriculumRoleTitle: job.CurriculumRoleTitle,
        curriculumRoleEN: job.CurriculumRoleEN,
        skills: jobSkills,
        matchedSkills: matched,
        missingSkills: missing,
        matchPercentage: matchPct,
        applyUrl: job.ApplyURL,
      });
    }

    // Sort descending by matchPercentage, then by number of matched skills (Tie-breaker)
    results.sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage;
      }
      return b.matchedSkills.length - a.matchedSkills.length;
    });

    return results;
  }

  // 4. Career Readiness Calculation: |S_user ∩ S_core| / |S_core| * 100
  // Classified into 3 TQF:HEd Levels: Advanced (>=80%), Job-Ready (>=50%), Developing (<50%)
  function calculateReadiness(userSkills) {
    const normUser = new Set(normalizeSkillsList(userSkills));
    const readiness = {};

    for (const [roleId, roleInfo] of Object.entries(data.curriculumRoles)) {
      const core = (roleInfo.core_skills || []).map(normalizeSkill);
      if (core.length === 0) {
        readiness[roleId] = { percent: 0, matched: 0, total: 0, level: "Developing" };
        continue;
      }

      const matchedCount = core.filter((c) => normUser.has(c)).length;
      const pct = Math.round((matchedCount / core.length) * 100);

      let level = "Developing (ระดับเริ่มต้น)";
      if (pct >= 80) level = "Advanced (ระดับเชี่ยวชาญ)";
      else if (pct >= 50) level = "Job-Ready (ระดับพร้อมทำงาน)";

      readiness[roleId] = {
        roleId,
        title: roleInfo.title,
        enTitle: roleInfo.en_title,
        percent: pct,
        matched: matchedCount,
        total: core.length,
        level,
      };
    }

    return readiness;
  }

  // 5. Unified Service: Supports FastAPI Data Contract + Seamless Client Fallback
  async function recommend(userSkills, targetRole = "") {
    const normSkills = normalizeSkillsList(userSkills);
    if (normSkills.length === 0) {
      return {
        prediction: null,
        jobs: [],
        readiness: calculateReadiness([]),
        source: "empty",
      };
    }

    // Try live FastAPI
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      // Support FastAPI Request Schema: preference / target_career
      const res = await fetch("http://127.0.0.1:8000/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: normSkills,
          preference: targetRole && targetRole !== "ALL" ? targetRole : "",
          target_career: targetRole && targetRole !== "ALL" ? targetRole : "",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const analysis = json.target_career_analysis || {};
        const predRoleId = analysis.predicted_role_id || json.predicted_role_id || "G1";
        const roleMeta = data.curriculumRoles[predRoleId] || {};

        const rawJobs =
          json.skill_matched_recommendations ||
          json.recommended_jobs ||
          json.recommendations ||
          json.results ||
          [];

        const mappedJobs = rawJobs.map((j) => {
          const matched = j.matched_skills || [];
          const missing = j.missing_skills || [];
          const allSkills = j.skills || j.job_skills || [...matched, ...missing];
          const score = j.score ?? j.match_percentage ?? j.match_score ?? 0;

          return {
            jobId: j.job_id || j.JobID,
            title: j.title || j.Title,
            company: j.company || j.Company,
            province: j.province || j.Province,
            salary: j.salary || j.Salary,
            experienceLevel: j.experience_level || j.ExperienceLevel,
            curriculumRoleId: j.curriculum_role_id || j.CurriculumRoleID,
            curriculumRoleTitle: j.curriculum_role_title || j.CurriculumRoleTitle,
            curriculumRoleEN: j.curriculum_role_en || j.CurriculumRoleEN,
            skills: allSkills,
            matchedSkills: matched,
            missingSkills: missing,
            matchPercentage: Math.round(score),
            applyUrl: j.apply_url || j.ApplyURL,
          };
        });

        return {
          prediction: {
            predictedRoleId: predRoleId,
            predictedTitle: analysis.target_role_title || roleMeta.title || predRoleId,
            predictedEnTitle: analysis.target_role_en || roleMeta.en_title || "",
            confidenceScore: Math.round(
              analysis.predicted_confidence ?? (json.confidence_score ? json.confidence_score * 100 : 80)
            ),
          },
          jobs: mappedJobs.length > 0 ? mappedJobs : matchJobs(normSkills, targetRole),
          readiness: calculateReadiness(normSkills),
          source: "fastapi",
        };
      }
    } catch (e) {
      // Backend offline or timeout -> Seamless fallback to Client Engine
    }

    // Client-side execution (Offline Fallback)
    const pred = predictCareerRole(normSkills);
    const jobs = matchJobs(normSkills, targetRole);
    const readiness = calculateReadiness(normSkills);

    return {
      prediction: pred,
      jobs,
      readiness,
      source: "client_engine",
    };
  }

  window.SkillMatchEngine = {
    normalizeSkill,
    normalizeSkillsList,
    predictCareerRole,
    matchJobs,
    calculateReadiness,
    recommend,
  };
})(window);
