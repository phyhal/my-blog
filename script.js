/* =========================================================
   刷题笔记 · 交互脚本
   借鉴 dillinger.tv 的克制动效：
   1. 主题切换（深/浅，记忆偏好，跟随系统）
   2. 元素上浮 reveal（进入视口时淡入）
   3. 顶部阅读进度条
   4. 返回顶部按钮
   5. 上下篇导航按钮自动换行保持可读
   ========================================================= */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- 1. 主题切换 ---------- */
  var THEME_KEY = "theme";
  function currentTheme() {
    return root.getAttribute("data-theme") || "light";
  }
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = t === "dark" ? "☀" : "☾";  // ☾=暗色模式待切换->显示太阳 反之月亮
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === "dark" ? "#0c0c0b" : "#f7f6f3";
  }
  // 首次加载：优先记忆，否则跟随系统
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(saved || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  /* ---------- 2. 上浮 reveal ---------- */
  // 给首页列表项、文章正文中的标题/段落/代码块添加延迟，滚动到视口时上浮。
  // 只针对 .post-body（避免误伤右侧目录）；目录项用 scrollspy 各自高亮。
  var targets = document.querySelectorAll(
    ".post-list li, .post-body > *, .pager"
  );
  targets.forEach(function (el) { el.classList.add("reveal"); });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add("in"); });
  }

  // 列表/正文标题交错延迟，形成"逐条上浮"的节奏感
  var i = 0;
  document.querySelectorAll(".post-list li, .post-body h2, .post-body h3").forEach(function (el) {
    el.style.transitionDelay = (Math.min(i, 8) * 60) + "ms";
    i++;
  });

  /* ---------- 2.5 文章右侧目录：滚动高亮当前章节 ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll("aside.toc .toc-list a"));
  if (tocLinks.length) {
    var tocTargets = tocLinks.map(function (a) {
      var id = a.getAttribute("href").slice(1);
      return document.getElementById(id);
    }).filter(Boolean);

    function setActiveLink() {
      // 找到最后一个位置在"视口上方标题线附近"的小标题，作为当前章节
      var topLine = 140; // sticky 顶栏高度附近的判断线
      var cur = -1;
      tocTargets.forEach(function (t, idx) {
        if (t && t.getBoundingClientRect().top <= topLine) cur = idx;
      });
      // 若当前处于文章开头（还没滚到第一个标题），高亮第一个
      if (window.scrollY < 120) cur = 0;
      tocLinks.forEach(function (a, idx) {
        a.classList.toggle("active", idx === cur);
      });
    }
    window.addEventListener("scroll", setActiveLink, { passive: true });
    window.addEventListener("resize", setActiveLink);
    setActiveLink();
  }

  /* ---------- 2.6 文章右侧目录：平滑滚动点击 ---------- */
  // 原生锚点已足够，但点击后保证目标标题的 reveal 立即显现
  tocLinks.forEach(function (a) {
    a.addEventListener("click", function () {
      var id = a.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (target && target.classList.contains("reveal")) {
        target.classList.add("in");
      }
    });
  });

  /* ---------- 3. 阅读进度条 ---------- */
  var bar = document.getElementById("scroll-progress");
  function onScroll() {
    if (bar) {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? h.scrollTop / max : 0;
      bar.style.transform = "scaleX(" + p + ")";
    }
    var topBtn = document.getElementById("back-to-top");
    if (topBtn) {
      if (h.scrollTop > 320) topBtn.classList.add("show");
      else topBtn.classList.remove("show");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 4. 返回顶部 ---------- */
  var backTop = document.getElementById("back-to-top");
  if (backTop) {
    backTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- 5. 首页文章 hover 网页缩略预览 ----------
     在较宽的屏幕且支持 hover 时启用。hover 到某篇文章，
     文章行右侧浮现一张"浏览器窗口"式的缩略卡，里面是
     真实加载的对应文章页（iframe 等比缩小渲染）。 */
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var previewSupported = finePointer && window.innerWidth >= 1180;
  if (previewSupported) {
    var preview = document.createElement("div");
    preview.className = "page-preview";
    preview.innerHTML =
      '<div class="pp-bar"><i></i><i></i><i></i><span class="pp-url"></span></div>' +
      '<div class="pp-body"><iframe class="pp-frame" loading="lazy" tabindex="-1"></iframe></div>';
    document.body.appendChild(preview);

    var ppUrl = preview.querySelector(".pp-url");
    var ppFrame = preview.querySelector(".pp-frame");
    var loadedSrc = "";
    var activeEntry = null;
    var hideTimer = null;

    function showPreview(entry) {
      clearTimeout(hideTimer);
      var link = entry.querySelector("a.entry");
      var href = link ? link.href : "";
      if (!href) return;
      var date = entry.querySelector("time");
      activeEntry = entry;
      // 栏目顶部显示"站点地址 + 日期"
      try {
        var u = new URL(href);
        ppUrl.textContent = u.pathname.replace(/^\/+|\/+$/g, "") || "文章页";
      } catch (e) {
        ppUrl.textContent = href;
      }
      if (date) ppUrl.title = "发布于 " + date.textContent;
      // 定位卡片到文章行的右侧
      var rect = entry.getBoundingClientRect();
      var w = 380;
      var x = rect.right + 24;
      if (x + w > window.innerWidth - 20) x = rect.left - w - 24;  // 放不下就换到左侧
      preview.style.left = Math.max(14, x) + "px";
      preview.style.top = Math.max(14, rect.top + rect.height / 2 - 130) + "px";
      // 懒加载真实文章内容（同一 src 不重复加载）
      if (loadedSrc !== href) {
        ppFrame.src = href;
        loadedSrc = href;
      }
      preview.classList.add("show");
    }

    function hidePreview() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!activeEntry) return;
        preview.classList.remove("show");
      }, 120);
    }

    document.querySelectorAll(".post-list li").forEach(function (li) {
      li.addEventListener("mouseenter", function () { showPreview(li); });
      li.addEventListener("mouseleave", hidePreview);
    });
    // 卡片本身不该挡住交互，鼠标在卡片上也保持显示
    preview.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
    preview.addEventListener("mouseleave", hidePreview);
    // 滚动/缩放时收起
    window.addEventListener("scroll", function () { preview.classList.remove("show"); }, { passive: true });
    window.addEventListener("resize", function () {
      if (window.innerWidth < 1180) { preview.classList.remove("show"); previewSupported = false; }
    });
  }
})();
