    (function(){
      const html = document.documentElement;
      const THEME_KEY = "vt_theme";
      const metaTheme = document.querySelector('meta[name="theme-color"]');

      const sunPath = 'M12 18a6 6 0 1 1 0-12a6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 11a1 1 0 0 1 1 1a1 1 0 1 1-1-1Zm18 0a1 1 0 0 1 1 1a1 1 0 1 1-1-1ZM5.05 5.05a1 1 0 0 1 1.41 0l.7.7A1 1 0 1 1 5.76 7.16l-.7-.7a1 1 0 0 1 0-1.41Zm12.49 12.49a1 1 0 0 1 1.41 0l.7.7a1 1 0 1 1-1.41 1.41l-.7-.7a1 1 0 0 1 0-1.41ZM18.95 5.05a1 1 0 0 1 0 1.41l-.7.7a1 1 0 0 1-1.41-1.41l.7-.7a1 1 0 0 1 1.41 0ZM7.16 16.84a1 1 0 0 1 0 1.41l-.7.7A1 1 0 1 1 5.05 18.95l.7-.7a1 1 0 0 1 1.41 0Z';
      const moonPath = 'M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z';

      const toggleBtn = document.getElementById("themeToggle");
      const iconSvg = document.getElementById("themeIcon");

      function setMetaTheme(theme){
        if (!metaTheme) return;
        metaTheme.setAttribute("content", theme === "light" ? "#ffffff" : "#07080a");
      }

      function renderIcon(theme){
        const path = iconSvg?.querySelector("path");
        if (!path) return;
        path.setAttribute("d", theme === "light" ? moonPath : sunPath);
      }

      function applyTheme(theme, persist){
        html.setAttribute("data-theme", theme);
        setMetaTheme(theme);
        renderIcon(theme);

        if (toggleBtn){
          toggleBtn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
          toggleBtn.setAttribute("aria-label", theme === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng");
          toggleBtn.title = theme === "light" ? "Chuyển sang tối" : "Chuyển sang sáng";
        }

        if (persist) {
          try { localStorage.setItem(THEME_KEY, theme); } catch {}
        }
      }

      function getInitialTheme(){
        try {
          const saved = localStorage.getItem(THEME_KEY);
          if (saved === "dark" || saved === "light") return saved;
        } catch {}
        const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
        return prefersLight ? "light" : "dark";
      }

      applyTheme(getInitialTheme(), false);

      toggleBtn?.addEventListener("click", () => {
        const current = html.getAttribute("data-theme") === "light" ? "light" : "dark";
        applyTheme(current === "light" ? "dark" : "light", true);
      });

      // Mobile menu
      const btn = document.getElementById("hamburger");
      const sheet = document.getElementById("mobileSheet");
      const closeSheet = () => {
        if (!sheet || !btn) return;
        sheet.style.display = "none";
        btn.setAttribute("aria-expanded","false");
      };
      const openSheet = () => {
        if (!sheet || !btn) return;
        sheet.style.display = "block";
        btn.setAttribute("aria-expanded","true");
      };
      btn?.addEventListener("click", () => {
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        isOpen ? closeSheet() : openSheet();
      });
      sheet?.querySelectorAll("a").forEach(a => a.addEventListener("click", closeSheet));
      document.addEventListener("click", (e) => {
        if (!btn || !sheet) return;
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        if (!isOpen) return;
        if (sheet.contains(e.target) || btn.contains(e.target)) return;
        closeSheet();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeSheet();
          closeTokenScreen();
        }
      });

      // Token screen
      const tokenScreen = document.getElementById("tokenScreen");
      const tokenCloseBtn = document.getElementById("tokenScreenClose");
      const tokenApiUrl = document.getElementById("tokenApiUrl");
      const tokenSttWsUrl = document.getElementById("tokenSttWsUrl");
      const tokenTrWsUrl = document.getElementById("tokenTrWsUrl");
      let tokenEndpointTimer = null;
      const LS_PUBLIC_BASE = "vt_public_base";
      const LS_TOKEN_ENDPOINTS = "vt_token_endpoints_v1";
      const PUBLIC_URL_CODE_FILE = "public_url_code.txt";

      function normalizeOriginCandidate(raw){
        const v = String(raw || "").trim();
        if (!v) return "";
        try {
          const withProto = v.includes("://") ? v : `https://${v}`;
          const u = new URL(withProto);
          let proto = u.protocol;
          if (proto === "ws:") proto = "http:";
          if (proto === "wss:") proto = "https:";
          if (proto !== "http:" && proto !== "https:") return "";
          return `${proto}//${u.host}`;
        } catch {
          return "";
        }
      }

      function toWsOrigin(httpOrigin){
        try {
          const u = new URL(String(httpOrigin || ""));
          const proto = u.protocol === "https:" ? "wss:" : "ws:";
          return `${proto}//${u.host}`;
        } catch {
          return "";
        }
      }

      function normalizeHttpEndpoint(raw){
        const input = String(raw || "").trim().replace(/^['"]|['"]$/g, "");
        if (!input) return "";
        try {
          const withProto = input.includes("://") ? input : `https://${input}`;
          const u = new URL(withProto);
          let proto = u.protocol;
          if (proto === "ws:") proto = "http:";
          if (proto === "wss:") proto = "https:";
          if (proto !== "http:" && proto !== "https:") return "";
          return `${proto}//${u.host}${u.pathname || ""}`.replace(/\/+$/, "");
        } catch {
          return "";
        }
      }

      function normalizeApiEndpoint(raw){
        const base = normalizeHttpEndpoint(raw);
        if (!base) return "";
        try {
          const u = new URL(base);
          let p = String(u.pathname || "").replace(/\/+$/, "");
          if (!p) p = "/docs";
          p = p.replace(/\/openapi\.json$/i, "/docs");
          u.pathname = p;
          u.search = "";
          u.hash = "";
          return u.toString().replace(/\/+$/, "");
        } catch {
          return "";
        }
      }

      function normalizeWsEndpoint(raw, defaultPath){
        const input = String(raw || "").trim().replace(/^['"]|['"]$/g, "");
        if (!input) return "";
        try {
          const withProto = input.includes("://") ? input : `wss://${input}`;
          const u = new URL(withProto);
          let proto = u.protocol;
          if (proto === "http:") proto = "ws:";
          if (proto === "https:") proto = "wss:";
          if (proto !== "ws:" && proto !== "wss:") return "";
          let p = String(u.pathname || "").replace(/\/+$/, "");
          if (!p) p = defaultPath;
          u.protocol = proto;
          u.pathname = p;
          u.search = "";
          u.hash = "";
          return u.toString().replace(/\/+$/, "");
        } catch {
          return "";
        }
      }

      function extractUrlFromLine(line){
        const s = String(line || "").trim();
        if (!s) return "";
        const m = s.match(/((?:https?|wss?):\/\/[^\s]+|[a-z0-9.-]+\.trycloudflare\.com(?:\/[^\s]*)?)/i);
        return m ? String(m[1] || "").trim() : "";
      }

      function parsePublicUrlCodeText(raw){
        const lines = String(raw || "").split(/\r?\n/);
        let originRaw = "";
        let apiRaw = "";
        let sttRaw = "";
        let trRaw = "";

        for (const line of lines) {
          const s = String(line || "").trim();
          if (!s || /^#|^\/\/|^;/.test(s)) continue;

          const kv = s.match(/^([a-z0-9 _-]+)\s*[:=]\s*(.+)$/i);
          if (kv) {
            const key = String(kv[1] || "").trim().toLowerCase();
            const val = String(kv[2] || "").trim();
            if (!val) continue;
            if (key.includes("api")) { apiRaw = apiRaw || val; continue; }
            if (key.includes("stt")) { sttRaw = sttRaw || val; continue; }
            if (key.includes("translator") || key === "tr" || key.includes("translate")) { trRaw = trRaw || val; continue; }
            if (key.includes("origin") || key.includes("base") || key.includes("public")) { originRaw = originRaw || val; continue; }
          }

          const urlValue = extractUrlFromLine(s);
          if (!urlValue) continue;
          if (!apiRaw && /\/docs\/?$/i.test(urlValue)) { apiRaw = urlValue; continue; }
          if (!sttRaw && /^wss?:\/\//i.test(urlValue) && /\/stt\/?$/i.test(urlValue)) { sttRaw = urlValue; continue; }
          if (!trRaw && /^wss?:\/\//i.test(urlValue) && /\/tr\/?$/i.test(urlValue)) { trRaw = urlValue; continue; }
          if (!originRaw) originRaw = urlValue;
        }

        const originFromApi = normalizeOriginCandidate(String(apiRaw || "").replace(/\/docs\/?$/i, "").replace(/\/openapi\.json$/i, ""));
        const originFromStt = normalizeOriginCandidate(sttRaw);
        const originFromTr = normalizeOriginCandidate(trRaw);
        const origin = normalizeOriginCandidate(originRaw) || originFromApi || originFromStt || originFromTr;
        const wsOrigin = toWsOrigin(origin);

        const api = normalizeApiEndpoint(apiRaw) || (origin ? `${origin}/docs` : "");
        const stt = normalizeWsEndpoint(sttRaw, "/stt") || (wsOrigin ? `${wsOrigin}/stt` : "");
        const tr = normalizeWsEndpoint(trRaw, "/tr") || (wsOrigin ? `${wsOrigin}/tr` : "");

        return { origin, api, stt, tr };
      }

      async function loadPublicUrlCodeConfig(){
        try {
          const fileUrl = new URL(PUBLIC_URL_CODE_FILE, window.location.href);
          fileUrl.searchParams.set("ts", String(Date.now()));
          const res = await fetch(fileUrl.toString(), { cache: "no-store" });
          if (!res.ok) return null;
          const txt = await res.text();
          return parsePublicUrlCodeText(txt);
        } catch {
          return null;
        }
      }

      function readCachedTokenEndpoints(){
        try {
          const raw = localStorage.getItem(LS_TOKEN_ENDPOINTS) || "";
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return null;
          return {
            origin: normalizeOriginCandidate(parsed.origin || ""),
            api: normalizeApiEndpoint(parsed.api || ""),
            stt: normalizeWsEndpoint(parsed.stt || "", "/stt"),
            tr: normalizeWsEndpoint(parsed.tr || "", "/tr"),
          };
        } catch {
          return null;
        }
      }

      function writeCachedTokenEndpoints(cfg){
        try {
          localStorage.setItem(LS_TOKEN_ENDPOINTS, JSON.stringify({
            origin: cfg?.origin || "",
            api: cfg?.api || "",
            stt: cfg?.stt || "",
            tr: cfg?.tr || "",
            at: Date.now(),
          }));
          if (cfg?.origin) localStorage.setItem(LS_PUBLIC_BASE, cfg.origin);
        } catch {}
      }

      async function resolveTokenEndpoints(){
        const qs = new URLSearchParams(window.location.search);
        const fromQuery = {
          origin: normalizeOriginCandidate(
            qs.get("public_base") || qs.get("public") || qs.get("base") || qs.get("origin")
          ),
          api: normalizeApiEndpoint(qs.get("api")),
          stt: normalizeWsEndpoint(qs.get("stt"), "/stt"),
          tr: normalizeWsEndpoint(qs.get("tr"), "/tr"),
        };

        const fromFile = await loadPublicUrlCodeConfig();
        const fromCache = readCachedTokenEndpoints();

        const origin =
          fromQuery.origin ||
          fromFile?.origin ||
          fromCache?.origin ||
          normalizeOriginCandidate(localStorage.getItem(LS_PUBLIC_BASE) || "");
        const wsOrigin = toWsOrigin(origin);

        const api =
          fromQuery.api ||
          fromFile?.api ||
          fromCache?.api ||
          (origin ? `${origin}/docs` : "");
        const stt =
          fromQuery.stt ||
          fromFile?.stt ||
          fromCache?.stt ||
          (wsOrigin ? `${wsOrigin}/stt` : "");
        const tr =
          fromQuery.tr ||
          fromFile?.tr ||
          fromCache?.tr ||
          (wsOrigin ? `${wsOrigin}/tr` : "");

        const resolved = { origin, api, stt, tr };
        if (resolved.api || resolved.stt || resolved.tr) {
          writeCachedTokenEndpoints(resolved);
        }
        return resolved;
      }

      function setTokenEndpointTexts(api, stt, tr){
        if (tokenApiUrl) tokenApiUrl.textContent = api || "-";
        if (tokenSttWsUrl) tokenSttWsUrl.textContent = stt || "-";
        if (tokenTrWsUrl) tokenTrWsUrl.textContent = tr || "-";
      }

      async function updateTokenEndpoints(){
        const endpoints = await resolveTokenEndpoints();
        if (!endpoints || (!endpoints.api && !endpoints.stt && !endpoints.tr)) {
          setTokenEndpointTexts("-", "-", "-");
          return;
        }
        setTokenEndpointTexts(
          endpoints.api || "-",
          endpoints.stt || "-",
          endpoints.tr || "-"
        );
      }

      async function copyTokenTarget(targetId, btn){
        const el = document.getElementById(targetId);
        const value = String(el?.textContent || "").trim();
        if (!value || value === "-") return;
        const old = btn ? btn.textContent : "";
        const okText = "Đã copy";
        try {
          await navigator.clipboard.writeText(value);
          if (btn) {
            btn.textContent = okText;
            setTimeout(() => { btn.textContent = old; }, 1100);
          }
        } catch {
          if (btn) {
            btn.textContent = "Lỗi copy";
            setTimeout(() => { btn.textContent = old; }, 1100);
          }
        }
      }

      function closeTokenScreen(){
        if (!tokenScreen) return;
        tokenScreen.classList.remove("open");
        tokenScreen.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (tokenEndpointTimer) {
          clearInterval(tokenEndpointTimer);
          tokenEndpointTimer = null;
        }
      }
      function openTokenScreen(){
        if (!tokenScreen) return;
        tokenScreen.classList.add("open");
        tokenScreen.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        updateTokenEndpoints().catch(() => {});
        if (tokenEndpointTimer) clearInterval(tokenEndpointTimer);
        tokenEndpointTimer = setInterval(() => {
          updateTokenEndpoints().catch(() => {});
        }, 3000);
      }

      document.querySelectorAll('[data-open-token-screen="1"]').forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          closeSheet();
          openTokenScreen();
        });
      });

      tokenCloseBtn?.addEventListener("click", closeTokenScreen);
      tokenScreen?.addEventListener("click", (e) => {
        const target = e.target;
        if (target && target.matches('[data-token-close="1"]')) {
          closeTokenScreen();
        }
      });
      document.querySelectorAll("[data-copy-target]").forEach((btn) => {
        btn.addEventListener("click", () => {
          copyTokenTarget(btn.getAttribute("data-copy-target"), btn);
        });
      });
      window.addEventListener("focus", () => {
        updateTokenEndpoints().catch(() => {});
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) updateTokenEndpoints().catch(() => {});
      });

      // Smooth scroll
      document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href");
          if (!id || id === "#") return;
          const el = document.querySelector(id);
          if (!el) return;
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      // FAQ accordion (auto height, no cut)
      function closeAllQA(){
        document.querySelectorAll(".qa.open").forEach(x => {
          x.classList.remove("open");
          const ans = x.querySelector(".ans");
          if (ans) ans.style.maxHeight = "0px";
        });
      }
      document.querySelectorAll(".qa .qBtn").forEach(b => {
        b.addEventListener("click", () => {
          const qa = b.closest(".qa");
          if (!qa) return;

          const ans = qa.querySelector(".ans");
          const inner = qa.querySelector(".ansInner");
          const isOpen = qa.classList.contains("open");

          closeAllQA();
          if (!isOpen){
            qa.classList.add("open");
            if (ans && inner){
              ans.style.maxHeight = inner.scrollHeight + "px";
            }
          }
        });
      });

      // Scroll reveal
      const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prefersReduced && "IntersectionObserver" in window){
        const io = new IntersectionObserver((entries) => {
          entries.forEach(en => {
            if (en.isIntersecting){
              en.target.classList.add("in");
              io.unobserve(en.target);
            }
          });
        }, { threshold: 0.12 });

        document.querySelectorAll(".reveal").forEach(el => io.observe(el));
      } else {
        document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
      }
    })();
