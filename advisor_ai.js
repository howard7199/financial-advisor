/**
 * 永豐金證券天母分公司 劉怡汎業務副理 — AI 理財商品／FCN 導覽 ＆ 全球財經時事互動引擎
 * 串接 GCP Cloud Run 雙贈金安全閘道 (Dialogflow CX + Vertex AI Search Enterprise LLM)
 */
(function () {
    const GATEWAY_BASE = "https://advisor-ai-gateway-874615648163.asia-east1.run.app";
    const STORAGE_KEY = "sinopac_evonne_ai_session_v1";

    function getSessionId() {
        try {
            let sid = sessionStorage.getItem(STORAGE_KEY);
            if (!sid) {
                sid = "web-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now();
                sessionStorage.setItem(STORAGE_KEY, sid);
            }
            return sid;
        } catch (e) {
            return "web-" + Date.now();
        }
    }

    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function renderMarkdown(md) {
        // 移除公開訪客不需要看到的原始檢索索引數字如 [1], [2, 3]，底部已有清楚「參考依據」標籤
        let cleanedMd = String(md || "").replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "");
        let html = escapeHtml(cleanedMd);
        html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#1E40AF;font-weight:600;text-decoration:underline;">$1</a>');
        html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
        html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
        html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #E2E8F0;margin:0.75rem 0;">');
        const lines = html.split("\n");
        const out = [];
        let inList = false;
        for (let line of lines) {
            const trimmed = line.trim();
            const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
            if (bulletMatch) {
                if (!inList) {
                    out.push("<ul>");
                    inList = true;
                }
                out.push("<li>" + bulletMatch[1] + "</li>");
            } else {
                if (inList) {
                    out.push("</ul>");
                    inList = false;
                }
                if (trimmed === "") {
                    out.push("<br>");
                } else {
                    out.push(line);
                }
            }
        }
        if (inList) out.push("</ul>");
        return out.join("\n").replace(/(<br>\s*){3,}/g, "<br><br>");
    }

    function initChatController(elements) {
        const { messagesBox, inputField, sendBtn, chipsBar } = elements;
        if (!messagesBox || !inputField || !sendBtn) return null;

        function appendBotMessage(markdownText, sources) {
            const div = document.createElement("div");
            div.className = "ai-msg ai-msg-bot";
            let inner = renderMarkdown(markdownText);
            if (sources && sources.length) {
                const tags = sources
                    .map((s) => `<span class="ai-source-tag">📚 ${escapeHtml(s.category || s.title)}</span>`)
                    .join("");
                inner += `<div class="ai-msg-sources"><span>參考依據：</span>${tags}</div>`;
            }
            div.innerHTML = inner;
            messagesBox.appendChild(div);
            if (messagesBox.id === "fab-messages") {
                messagesBox.scrollTop = messagesBox.scrollHeight;
            } else {
                div.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }

        function appendUserMessage(text) {
            const div = document.createElement("div");
            div.className = "ai-msg ai-msg-user";
            div.textContent = text;
            messagesBox.appendChild(div);
            if (messagesBox.id === "fab-messages") {
                messagesBox.scrollTop = messagesBox.scrollHeight;
            } else {
                div.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }

        function renderChips(questions) {
            if (!chipsBar || !questions || !questions.length) return;
            chipsBar.innerHTML = "";
            questions.forEach((q) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "ai-chip-btn";
                btn.textContent = "💡 " + q;
                btn.addEventListener("click", () => sendQuestion(q));
                chipsBar.appendChild(btn);
            });
        }

        async function sendQuestion(rawText) {
            const text = (rawText || inputField.value || "").trim();
            if (!text || sendBtn.disabled) return;
            inputField.value = "";
            appendUserMessage(text);

            sendBtn.disabled = true;
            const loadingDiv = document.createElement("div");
            loadingDiv.className = "ai-msg ai-msg-bot";
            loadingDiv.textContent = "⏳ 正在同步檢索【FCN與理財商品百科】及【全球／台灣即時財經新聞】為您分析中...";
            messagesBox.appendChild(loadingDiv);
            messagesBox.scrollTop = messagesBox.scrollHeight;

            try {
                const resp = await fetch(`${GATEWAY_BASE}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: text,
                        session_id: getSessionId(),
                    }),
                });
                const data = await resp.json();
                loadingDiv.remove();
                if (!resp.ok) {
                    appendBotMessage(data.detail || "目前連線忙碌中，歡迎稍後再試或直接加 LINE（evonne32016）與劉怡汎副理聯繫！", []);
                } else {
                    appendBotMessage(data.answer, data.sources || []);
                    if (data.suggested_questions) {
                        renderChips(data.suggested_questions);
                    }
                }
            } catch (err) {
                loadingDiv.remove();
                appendBotMessage("網路連線異常，請稍後再試，或點擊下方按鈕直接加劉怡汎副理 LINE（evonne32016）一對一諮詢！", []);
            } finally {
                sendBtn.disabled = false;
                inputField.focus();
            }
        }

        sendBtn.addEventListener("click", () => sendQuestion());
        inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuestion();
            }
        });

        renderChips([
            "幫我整理當下最新全球（美股/Fed）與台灣國內財經新聞重點！",
            "目前市場高檔震盪，怕追高套牢又不想閒置資金，有哪些穩健配置思路？",
            "買美股用「永豐金複委託」跟海外券商在報稅與傳承上差在哪？",
            "什麼是 FCN 固定配息結構型商品？運作機制與風險有哪些？",
        ]);

        return { sendQuestion };
    }

    async function loadLiveHighlights(containerEl, stampEl, askCallback, retried) {
        if (!containerEl) return;
        try {
            const resp = await fetch(`${GATEWAY_BASE}/api/highlights`);
            const data = await resp.json();
            if (stampEl && data.updated_at) {
                stampEl.textContent = "更新：" + data.updated_at;
            }
            if (!data.groups || !data.groups.length) {
                if (!retried) {
                    setTimeout(() => loadLiveHighlights(containerEl, stampEl, askCallback, true), 2500);
                }
                return;
            }
            containerEl.innerHTML = "";
            data.groups.forEach((g) => {
                (g.headlines || []).slice(0, 3).forEach((h) => {
                    const item = document.createElement("div");
                    item.className = "news-live-item";
                    item.innerHTML = `<span class="news-live-cat">${escapeHtml(g.category)}</span>${escapeHtml(h.title)}`;
                    item.title = "點擊讓 AI 為您深度解析這則財經時事的市場重點與啟示";
                    item.addEventListener("click", () => {
                        if (askCallback) {
                            askCallback(`請幫我解析這則最新財經新聞：「${h.title}」，背後的市場關鍵重點以及對投資人有哪些觀察與啟示？`);
                        }
                    });
                    containerEl.appendChild(item);
                });
            });
        } catch (e) {
            containerEl.innerHTML = '<div class="news-live-item">點擊右側對話框可直接詢問「最新全球與台灣財經新聞重點」！</div>';
        }
    }

    function mountFloatingWidgetIfNeeded() {
        if (document.getElementById("inline-ai-chat")) return;

        const fab = document.createElement("button");
        fab.className = "ai-fab-button";
        fab.type = "button";
        fab.innerHTML = "🤖 <span>AI 理財／FCN 導覽</span>";

        const drawer = document.createElement("div");
        drawer.className = "ai-fab-drawer ai-chat-card";
        drawer.innerHTML = `
            <div class="ai-chat-topbar">
                <div class="ai-chat-topbar-info">
                    <div class="ai-avatar-circle">🤖</div>
                    <div>
                        <h4>AI 理財 ＆ 財經時事導覽</h4>
                        <p>FCN 結構型商品・全球與台灣即時新聞</p>
                    </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <a href="ai_advisor.html" class="ai-fullscreen-link" title="開啟全螢幕獨立問答頁">全螢幕 ↗</a>
                    <button type="button" id="ai-fab-close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">✕</button>
                </div>
            </div>
            <div class="ai-messages-box" id="fab-messages">
                <div class="ai-msg ai-msg-bot">
                    您好！我是劉怡汎副理的專屬 <strong>AI 理財與財經時事導覽顧問</strong> 👋<br>
                    您可以隨時詢問我關於 <strong>FCN 結構型商品（KI/KO/配息機制）</strong>、<strong>豐存股 ETF</strong>、<strong>海外複委託稅務</strong>，或是<strong>當下最新全球與台灣財經新聞</strong>！
                </div>
            </div>
            <div class="ai-chips-bar" id="fab-chips"></div>
            <div class="ai-input-area">
                <input type="text" class="ai-input-field" id="fab-input" placeholder="輸入問題，例如：FCN 敲入跟敲出是什麼？" />
                <button type="button" class="ai-send-btn" id="fab-send">發送</button>
            </div>
            <div class="ai-bottom-actions">
                <div class="ai-bottom-links">
                    <a class="ai-mini-cta ai-mini-cta-line" href="https://line.me/ti/p/~evonne32016" target="_blank">📱 加怡汎 LINE</a>
                    <a class="ai-mini-cta ai-mini-cta-radar" href="https://line.me/R/ti/p/@599erudf" target="_blank">🎯 AI 雷達助理</a>
                    <a class="ai-mini-cta ai-mini-cta-open" href="online_open.html">📝 線上開戶</a>
                </div>
            </div>
        `;

        document.body.appendChild(fab);
        document.body.appendChild(drawer);

        let initialized = false;
        fab.addEventListener("click", () => {
            drawer.classList.toggle("open");
            if (!initialized) {
                initChatController({
                    messagesBox: document.getElementById("fab-messages"),
                    inputField: document.getElementById("fab-input"),
                    sendBtn: document.getElementById("fab-send"),
                    chipsBar: document.getElementById("fab-chips"),
                });
                initialized = true;
            }
        });
        document.getElementById("ai-fab-close").addEventListener("click", () => {
            drawer.classList.remove("open");
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        const inlineBox = document.getElementById("inline-ai-messages");
        if (inlineBox) {
            const ctrl = initChatController({
                messagesBox: inlineBox,
                inputField: document.getElementById("inline-ai-input"),
                sendBtn: document.getElementById("inline-ai-send"),
                chipsBar: document.getElementById("inline-ai-chips"),
            });

            document.querySelectorAll("[data-ai-prompt]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const q = btn.getAttribute("data-ai-prompt");
                    if (ctrl && q) ctrl.sendQuestion(q);
                });
            });

            loadLiveHighlights(
                document.getElementById("live-news-list"),
                document.getElementById("live-news-stamp"),
                ctrl ? ctrl.sendQuestion : null
            );

            const params = new URLSearchParams(window.location.search);
            const autoQ = params.get("q");
            if (autoQ && ctrl) {
                ctrl.sendQuestion(autoQ);
            }
        }

        mountFloatingWidgetIfNeeded();
    });
})();
