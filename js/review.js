// T1 Human Study (static) - caption-quality review.
// Per item, the reviewer enters seven 0-5 scores comparing the model's
// caption to the ground truth. Progress is persisted in localStorage.
// On Finish, the full payload (including the original LLM-judge scores
// kept inside each sample so downstream agreement analysis has both
// signals) is POSTed to FORMSPREE_URL.

(function () {
    "use strict";

    // ===== CONFIG =====
    const FORMSPREE_URL = "https://formspree.io/f/mojrnqdr";

    const CATEGORIES = [
        { key: "action_accuracy",        label: "Action accuracy" },
        { key: "identity_accuracy",      label: "Identity accuracy" },
        { key: "causality_outcome",      label: "Causality & outcome" },
        { key: "spatial_understanding",  label: "Spatial understanding" },
        { key: "temporal_understanding", label: "Temporal understanding" },
        { key: "contextual_details",     label: "Contextual details" },
        { key: "final_holistic_score",   label: "Final holistic score" },
    ];

    const sport = window.T1_SPORT || "basketball";
    const STUDY_LABEL = `T1_${sport}`;
    const STORAGE_SESSION = `t1_${sport}_session`;
    const STORAGE_SCORES = `t1_${sport}_scores`;
    const SAMPLES = window.SAMPLES || [];
    const TOTAL = SAMPLES.length;

    // ===== Session bootstrap =====
    let session;
    try {
        session = JSON.parse(localStorage.getItem(STORAGE_SESSION) || "null");
    } catch (_) { session = null; }
    if (!session || !session.userId) {
        window.location.href = `start.html?sport=${sport}`;
        return;
    }
    document.getElementById("navUserId").textContent = session.userId;

    let scores = {};
    try {
        scores = JSON.parse(localStorage.getItem(STORAGE_SCORES) || "{}") || {};
    } catch (_) { scores = {}; }

    function persistScores() {
        localStorage.setItem(STORAGE_SCORES, JSON.stringify(scores));
    }

    // ===== DOM refs =====
    const els = {
        itemNumber: document.getElementById("itemNumber"),
        itemMeta: document.getElementById("itemMeta"),
        gtText: document.getElementById("gtText"),
        predText: document.getElementById("predText"),
        scoresGrid: document.getElementById("scoresGrid"),
        errorMessage: document.getElementById("errorMessage"),
        savedMessage: document.getElementById("savedMessage"),
        prevBtn: document.getElementById("prevBtn"),
        submitBtn: document.getElementById("submitBtn"),
        nextBtn: document.getElementById("nextBtn"),
        finishBtn: document.getElementById("finishBtn"),
        progressText: document.getElementById("progressText"),
        progressBar: document.getElementById("progressBar"),
        submitOverlay: document.getElementById("submitOverlay"),
        submitStatus: document.getElementById("submitStatus"),
        submitSuccess: document.getElementById("submitSuccess"),
        submitError: document.getElementById("submitError"),
        submitErrorText: document.getElementById("submitErrorText"),
        downloadFallbackBtn: document.getElementById("downloadFallbackBtn"),
        retrySubmitBtn: document.getElementById("retrySubmitBtn"),
    };

    let currentIdx = 0;

    // ===== Rendering =====
    function buildScoreInputs(existing) {
        els.scoresGrid.innerHTML = "";
        CATEGORIES.forEach(({ key, label }) => {
            const row = document.createElement("div");
            row.className = "score-row";

            const lab = document.createElement("label");
            lab.className = "score-label";
            lab.htmlFor = `score-${key}`;
            lab.textContent = label;

            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.max = "5";
            input.step = "1";
            input.id = `score-${key}`;
            input.dataset.key = key;
            input.className = "score-input";
            input.placeholder = "0-5";
            input.inputMode = "numeric";
            if (existing && existing.scores && existing.scores[key] != null) {
                input.value = String(existing.scores[key]);
            }

            row.appendChild(lab);
            row.appendChild(input);
            els.scoresGrid.appendChild(row);
        });
    }

    function readScores() {
        const out = {};
        for (const { key } of CATEGORIES) {
            const el = document.getElementById(`score-${key}`);
            const raw = (el.value || "").trim();
            if (raw === "") return { error: `Please score "${key.replace(/_/g, " ")}".` };
            const n = Number(raw);
            if (!Number.isInteger(n) || n < 0 || n > 5) {
                return { error: `Score for "${key.replace(/_/g, " ")}" must be an integer 0-5.` };
            }
            out[key] = n;
        }
        return { scores: out };
    }

    function renderCurrent() {
        const sample = SAMPLES[currentIdx];
        els.itemNumber.textContent = `${currentIdx + 1} of ${TOTAL}`;
        els.itemMeta.textContent = `id #${sample.id}`;
        els.gtText.textContent = sample.ground_truth || "";
        els.predText.textContent = sample.prediction || "";

        const existing = scores[String(sample.id)];
        buildScoreInputs(existing);

        hideMessages();
        updateButtons();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function answeredCount() {
        return Object.keys(scores).length;
    }

    function updateButtons() {
        els.prevBtn.disabled = currentIdx === 0;
        const isLast = currentIdx === TOTAL - 1;
        const ans = answeredCount();

        if (isLast) {
            els.nextBtn.style.display = "none";
            if (ans === TOTAL) {
                els.submitBtn.style.display = "none";
                els.finishBtn.style.display = "inline-block";
            } else {
                els.submitBtn.style.display = "inline-block";
                els.finishBtn.style.display = "none";
            }
        } else {
            els.submitBtn.style.display = "inline-block";
            els.nextBtn.style.display = "none";
            els.finishBtn.style.display = "none";
        }

        els.progressText.textContent = `${ans} / ${TOTAL}`;
        els.progressBar.style.width = `${TOTAL ? (ans / TOTAL) * 100 : 0}%`;
    }

    function hideMessages() {
        els.errorMessage.style.display = "none";
        els.savedMessage.style.display = "none";
    }

    function showError(msg) {
        els.errorMessage.textContent = msg;
        els.errorMessage.style.display = "block";
        els.savedMessage.style.display = "none";
    }

    function showSaved() {
        els.savedMessage.style.display = "flex";
        els.errorMessage.style.display = "none";
        setTimeout(() => { els.savedMessage.style.display = "none"; }, 1800);
    }

    // ===== Submit current item (saves locally) =====
    function submitCurrent() {
        const sample = SAMPLES[currentIdx];
        const result = readScores();
        if (result.error) {
            showError(result.error);
            return false;
        }

        scores[String(sample.id)] = {
            id: sample.id,
            sport: sample.sport,
            model: sample.model,
            scores: result.scores,
            timestamp: new Date().toISOString(),
        };
        persistScores();
        showSaved();
        updateButtons();
        return true;
    }

    // ===== Final payload + submission =====
    function buildPayload() {
        // Include each sample's original LLM-judge scores so we can run
        // human-vs-LLM agreement downstream without rejoining files.
        const items = SAMPLES.map((s) => {
            const human = scores[String(s.id)] || null;
            const llmJudge = {};
            for (const { key } of CATEGORIES) {
                llmJudge[key] = (s[key] && typeof s[key] === "object") ? s[key] : null;
            }
            return {
                id: s.id,
                sport: s.sport,
                model: s.model,
                source_file: s.source_file,
                source_index: s.source_index,
                ground_truth: s.ground_truth,
                prediction: s.prediction,
                human: human ? human.scores : null,
                human_timestamp: human ? human.timestamp : null,
                llm_judge: llmJudge,
            };
        });

        return {
            study: STUDY_LABEL,
            sport: sport,
            user_id: session.userId,
            email: session.userEmail || "",
            session_id: session.sessionId,
            started_at: session.startedAt,
            completed_at: new Date().toISOString(),
            total_samples: TOTAL,
            answered: answeredCount(),
            items,
        };
    }

    function downloadPayload() {
        const payload = buildPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeId = (session.userId || "user").replace(/[^a-zA-Z0-9_-]/g, "_");
        a.href = url;
        a.download = `t1_${sport}_${safeId}_${session.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showOverlayState(state, errorText) {
        els.submitOverlay.style.display = "flex";
        els.submitStatus.style.display = state === "loading" ? "block" : "none";
        els.submitSuccess.style.display = state === "success" ? "block" : "none";
        els.submitError.style.display = state === "error" ? "block" : "none";
        if (state === "error" && errorText) els.submitErrorText.textContent = errorText;
    }

    async function submitFinal() {
        const payload = buildPayload();

        if (!FORMSPREE_URL) {
            showOverlayState("error", "No remote endpoint configured.");
            return;
        }

        showOverlayState("loading");
        try {
            const resp = await fetch(FORMSPREE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error(`Endpoint returned ${resp.status}`);
            showOverlayState("success");
            localStorage.removeItem(STORAGE_SCORES);
            localStorage.removeItem(STORAGE_SESSION);
        } catch (e) {
            showOverlayState("error", e.message || "Network error.");
        }
    }

    // ===== Wire up buttons =====
    els.submitBtn.addEventListener("click", () => {
        if (!submitCurrent()) return;
        if (currentIdx < TOTAL - 1) {
            currentIdx++;
            renderCurrent();
        } else {
            updateButtons();
        }
    });
    els.nextBtn.addEventListener("click", () => {
        if (currentIdx < TOTAL - 1) { currentIdx++; renderCurrent(); }
    });
    els.prevBtn.addEventListener("click", () => {
        if (currentIdx > 0) { currentIdx--; renderCurrent(); }
    });
    els.finishBtn.addEventListener("click", submitFinal);
    els.downloadFallbackBtn.addEventListener("click", downloadPayload);
    els.retrySubmitBtn.addEventListener("click", submitFinal);

    renderCurrent();
})();
