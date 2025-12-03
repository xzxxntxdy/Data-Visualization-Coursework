// src/js/story_main.js
import * as d3 from "d3";

const STATE_CONFIG = {
    intro: {
        id: "intro",
        bgFrame: "intro",
        heroOpacity: 1,
        heroFilter: "none",
        overlay: "none",
        ctaText: "进入语义 Dashboard",
        ctaTarget: "semantic-view",
    },
    spatial: {
        id: "spatial",
        bgFrame: "spatial",
        heroOpacity: 1,
        heroFilter: "none",
        overlay: "none",
        ctaText: "进入空间 / 尺度视图",
        ctaTarget: "spatial-view",
    },
    semantic: {
        id: "semantic",
        bgFrame: "semantic",
        heroOpacity: 1,
        heroFilter: "none",
        overlay: "none",
        ctaText: "进入语义共现网络",
        ctaTarget: "semantic-view",
    },
    pose: {
        id: "pose",
        bgFrame: "pose",
        heroOpacity: 1,
        heroFilter: "none",
        overlay: "none",
        ctaText: "进入姿态 / 骨架视图",
        ctaTarget: "pose-view",
    },
    handoff: {
        id: "handoff",
        bgFrame: "pose",
        heroOpacity: 1,
        heroFilter: "none",
        overlay: "none",
        ctaText: "从样本跃迁到全量数据",
        ctaTarget: "semantic-view",
    },
};

const heroImage = document.getElementById("hero-image");     // 只用来测尺寸（透明）
const overlaySvg = d3.select("#hero-overlay");
const bgFrames = document.querySelectorAll("[data-bg-frame]");
const storyScroll = document.getElementById("story-scroll");
const ctaButton = document.getElementById("cta-button");
const captionsList = document.getElementById("hero-captions");
const statBbox = document.getElementById("stat-bbox");
const statPose = document.getElementById("stat-pose");
const steps = Array.from(document.querySelectorAll(".story-step"));
const heroStage = document.getElementById("hero-stage");
const stageFrame = document.getElementById("hero-stage-frame");
const aggregateFlash = document.getElementById("aggregate-flash");
const portalLayer = document.getElementById("portal-layer");

// 所有 Hero 帧（和背景图同样方式）
const heroFrames = document.querySelectorAll("[data-hero-frame]");

// 场景顺序，用于滚轮切换
const STATE_ORDER = ["intro", "spatial", "semantic", "pose", "handoff"];

const state = {
    current: "intro",
    layout: null,
    imgSize: null,
    data: null,
};

function debounce(fn, wait = 120) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

const debouncedResize = debounce(() => {
    computeLayout();
    renderState(state.current);
}, 140);

function loadHero() {
    return new Promise((resolve, reject) => {
        if (!heroImage) {
            reject(new Error("hero image element missing"));
            return;
        }
        if (heroImage.complete && heroImage.naturalWidth) {
            resolve({
                width: heroImage.naturalWidth,
                height: heroImage.naturalHeight,
            });
            return;
        }
        heroImage.onload = () =>
            resolve({
                width: heroImage.naturalWidth,
                height: heroImage.naturalHeight,
            });
        heroImage.onerror = reject;
    });
}

async function loadHeroData() {
    try {
        const data = await d3.json("./data/hero_data.json");
        state.data = data || { spatial: [], pose: [], meta: {} };
        return state.data;
    } catch (err) {
        console.error("load hero_data.json failed", err);
        state.data = { spatial: [], pose: [], meta: {} };
        return state.data;
    }
}

function computeLayout() {
    if (!state.imgSize || !stageFrame) return;

    const imgW = state.data?.meta?.width || state.imgSize.width;
    const imgH = state.data?.meta?.height || state.imgSize.height;

    // ❗关键改动：使用 clientWidth / clientHeight，而不是 getBoundingClientRect()
    // 这样就不会受 transform: scale(...) 动画影响，返回前后尺寸一致
    const frameW = stageFrame.clientWidth || stageFrame.offsetWidth || window.innerWidth;
    const frameH = stageFrame.clientHeight || stageFrame.offsetHeight || window.innerHeight;

    // 这里你如果已经按之前建议把 0.96 调成 1.05，也可以保留
    const k = Math.min(frameW / imgW, frameH / imgH) * 1.00;
    const dX = (frameW - imgW * k) / 2;
    const dY = (frameH - imgH * k) / 2;

    state.layout = {
        imgW,
        imgH,
        frameW,
        frameH,
        k,
        dX,
        dY,
        scaleX: d3.scaleLinear().domain([0, imgW]).range([dX, dX + imgW * k]),
        scaleY: d3.scaleLinear().domain([0, imgH]).range([dY, dY + imgH * k]),
    };

    const applySize = (el) => {
        if (!el) return;
        el.style.position = "absolute";
        el.style.width = `${imgW * k}px`;
        el.style.height = `${imgH * k}px`;
        el.style.left = `${dX}px`;
        el.style.top = `${dY}px`;
    };

    // 透明的 heroImage 只是用来触发 onload 不显示
    applySize(heroImage);
    heroFrames.forEach(applySize);

    overlaySvg
        .attr("width", frameW)
        .attr("height", frameH)
        .attr("viewBox", `0 0 ${frameW} ${frameH}`);
}


function setStats() {
    if (statBbox) statBbox.textContent = "52 个检测框";
    if (statPose) {
        const poseCnt = state.data?.pose?.length || 6;
        statPose.textContent = `${poseCnt} 套关键点`;
    }

    if (captionsList && Array.isArray(state.data?.meta?.captions)) {
        captionsList.innerHTML = state.data.meta.captions
            .map((c) => `<li>${c}</li>`)
            .join("");
    }
}

function setCTA(config) {
    if (!ctaButton) return;
    ctaButton.textContent = config.ctaText;
    ctaButton.dataset.target = config.ctaTarget;
}

function updateStageVisual(config) {
    // 用 data-hero-frame + CSS background 实现阶段切换
    const key = config.id;
    heroFrames.forEach((frame) => {
        const tag = frame.dataset.heroFrame;
        const shouldActive =
            tag === key || (key === "handoff" && tag === "pose");
        frame.classList.toggle("active", shouldActive);
    });
}

function updateBackground(config) {
    if (!bgFrames.length) return;
    const activeKey = config.bgFrame || config.id;
    bgFrames.forEach((frame) => {
        frame.classList.toggle("active", frame.dataset.bgFrame === activeKey);
    });
}

function clearOverlay() {
    overlaySvg.selectAll("*").remove();
}

function renderState(nextId) {
    const config = STATE_CONFIG[nextId];
    if (!config) return;

    state.current = nextId;
    setCTA(config);
    updateStageVisual(config);
    updateBackground(config);

    steps.forEach((s) =>
        s.classList.toggle("active", s.dataset.state === nextId)
    );

    clearOverlay();
}

/**
 * 右侧滚动驱动场景（保留）
 */
function setupObserver() {
    if (!storyScroll) return;

    const observer = new IntersectionObserver(
        (entries) => {
            const active = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (active) renderState(active.target.dataset.state);
        },
        {
            root: storyScroll,
            threshold: 0.6,
        }
    );

    steps.forEach((step) => observer.observe(step));
}

/**
 * Portal → Dashboard 的跳转（handoff）
 */
function bindHandoff() {
    const launchers = Array.from(
        document.querySelectorAll("[data-launch-target]")
    );
    launchers.forEach((btn) => {
        btn.addEventListener("click", () =>
            triggerHandoff(btn.dataset.launchTarget || "semantic-view")
        );
    });

    if (ctaButton) {
        ctaButton.addEventListener("click", () =>
            triggerHandoff(ctaButton.dataset.target || "semantic-view")
        );
    }
}

function triggerHandoff(targetId = "semantic-view") {
    if (heroStage) heroStage.classList.add("archiving");
    if (portalLayer) portalLayer.classList.add("archiving");
    aggregateFlash?.classList.add("show");

    // 稍微延迟后通知 index.html 开始切到 Dashboard
    setTimeout(() => {
        document.dispatchEvent(
            new CustomEvent("portal:handoff", { detail: { targetId } })
        );
    }, 380);
}

/**
 * Dashboard → Portal 的回跳（return）
 */
function bindReturn() {
    document.addEventListener("dashboard:return", () => {
        // 清除闪字
        aggregateFlash?.classList.remove("show");

        // 取消 Portal 的虚化状态
        if (portalLayer) {
            portalLayer.classList.remove("archiving");
        }

        // Hero 回弹小动画
        if (heroStage) {
            heroStage.classList.remove("archiving");
            heroStage.classList.add("returning");
            setTimeout(() => heroStage.classList.remove("returning"), 850);
        }

        // 回到“姿态”场景作为入口
        renderState("pose");
        setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    });
}

/**
 * 在左侧大图上用鼠标滚轮切换阶段
 */
function bindWheelScenes() {
    if (!heroStage) return;

    let wheelLock = false;
    const lockDelay = 280; // 防止滚一下跳多级

    const gotoState = (nextId) => {
        const stepEl = document.querySelector(
            `.story-step[data-state="${nextId}"]`
        );
        if (stepEl && storyScroll) {
            stepEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        renderState(nextId);
    };

    heroStage.addEventListener(
        "wheel",
        (e) => {
            // 在 Portal 左侧舞台使用滚轮切换，阻止默认滚动
            e.preventDefault();
            if (wheelLock) return;
            wheelLock = true;
            setTimeout(() => {
                wheelLock = false;
            }, lockDelay);

            const dir = e.deltaY > 0 ? 1 : -1;
            const idx = STATE_ORDER.indexOf(state.current);
            if (idx < 0) {
                gotoState("intro");
                return;
            }
            let nextIdx = idx + dir;
            if (nextIdx < 0) nextIdx = 0;
            if (nextIdx >= STATE_ORDER.length)
                nextIdx = STATE_ORDER.length - 1;

            const nextId = STATE_ORDER[nextIdx];
            if (nextId !== state.current) {
                gotoState(nextId);
            }
        },
        { passive: false }
    );
}

async function init() {
    // 如果当前页面没有 Portal 节点（只用 Dashboard），直接跳过
    if (!portalLayer || !heroStage || !stageFrame) return;

    try {
        const [imgInfo] = await Promise.all([loadHero(), loadHeroData()]);
        state.imgSize = {
            width: state.data?.meta?.width || imgInfo?.width || 1,
            height: state.data?.meta?.height || imgInfo?.height || 1,
        };

        computeLayout();
        setStats();
        renderState("intro");
        setupObserver();
        bindHandoff();
        bindReturn();
        bindWheelScenes();

        window.addEventListener("resize", debouncedResize);
    } catch (err) {
        console.error("story_main init failed", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
