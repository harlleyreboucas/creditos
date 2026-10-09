/**
 * Probha – Blogger template main script (deobfuscated & annotated)
 *
 * Original: obfuscator.io output (string-array + RC4 decoder, control-flow wrappers).
 * What was done:
 *   - all encoded strings decoded and inlined
 *   - anti-debug timers, console-disabling and "self-defending" regex traps removed
 *   - dead code / junk wrappers removed, expressions expanded to normal statements
 *   - variables and functions renamed from context (names are inferred, so some may be approximate)
 * Behaviour was checked against the original in a headless browser (same requests, DOM and storage).
 *
 * Versão independente (Harlley):
 *   - removida a verificação remota de licença/kill switch (probha.pages.dev)
 *     e o envio do ID do blog para probha.mdrakib.workers.dev
 *   - removido o uso de proxy.mdrakib.workers.dev (QR code e Watermark)
 *   - corrigido o ícone de fechar do popup (icon-x-lg -> icon-close)
 * Todos os recursos externos restantes ficam em harlleyreboucas.github.io/creditos
 */

window.pbd = {};

// ---------- Registry of DOM watchers: calls register()ed callbacks for matching elements, now and whenever the DOM changes (MutationObserver) ----------
const domWatcher = {
    _callbacks: [],
    _seen: new WeakMap(),
    _kv: new WeakMap(),
    _observer: null,
    register(selector, callback) {
        if (!this._kv.has(callback)) {
            this._kv.set(callback, {});
        }
        const registration = {
            selector: selector,
            callback: callback,
            mode: "one"
        };
        this._callbacks.push(registration);
        queueMicrotask(() => {
            const element = document.querySelector(selector);
            if (element) {
                this._process(element, registration);
            }
            else {
                callback(null, this._kv.get(callback));
            }
        });
        this._start();
    },
    registerAll(selector, callback) {
        if (!this._kv.has(callback)) {
            this._kv.set(callback, {});
        }
        const registration = {
            selector: selector,
            callback: callback,
            mode: "all"
        };
        this._callbacks.push(registration);
        queueMicrotask(() => {
            document.querySelectorAll(selector).forEach(element => {
                this._process(element, registration);
            });
        });
        this._start();
    },
    _process(element, registration) {
        const { callback: callback, mode: mode } = registration;
        let seenCallbacks = this._seen.get(element);
        if (!seenCallbacks) {
            seenCallbacks = new WeakSet();
            this._seen.set(element, seenCallbacks);
        }
        if (!seenCallbacks.has(callback)) {
            seenCallbacks.add(callback);
            try {
                callback(element, this._kv.get(callback));
            }
            catch (error) {
            }
        }
    },
    _start() {
        const observerOptions = {
            childList: true,
            subtree: true
        };
        if (!this._observer) {
            this._observer = new MutationObserver(mutations => {
                const set = new Set();
                for (const mutation of mutations) {
                    for (const addedNode of mutation.addedNodes) {
                        if (addedNode.nodeType === 1) {
                            set.add(addedNode);
                        }
                    }
                }
                if (set.size) {
                    requestAnimationFrame(() => {
                        return this._runChecks(set);
                    });
                }
            });
            this._observer.observe(document.body || document.documentElement, observerOptions);
        }
    },
    _runChecks(addedNodes) {
        for (const callback of this._callbacks) {
            const { selector: selector, mode: mode } = callback;
            for (const node of addedNodes) {
                if (mode === "one") {
                    const target = node.matches?.(selector) ? node : node.querySelector?.(selector);
                    if (target) {
                        this._process(target, callback);
                    }
                }
                else {
                    if (node.matches?.(selector)) {
                        this._process(node, callback);
                    }
                    node.querySelectorAll?.(selector).forEach(element => {
                        this._process(element, callback);
                    });
                }
            }
        }
    }
};

// ===== Creates the <pbd> container element (document.pbd) used to host injected UI =====
(function () {
    const pbdEl = document.createElement("pbd");
    document.documentElement.append(pbdEl);
    Object.defineProperty(document, "pbd", {
        value: pbdEl,
        writable: false,
        configurable: false
    });
})();

// ---------- Cookie helpers (set / get / delete) ----------
const cookies = {
    set(name, value, days = 7, path = "/") {
        const date = new Date();
        date.setTime(date.getTime() + 864e5 * days);
        document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + "; expires=" + date.toUTCString() + "; pat" + "h=" + path + "; SameSite=Lax";
    },
    get(name) {
        const cookiePairs = document.cookie ? document.cookie.split("; ") : [];
        for (let pair of cookiePairs) {
            const [cookieName, cookieValue] = pair.split("=");
            if (decodeURIComponent(cookieName) === name) {
                return decodeURIComponent(cookieValue);
            }
        }
        return null;
    },
    has(name) {
        return this.get(name) !== null;
    },
    remove(name, path = "/") {
        document.cookie = encodeURIComponent(name) + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=" + path;
    }
};

// ---------- Fetches a Blogger JSON feed and maps entries to simple post objects ----------
const fetchFeedEntries = (url, options = {}) => {
    const publishedDateFormat = {
        day: "numeric",
        month: "long",
        year: "numeric"
    };
    const updatedDateFormat = {
        day: "numeric",
        month: "long",
        year: "numeric"
    };
    const getPostLink = entry => {
        const found = entry.link?.find(item => item.rel === "alternate");
        return found ? found.href : "#";
    };
    const getThumbnail = entry => entry.media$thumbnail?.url || "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiSr0ef4qwRikooZ-ejYVC-783MfY2QUk8UwCQPLu8yitOLFlJuBVXrxXs_Z33W-J-quikNt6sRlmC-SXcRXGdUjrvqB391vcGz6sowRwV_op8WuE93H6dsXvOkq0vUmXheZ7rmIwn-qRxLsv2TbdRghckS8ows0x0aLzk0RbWSEzZ5Eab7G5i7NGtGIg/s72-c/no-image.png";
    const mapEntry = entry => {
        return {
            title: entry.title?.$t || "No Title",
            summary: entry.summary?.$t || "",
            link: getPostLink(entry),
            thumbnail: getThumbnail(entry),
            date: new Date(entry.published?.$t).toLocaleDateString("en-US", publishedDateFormat),
            updated: new Date(entry.updated?.$t).toLocaleDateString("en-US", updatedDateFormat),
            comments: entry.thr$total?.$t || 0,
            author: entry.author?.[0]?.name?.$t || "Unknown",
            cropped: (width, height) => {
                return getThumbnail(entry).replace(/s72(?:-w\d+-h\d+)?/, "w" + width + "-h" + height + "-rw");
            },
            id: entry.id?.$t?.split("-").pop(),
            labels: (entry.category || []).map(category => category.term)
        };
    };
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "json";
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const response = xhr.response;
                let posts = (response.feed?.entry || []).map(mapEntry);
                if (options.filter) {
                    const excludedId = String(options.filter);
                    posts = posts.filter(post => String(post.id || post.link) !== excludedId);
                }
                resolve(posts);
            }
            else {
                reject(new Error("HTTP error! status: " + xhr.status));
            }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send();
    });
};

// ---------- Small shared helpers ----------
const getPluginScript = pluginName => document.querySelector("script[data-plugin=\"" + pluginName + '"]');
const pluginSelector = pluginName => "script[data-plugin=\"" + pluginName + '"]';
const iconHtml = iconName => "<i class=\"icon-" + iconName + "\"></i>";
const placeholderImage = (width, height) => "data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\"%3E%3C/svg%3E";
const siteOrigin = window.location.origin;
const feedSummaryUrl = siteOrigin + "/feeds/posts/summary?alt=json";
localStorage.setItem("probha", "v1.1");

// ---------- Modal popup (with history-based closing) ----------
const showPopup = ({ title = "", message = "", closable = true, closeText = null, actionText = null, onClose = null, className = null } = {}) => {
    const popupId = "toast-" + Date.now();
    const overlay = document.createElement("div");
    overlay.className = "pop-ov";
    overlay.dataset.toastId = popupId;
    overlay.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
    });
    if (className) {
        className.split(" ").forEach(part => overlay.classList.add(part));
    }
    const content = document.createElement("div");
    content.className = "content";
    const head = document.createElement("div");
    head.className = "head";
    const titleEl = document.createElement("div");
    titleEl.className = "title";
    titleEl.textContent = title;
    const closeButton = document.createElement("div");
    closeButton.className = "close";
    const icon = document.createElement("i");
    icon.className = "icon-close";
    closeButton.append(icon);
    head.append(titleEl, closeButton);
    const textEl = document.createElement("div");
    textEl.className = "text";
    textEl.textContent = message;
    const buttonsEl = document.createElement("div");
    buttonsEl.className = "btns";
    const closePopup = () => {
        if (closable && history.state && history.state.toast === popupId) {
            history.back();
        }
        else {
            overlay.classList.remove("active");
            overlay.ontransitionend = () => overlay.remove();
            if (typeof onClose == "function") {
                onClose();
            }
        }
    };
    if (closable) {
        overlay.onclick = closePopup;
        closeButton.onclick = closePopup;
        content.onclick = event => event.stopPropagation();
    }
    else {
        overlay.classList.add("block");
    }
    if (closeText) {
        const closeTextButton = document.createElement("div");
        closeTextButton.className = "btn close";
        closeTextButton.textContent = closeText;
        closeTextButton.onclick = closePopup;
        buttonsEl.appendChild(closeTextButton);
    }
    let actionButton = null;
    const historyState = {
        toast: popupId
    };
    if (actionText) {
        actionButton = document.createElement("div");
        actionButton.className = "btn action";
        actionButton.textContent = actionText;
        buttonsEl.appendChild(actionButton);
    }
    content.append(head, textEl, buttonsEl);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    if (closable) {
        history.pushState(historyState, "", "");
    }
    requestAnimationFrame(() => {
        overlay.classList.add("active");
    });
    return {
        element: overlay,
        action: actionButton,
        close: closePopup,
        id: popupId
    };
};

// ---------- Toast notification ----------
function showToast(message, isSuccess = true, duration = 3e3) {
    const pbdToast = document.querySelector(".pbd-toast");
    if (pbdToast) {
        pbdToast.remove();
    }
    const toast = document.createElement("div");
    toast.className = "pbd-toast " + (isSuccess ? "success" : "error");
    const iconText = document.createElement("div");
    iconText.className = "icon-text";
    const iconEl = document.createElement("div");
    iconEl.className = "icon";
    iconEl.innerHTML = iconHtml(isSuccess ? "check-fill" : "error-fill");
    const textEl = document.createElement("div");
    textEl.className = "text";
    textEl.textContent = message;
    iconText.append(iconEl, textEl);
    const closeButton = document.createElement("div");
    closeButton.className = "close";
    closeButton.textContent = "ok";
    toast.append(iconText, closeButton);
    document.body.append(toast);
    requestAnimationFrame(() => toast.classList.add("active"));
    const dismiss = () => {
        clearTimeout(timeoutId);
        toast.classList.remove("active");
    };
    const timeoutId = setTimeout(dismiss, duration);
    closeButton.onclick = dismiss;
    toast.ontransitionend = event => {
        if (!(event.propertyName !== "opacity" || toast.classList.contains("active"))) {
            toast.remove();
        }
    };
}

// ---------- Shortcut used by plugins to show a toast ----------
function notify(message, isSuccess = true, duration = 3e3) {
    if (message) {
        showToast(message, isSuccess, duration);
    }
}

// ---------- Swipe-down-to-dismiss behaviour for bottom sheets ----------
function enableSwipeToDismiss(modal, overlay) {
    if (!modal || !overlay) {
        return;
    }
    const toggleId = modal.dataset.id;
    const toggleInput = document.getElementById(toggleId);
    const isDismissible = modal.dataset.closable !== "false";
    let touchStartY = 0;
    let startHeight = 0;
    let fullHeight = 0;
    let isDragging = false;
    let scrolledToTop = false;
    let scrolledToBottom = false;
    let frameId = null;
    let timerId = null;
    let gestureId = 0;
    const findScrollableParent = node => {
        while (node && node !== modal) {
            const style = window.getComputedStyle(node);
            const isScrollable = node.scrollHeight > node.clientHeight;
            if ((style.overflowY === "auto" || style.overflowY === "scroll") && isScrollable) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    };
    function cancelPendingWork() {
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
        }
    }
    function resetInlineStyles() {
        cancelPendingWork();
        modal.style.removeProperty("height");
        modal.style.removeProperty("transition");
        overlay.style.removeProperty("opacity");
        overlay.style.removeProperty("transition");
    }
    function animateToFullHeight() {
        const currentGesture = ++gestureId;
        cancelPendingWork();
        const offsetHeight = modal.offsetHeight;
        if (Math.abs(offsetHeight - fullHeight) <= 1) {
            resetInlineStyles();
        }
        else {
            modal.style.transition = "none";
            overlay.style.transition = "none";
            modal.style.height = offsetHeight + "px";
            modal.offsetHeight;
            modal.style.transition = "height 300ms cubic-bezier(0.25, 0.8, 0.25, 1)";
            overlay.style.transition = "opacity 300ms cubic-bezier(0.25, 0.8, 0.25, 1)";
            modal.style.height = fullHeight + "px";
            overlay.style.opacity = "1";
            timerId = setTimeout(() => {
                timerId = null;
                if (currentGesture === gestureId) {
                    resetInlineStyles();
                }
            }, 330);
        }
    }
    function onTouchStart(event) {
        if (event.touches.length > 1) {
            return;
        }
        gestureId++;
        cancelPendingWork();
        touchStartY = event.touches[0].clientY;
        startHeight = modal.offsetHeight;
        fullHeight = modal.scrollHeight;
        isDragging = false;
        scrolledToTop = false;
        scrolledToBottom = false;
        const scrollParent = findScrollableParent(event.target);
        if (scrollParent) {
            scrolledToTop = scrollParent.scrollTop <= 0;
            const remainingScroll = scrollParent.scrollHeight - scrollParent.scrollTop;
            scrolledToBottom = Math.abs(remainingScroll - scrollParent.clientHeight) <= 1;
        }
        else {
            scrolledToTop = true;
            scrolledToBottom = true;
        }
        modal.style.transition = "none";
        overlay.style.transition = "none";
    }
    function onTouchMove(event) {
        if (event.touches.length > 1) {
            return;
        }
        const clientY = event.touches[0].clientY;
        const deltaY = touchStartY - clientY;
        if (!isDragging) {
            const scrollParent = findScrollableParent(event.target);
            if (scrollParent) {
                const isPullingUp = deltaY > 0;
                const atTopPullingDown = scrolledToTop && deltaY < 0 && scrollParent.scrollTop <= 0;
                const atScrollEnd = scrollParent.scrollHeight - scrollParent.scrollTop <= scrollParent.clientHeight + 1;
                if (!(atTopPullingDown || scrolledToBottom && isPullingUp && atScrollEnd)) {
                    return;
                }
            }
            isDragging = true;
        }
        if (!isDragging) {
            return;
        }
        if (event.cancelable) {
            event.preventDefault();
        }
        let newHeight = startHeight + deltaY;
        newHeight = Math.max(0, Math.min(newHeight, fullHeight));
        if (startHeight >= fullHeight - 1 && deltaY > 0 && newHeight >= fullHeight) {
            resetInlineStyles();
            return;
        }
        if (newHeight >= fullHeight - 1) {
            resetInlineStyles();
            return;
        }
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
        }
        const currentGesture = gestureId;
        frameId = requestAnimationFrame(() => {
            frameId = null;
            if (!isDragging || currentGesture !== gestureId) {
                return;
            }
            if (newHeight >= fullHeight - 1) {
                resetInlineStyles();
                return;
            }
            let opacity = 1;
            const fadeRange = fullHeight - 50;
            if (fadeRange > 0) {
                const progress = (newHeight - 50) / fadeRange;
                opacity = Math.max(.1, Math.min(1, .1 + .9 * progress));
            }
            modal.style.height = newHeight + "px";
            overlay.style.opacity = opacity;
        });
    }
    function onTouchEnd() {
        isDragging = false;
        gestureId++;
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        if (!modal.style.height) {
            resetInlineStyles();
            return;
        }
        const currentHeight = parseFloat(modal.style.height) || 0;
        if (currentHeight >= fullHeight - 1) {
            resetInlineStyles();
        }
        else if (isDismissible) {
            if (currentHeight < fullHeight / 1.4) {
                gestureId++;
                cancelPendingWork();
                if (toggleInput) {
                    toggleInput.click();
                }
                modal.style.removeProperty("transition");
                overlay.style.removeProperty("transition");
                overlay.style.opacity = "0";
                if (toggleInput) {
                    timerId = setTimeout(() => {
                        resetInlineStyles();
                    }, 330);
                }
                else {
                    const offsetHeight = modal.offsetHeight;
                    modal.style.transition = "none";
                    overlay.style.transition = "none";
                    modal.style.height = offsetHeight + "px";
                    modal.offsetHeight;
                    modal.style.transition = "height " + 300 + "ms cubic-bezier(0.25, 0.8, 0.25, 1)";
                    overlay.style.transition = "opacity " + 300 + "ms cubic-bezier(0.25, 0.8, 0.25, 1)";
                    modal.style.height = "0px";
                    overlay.style.opacity = "0";
                    timerId = setTimeout(() => {
                        timerId = null;
                        modal.style.transition = "none";
                        overlay.style.transition = "none";
                        modal.classList.remove("active");
                        overlay.classList.remove("active");
                        modal.offsetHeight;
                        resetInlineStyles();
                    }, 300 + 30);
                }
            }
            else {
                animateToFullHeight();
            }
        }
        else {
            animateToFullHeight();
        }
    }
    function bindTouchHandlers() {
        modal.ontouchstart = onTouchStart;
        modal.ontouchmove = onTouchMove;
        modal.ontouchend = onTouchEnd;
        overlay.ontouchmove = event => {
            event.preventDefault();
            event.stopPropagation();
        };
    }
    const mediaQuery = window.matchMedia("(max-width: 450px)");
    if (mediaQuery.matches) {
        bindTouchHandlers();
    }
    mediaQuery.onchange = event => {
        if (event.matches) {
            bindTouchHandlers();
        }
        else {
            modal.ontouchstart = null;
            modal.ontouchmove = null;
            modal.ontouchend = null;
            overlay.ontouchmove = null;
            isDragging = false;
            gestureId++;
            resetInlineStyles();
        }
    };
}

// ---------- Public API ----------
window.pbd.notify = notify;

// ===== Component: ".pbd_model" =====
domWatcher.registerAll(".pbd_model", pbdModel => {
    const pbdId = pbdModel.dataset.pbdId;
    if (!pbdId) {
        return;
    }
    const overlay = document.querySelector(".pbd_overlay[data-pbd-id=\"" + CSS.escape(pbdId) + '"]');
    if (overlay) {
        enableSwipeToDismiss(pbdModel, overlay);
    }
});

// ===== Component: ".share-options" =====
domWatcher.register(".share-options", shareOptions => {
    if (!shareOptions) {
        return;
    }
    let shareOptionsOverly = document.querySelector(".share-options-overly");
    if (!shareOptions || !shareOptionsOverly) {
        return;
    }
    [shareOptions, shareOptionsOverly].forEach(element => {
        element.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
        });
    });
    let copyLink = shareOptions.querySelector(".copy-link");
    if (copyLink) {
        copyLink.onclick = event => {
            event.preventDefault();
            let link = copyLink.dataset.link;
            navigator.clipboard.writeText(link).then(() => showToast("Link Copied")).catch(error => showToast(error, false));
        };
    }
    let sysShare = shareOptions.querySelector(".sys-share");
    if (sysShare) {
        sysShare.onclick = event => {
            const shareData = {
                title: document.title,
                url: location.origin + location.pathname
            };
            event.preventDefault();
            if (navigator.share) {
                navigator.share(shareData).catch(() => {
                });
            }
        };
    }
    const shareQrModal = shareOptions?.querySelector(".share-qr-modal");
    async function setupQrSheet(sheet, closeToggle) {
        if (!window.QRGen) {
            return;
        }
        const copyLink2 = shareOptions?.querySelector(".copy-link");
        const qrImage = sheet.querySelector(".qr-image");
        const link = copyLink2?.dataset?.link;
        if (!qrImage || !link) {
            return;
        }
        let img = qrImage.querySelector("img");
        let src = img?.src;
        if (!src) {
            try {
                const linkIcon512x512 = document.querySelector("link[rel=\"icon\"][sizes=\"512x512\"]");
                // Sem proxy externo: QR gerado sem logo central (evita erro de CORS no canvas)
                const logoUrl = undefined;
                const qrOptions = {
                    url: link,
                    logo: logoUrl
                };
                src = await window.QRGen.create(qrOptions);
                img = document.createElement("img");
                img.src = src;
                img.alt = "QR Code";
                qrImage.replaceChildren(img);
            }
            catch (error) {
                return;
            }
        }
        const fileName = "QR_Code_" + Math.floor(1e9 * Math.random()) + ".png";
        const content = sheet.querySelector(".content");
        const save = content.querySelector(".save");
        const copy = content.querySelector(".copy");
        const share = content.querySelector(".share");
        const close = content.querySelector(".close");
        if (save) {
            save.onclick = () => {
                const link2 = document.createElement("a");
                link2.href = src;
                link2.download = fileName;
                link2.click();
                link2.remove();
            };
        }
        if (copy) {
            copy.onclick = async () => {
                if (!navigator.clipboard || !window.ClipboardItem) {
                    return showToast("Image copy isn't supported.", false);
                }
                try {
                    const response = await fetch(src);
                    if (!response.ok) {
                        return;
                    }
                    const blob = await response.blob();
                    const clipboardData = { [blob.type]: blob };
                    await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
                    showToast("QR image copied to clipboard");
                }
                catch (error) {
                    showToast("Clipboard copy failed", false);
                }
            };
        }
        if (share) {
            share.onclick = async () => {
                if (navigator.share) {
                    try {
                        const response = await fetch(src);
                        if (!response.ok) {
                            return;
                        }
                        const fileOptions = {
                            type: "image/png"
                        };
                        const blob = await response.blob();
                        const file = new File([blob], fileName, fileOptions);
                        const shareCheck = {
                            files: [file]
                        };
                        if (navigator.canShare && !navigator.canShare(shareCheck)) {
                            return;
                        }
                        const shareData = {
                            title: fileName,
                            files: [file]
                        };
                        await navigator.share(shareData);
                    }
                    catch (error) {
                    }
                }
            };
        }
        if (close) {
            close.onclick = () => closeToggle?.click();
        }
    }
    if (shareQrModal) {
        shareQrModal.addEventListener("click", function () {
            const openShare = document.getElementById("open-share");
            const openQr = document.getElementById("open-qr");
            if (openShare) {
                openShare.click();
            }
            if (openQr) {
                openQr.click();
            }
            const qrShareSheet = document.querySelector(".qr-share-sheet");
            const qrModalOverlay = document.querySelector(".qr-modal-overlay");
            if (qrShareSheet && qrModalOverlay) {
                if (window.QRGen) {
                    return setupQrSheet(qrShareSheet, openQr);
                }
                if (!window.QRGen) {
                    const script = document.createElement("script");
                    script.src = "https://harlleyreboucas.github.io/creditos/qr.js";
                    script.onload = () => window.QRGen && setupQrSheet(qrShareSheet, openQr);
                    document.head.append(script);
                }
            }
        });
    }
});

// ===== Component: "header .slider" =====
domWatcher.register("header .slider", slider => {
    if (!slider) {
        return;
    }
    const sliderOverlay = document.querySelector("header .slider-overlay");
    const openSidebar = document.getElementById("open-sidebar");
    if (!sliderOverlay || !openSidebar) {
        return;
    }
    let startX = 0;
    let startY = 0;
    let currentOffset = 0;
    let isHorizontalSwipe = false;
    let directionDetected = false;
    const offsetWidth = slider.offsetWidth;
    function resetStyles() {
        slider.style.transition = "";
        slider.style.transform = "";
        sliderOverlay.style.transition = "";
        sliderOverlay.style.opacity = "";
    }
    slider.ontouchstart = function (event) {
        if (!openSidebar.checked) {
            return;
        }
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        currentOffset = 0;
        isHorizontalSwipe = false;
        directionDetected = false;
        slider.style.transition = "none";
        sliderOverlay.style.transition = "none";
    };
    slider.ontouchmove = function (event) {
        if (!openSidebar.checked) {
            return;
        }
        const touch = event.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        if (!directionDetected && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
            directionDetected = true;
            isHorizontalSwipe = true;
        }
        if (isHorizontalSwipe && directionDetected) {
            currentOffset = Math.min(0, Math.max(-offsetWidth, deltaX));
            const progress = Math.abs(currentOffset) / offsetWidth;
            slider.style.transform = "translateX(" + currentOffset + "px)";
            sliderOverlay.style.opacity = 1 - progress;
            if (event.cancelable) {
                event.preventDefault();
            }
        }
    };
    slider.ontouchend = function () {
        if (isHorizontalSwipe && directionDetected) {
            if (Math.abs(currentOffset) > .3 * offsetWidth) {
                slider.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
                sliderOverlay.style.transition = "opacity 0.3s";
                slider.style.transform = "translateX(-" + offsetWidth + "px)";
                sliderOverlay.style.opacity = "0";
                const onTransitionEnd = () => {
                    openSidebar.checked = false;
                    resetStyles();
                    slider.removeEventListener("transitionend", onTransitionEnd);
                };
                slider.addEventListener("transitionend", onTransitionEnd);
            }
            else {
                resetStyles();
            }
            isHorizontalSwipe = false;
            directionDetected = false;
        }
        else {
            resetStyles();
        }
    };
});

// ===== Plugin: Cookie Consent =====
domWatcher.register(pluginSelector("Cookie Consent"), script => {
    if (script) {
        try {
            let data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            if (!cookies.has("cookie_consent")) {
                const banner = document.createElement("div");
                banner.className = "cookie";
                const messageEl = document.createElement("div");
                messageEl.className = "msg";
                messageEl.textContent = data.message || "";
                const buttonsEl = document.createElement("div");
                buttonsEl.className = "btns";
                const link = document.createElement("a");
                link.className = "policy";
                link.href = data.more.link || "#";
                link.textContent = data.more.text;
                const acceptButton = document.createElement("div");
                acceptButton.className = "accept";
                acceptButton.textContent = data.accept || "Accept";
                buttonsEl.append(link, acceptButton);
                banner.append(messageEl, buttonsEl);
                document.body.append(banner);
                requestAnimationFrame(() => banner.classList.add("active"));
                acceptButton.onclick = () => {
                    cookies.set("cookie_consent", "true", 30);
                    banner.classList.remove("active");
                    banner.ontransitionend = () => banner.remove();
                };
            }
        }
        catch (error) {
        }
    }
});

// ===== Plugin: Dynamic Shortcode =====
domWatcher.register(pluginSelector("Dynamic Shortcode"), script => {
    if (script) {
        try {
            if (!JSON.parse(script.textContent).status) {
                return;
            }
            function parseAttributes(attributeString) {
                const attributes = {};
                const regex = /(\w+)="([^"]+)"/g;
                let match;
                while (match = regex.exec(attributeString)) {
                    attributes[match[1]] = match[2];
                }
                return attributes;
            }
            function fillTemplate(template, values, content = "") {
                Object.entries(values).forEach(([key, value]) => {
                    template = template.replace(new RegExp("@{" + key + "}", "g"), value);
                });
                return template.replace(/@{}/g, content);
            }
            const shortcode = document.getElementById("Shortcode");
            if (!shortcode) {
                return;
            }
            const text = shortcode.textContent.trim();
            if (!text) {
                return;
            }
            const templates = function (html) {
                const result = {};
                const container = document.createElement("div");
                container.innerHTML = html;
                container.querySelectorAll(".widget").forEach(widget => {
                    const h3 = widget.querySelector(".title h3");
                    const content = widget.querySelector(".content");
                    if (h3 && content) {
                        result[h3.innerText.trim().toLowerCase()] = content.innerHTML.trim();
                    }
                });
                return result;
            }(text);
            const postBody = document.querySelector(".post-body");
            if (!postBody) {
                return;
            }
            (function (root, templates) {
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
                const comments = [];
                while (walker.nextNode()) {
                    comments.push(walker.currentNode);
                }
                comments.forEach(comment => {
                    const commentText = comment.nodeValue.trim();
                    let replacement = null;
                    for (const [name, template] of Object.entries(templates)) {
                        const regex = new RegExp("^\\[" + name + "(.*?)\\]([\\s\\S]*?)\\[\\/" + name + "\\]$", "i");
                        const match = commentText.match(regex);
                        if (match) {
                            replacement = fillTemplate(template, parseAttributes(match[1]), match[2]);
                            break;
                        }
                        const regex2 = new RegExp("^\\[" + name + "(.*?)\\/\\]$", "i");
                        const match2 = commentText.match(regex2);
                        if (match2) {
                            replacement = fillTemplate(template, parseAttributes(match2[1]));
                            break;
                        }
                    }
                    if (replacement) {
                        const range = document.createRange();
                        range.selectNode(comment);
                        const fragment = range.createContextualFragment(replacement);
                        comment.replaceWith(fragment);
                    }
                });
            })(postBody, templates);
        }
        catch (error) {
        }
    }
});

// ===== Component: "noscript.lazy" =====
domWatcher.registerAll("noscript.lazy", lazy => {
    const div = document.createElement("div");
    div.innerHTML = lazy.textContent.trim();
    lazy.replaceWith(div);
});

// ===== Back-to-top button =====
(() => {
    let backToTop = document.createElement("div");
    backToTop.classList.add("back-to-top");
    backToTop.innerHTML = iconHtml("up") + "Back to Top";
    document.pbd.appendChild(backToTop);
    let lastScrollY = 0;
    window.addEventListener("scroll", function () {
        let currentScrollY = window.pageYOffset;
        if (currentScrollY < lastScrollY && currentScrollY > 100) {
            backToTop.classList.add("active");
        }
        else {
            backToTop.classList.remove("active");
        }
        lastScrollY = currentScrollY;
    });
    backToTop.onclick = () => window.scrollTo(0, 0);
})();

// ===== Component: ".dark-mode" =====
domWatcher.register(".dark-mode", darkMode => {
    const documentElement = document.documentElement;
    const body = document.body;
    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.name = "theme-color";
        metaThemeColor.content = "#ffffff";
        document.head.appendChild(metaThemeColor);
    }
    if (!sessionStorage.getItem("lightColor")) {
        sessionStorage.setItem("lightColor", metaThemeColor.content || "#ffffff");
    }
    const mediaQuery = matchMedia("(prefers-color-scheme: dark)");
    const mediaQuery2 = matchMedia("(prefers-reduced-motion: reduce)");
    function applyTheme(mode, persist = true) {
        const lightColor = sessionStorage.getItem("lightColor") || "#ffffff";
        if (mode === "dark") {
            body.classList.add("dark");
            metaThemeColor.content = "#121212";
            if (persist) {
                localStorage.setItem("themeMode", "dark");
            }
        }
        else if (mode === "light") {
            body.classList.remove("dark");
            metaThemeColor.content = lightColor;
            if (persist) {
                localStorage.setItem("themeMode", "light");
            }
        }
        else {
            if (mediaQuery.matches) {
                body.classList.add("dark");
                metaThemeColor.content = "#121212";
            }
            else {
                body.classList.remove("dark");
                metaThemeColor.content = lightColor;
            }
            if (persist) {
                localStorage.removeItem("themeMode");
            }
        }
    }
    mediaQuery.onchange = () => {
        if (!localStorage.getItem("themeMode")) {
            applyTheme(null, false);
        }
    };
    if (darkMode) {
        darkMode.onclick = function (event) {
            const nextMode = function () {
                const themeMode = localStorage.getItem("themeMode");
                const isDark = body.classList.contains("dark");
                return themeMode === "dark" ? "light" : themeMode === "light" ? "dark" : isDark ? "light" : "dark";
            }();
            if (!document.startViewTransition || mediaQuery2.matches) {
                applyTheme(nextMode);
                return;
            }
            const isDarkToLight = body.classList.contains("dark") && nextMode === "light";
            document.startViewTransition(() => {
                applyTheme(nextMode);
            }).ready.then(() => {
                const startTransform = isDarkToLight ? "translate3d(0, 100%, 0)" : "translate3d(0, -100%, 0)";
                const keyframes = {
                    transform: [startTransform, "translate3d(0, 0, 0)"]
                };
                const timing = {
                    duration: 350,
                    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                    pseudoElement: "::view-transition-new(root)"
                };
                documentElement.animate(keyframes, timing);
            });
        };
    }
    applyTheme(localStorage.getItem("themeMode"), false);
});

// ===== Plugin: Live Search =====
domWatcher.register(pluginSelector("Live Search"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            const search = document.querySelector("header .search");
            if (!search) {
                return;
            }
            const form = search.querySelector("form");
            const input = form.querySelector("input");
            const close = form.querySelector(".close");
            const results = search.querySelector(".results");
            const cont = search.querySelector(".cont");
            if (!form || !input || !results) {
                return;
            }
            const clearResults = () => {
                results.textContent = "";
                results.classList.remove("active", "no-result");
            };
            const showNoResults = query => {
                clearResults();
                const paragraph = document.createElement("p");
                const uEl = document.createElement("u");
                uEl.textContent = query;
                const parts = data.noResult.split("#{q}");
                paragraph.append(parts[0] || "", uEl, parts[1] || "");
                results.appendChild(paragraph);
                results.classList.add("no-result");
            };
            const createResultItem = post => {
                const article = document.createElement("article");
                article.className = "item";
                const thumbnailEl = document.createElement("div");
                thumbnailEl.className = "thumbnail";
                const link = document.createElement("a");
                link.href = post.link;
                const image = document.createElement("img");
                image.className = "lazy";
                image.src = placeholderImage(80, 60);
                image.dataset.src = post.cropped(160, 120);
                link.appendChild(image);
                thumbnailEl.appendChild(link);
                const titleMeta = document.createElement("div");
                titleMeta.className = "title-meta";
                const heading = document.createElement("h3");
                heading.className = "title";
                const link2 = document.createElement("a");
                link2.href = post.link;
                link2.textContent = post.title;
                let span = document.createElement("span");
                span.className = "date";
                span.innerHTML = iconHtml("clock") + post.date;
                heading.appendChild(link2);
                titleMeta.append(heading, span);
                article.appendChild(thumbnailEl);
                article.appendChild(titleMeta);
                return article;
            };
            const renderResults = posts => {
                clearResults();
                const fragment = document.createDocumentFragment();
                posts.forEach(post => {
                    fragment.appendChild(createResultItem(post));
                });
                results.appendChild(fragment);
                results.classList.add("active");
            };
            const runSearch = query => {
                clearResults();
                results.classList.add("active");
                form.classList.add("loading");
                const url = feedSummaryUrl + "&q=" + encodeURIComponent(query);
                fetchFeedEntries(url).then(result => {
                    form.classList.remove("loading");
                    if (result.length) {
                        renderResults(result);
                    }
                    else {
                        showNoResults(query);
                    }
                }).catch(() => {
                    form.classList.remove("loading");
                    showNoResults(query);
                });
            };
            let debounceTimer;
            form.onsubmit = event => {
                event.preventDefault();
                const text = new FormData(form).get("q").trim();
                if (!text) {
                    return;
                }
                const link = document.createElement("a");
                link.href = form.action + "?q=" + encodeURIComponent(text);
                document.body.appendChild(link);
                link.click();
                link.remove();
            };
            if (cont) {
                cont.ontransitionend = () => input.focus();
            }
            if (close) {
                close.onclick = () => {
                    input.value = "";
                    clearResults();
                };
            }
            input.oninput = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const text = input.value.trim();
                    if (text) {
                        runSearch(text);
                    }
                    else {
                        clearResults();
                    }
                }, 300);
            };
        }
        catch (error) {
        }
    }
});

// ===== Plugin: Adsense (loads the AdSense script) =====
(() => {
    const configScript = getPluginScript("Adsense");
    if (configScript) {
        try {
            const data = JSON.parse(configScript.textContent);
            if (!data.status) {
                return;
            }
            if (typeof window.adsbygoogle == "object" && window.adsbygoogle.loaded === true) {
                return;
            }
            const script = document.createElement("script");
            script.async = true;
            script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-" + data.publication;
            script.crossOrigin = "anonymous";
            document.head.appendChild(script);
        }
        catch {
        }
    }
})();

// ===== Plugin: AdBlock =====
domWatcher.register(pluginSelector("AdBlock"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            const image = new Image();
            image.src = "https://harlleyreboucas.github.io/creditos/1x1.png?" + Date.now();
            image.onload = () => {
                const image2 = new Image();
                image2.src = "https://pagead2.googlesyndication.com/pagead/imgad?t=" + Date.now();
                image2.onerror = () => {
                    const popupOptions = {
                        title: data.title,
                        message: data.text,
                        closeText: data.btn.ok,
                        closable: data.closable
                    };
                    showPopup(popupOptions);
                };
            };
            image.onerror = () => {
            };
        }
        catch {
        }
    }
});

// ===== Plugin: Analytics (Google Analytics gtag) =====
(() => {
    const configScript = getPluginScript("Analytics");
    if (configScript) {
        try {
            const data = JSON.parse(configScript.textContent);
            if (!data.status || !data.measurementId) {
                return;
            }
            if (document.querySelector("script[src*=\"gtag/js?id=" + data.measurementId + '"]')) {
                return;
            }
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function () {
                window.dataLayer.push(arguments);
            };
            window.gtag("js", new Date());
            window.gtag("config", data.measurementId);
            const script = document.createElement("script");
            script.async = true;
            script.src = "https://www.googletagmanager.com/gtag/js?id=" + data.measurementId;
            document.head.appendChild(script);
        }
        catch {
        }
    }
})();

// ===== Plugin: Favorite =====
domWatcher.register(pluginSelector("Favorite"), script => {
    if (!script) {
        return disableFavorites();
    }
    let config;
    try {
        config = JSON.parse(script.textContent);
        if (!config.status) {
            return disableFavorites();
        }
    }
    catch {
        return disableFavorites();
    }
    const total = config.total;
    let favorites = JSON.parse(localStorage.getItem("favourites")) || [];
    function saveFavorites(badge) {
        localStorage.setItem("favourites", JSON.stringify(favorites));
        updateBadge(badge);
        updateAddButtons();
    }
    function updateBadge(badge) {
        if (badge) {
            if (favorites.length) {
                badge.dataset.num = favorites.length;
            }
            else {
                delete badge.dataset.num;
            }
        }
    }
    function renderFavorites(listEl, badge) {
        if (listEl) {
            listEl.innerHTML = "";
            if (!favorites.length) {
                const emptyMessage = document.createElement("div");
                emptyMessage.className = "no-result";
                emptyMessage.textContent = config.nofavorites;
                listEl.appendChild(emptyMessage);
                updateBadge(badge);
                return;
            }
            favorites.slice().reverse().forEach(entry => {
                listEl.appendChild(function (favorite, badge, listEl) {
                    const article = document.createElement("article");
                    article.className = "item";
                    const content = document.createElement("div");
                    content.className = "cont";
                    const thumbnailEl = document.createElement("div");
                    thumbnailEl.className = "thumbnail";
                    const link = document.createElement("a");
                    link.href = favorite.url;
                    const image = document.createElement("img");
                    image.className = "lazy";
                    image.dataset.src = favorite.src;
                    image.src = placeholderImage(80, 60);
                    link.appendChild(image);
                    thumbnailEl.appendChild(link);
                    content.appendChild(thumbnailEl);
                    const titleMeta = document.createElement("div");
                    titleMeta.className = "title-meta";
                    const heading = document.createElement("h3");
                    heading.className = "title";
                    const link2 = document.createElement("a");
                    link2.href = favorite.url;
                    link2.textContent = favorite.title;
                    heading.appendChild(link2);
                    if (favorite.savedAt) {
                        const span = document.createElement("span");
                        span.className = "saved-at";
                        span.innerHTML = iconHtml("clock") + function (timestamp) {
                            if (!timestamp) {
                                return "";
                            }
                            const savedDate = new Date(timestamp);
                            const now = new Date();
                            const savedDay = new Date(savedDate.getFullYear(), savedDate.getMonth(), savedDate.getDate());
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const daysAgo = Math.floor((today - savedDay) / 864e5);
                            const dateOptions = {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                            };
                            return daysAgo <= 7 ? daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : daysAgo + " days ago" : savedDate.toLocaleDateString(undefined, dateOptions);
                        }(favorite.savedAt);
                        titleMeta.append(heading, span);
                    }
                    else {
                        titleMeta.appendChild(heading);
                    }
                    content.appendChild(titleMeta);
                    const deleteButton = document.createElement("div");
                    deleteButton.className = "del";
                    deleteButton.innerHTML = iconHtml("trash");
                    deleteButton.onclick = () => {
                        (function (url, badge, listEl) {
                            if (document.querySelector(".pop-ov.fav-del")) {
                                return;
                            }
                            const popupOptions = {
                                title: config.del.title,
                                message: config.del.text,
                                actionText: config.del.delete,
                                closeText: config.del.cancel,
                                className: "fav-del",
                                closable: true
                            };
                            const { action: confirmButton, close: closePopup } = showPopup(popupOptions);
                            if (confirmButton) {
                                confirmButton.onclick = () => {
                                    favorites = favorites.filter(favorite => favorite.url !== url);
                                    saveFavorites(badge);
                                    renderFavorites(listEl, badge);
                                    showToast(config.deleted);
                                    closePopup();
                                };
                            }
                        })(favorite.url, badge, listEl);
                    };
                    article.appendChild(content);
                    article.appendChild(deleteButton);
                    return article;
                }(entry, badge, listEl));
            });
            updateBadge(badge);
        }
    }
    function updateAddButtons() {
        document.querySelectorAll(".add-favorite").forEach(addFavorite => {
            const url = addFavorite.dataset.url;
            const isSaved = favorites.some(favorite => favorite.url === url);
            addFavorite.innerHTML = "";
            if (addFavorite.classList.contains("context-fav")) {
                addFavorite.append(function (iconHtml, label) {
                    const iconTitle = document.createElement("span");
                    iconTitle.className = "icon-title";
                    const iconEl = document.createElement("span");
                    iconEl.innerHTML = iconHtml;
                    const labelEl = document.createElement("span");
                    labelEl.textContent = label;
                    iconTitle.append(iconEl, labelEl);
                    return iconTitle;
                }(iconHtml(isSaved ? "trash" : "heart"), isSaved ? "Remove" : "Add"));
            }
            else {
                addFavorite.innerHTML = iconHtml(isSaved ? "trash" : "heart");
            }
        });
    }
    function disableFavorites() {
        document.querySelectorAll(".favorite, .add-favorite").forEach(addFavorite => {
            addFavorite.style.pointerEvents = "none";
            addFavorite.style.opacity = "0.4";
        });
    }
    (function () {
        const favorite = document.querySelector("header .favorite");
        if (!favorite) {
            return disableFavorites();
        }
        renderFavorites(favorite.querySelector(".results"), favorite.querySelector(".open-favorite"));
        updateAddButtons();
    })();
    domWatcher.registerAll(".add-favorite", function (addFavorite) {
        addFavorite.onclick = () => function (button) {
            const { src: src, url: url, title: title } = button.dataset;
            const index = favorites.findIndex(favorite => favorite.url === url);
            if (index === -1) {
                if (favorites.length >= total) {
                    showToast(config.maximum, false);
                    return;
                }
                favorites.push({
                    src: src,
                    url: url,
                    title: title,
                    savedAt: Date.now()
                });
                showToast(config.added);
            }
            else {
                favorites.splice(index, 1);
                showToast(config.deleted);
            }
            saveFavorites(document.querySelector(".favorite .open-favorite"));
            renderFavorites(document.querySelector(".favorite .results"), document.querySelector(".favorite .open-favorite"));
        }(addFavorite);
        updateAddButtons();
    });
});

// ===== Plugin: Network Status =====
domWatcher.register(pluginSelector("Network Status"), (script, state) => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            let onLine = navigator.onLine;
            const checkConnection = () => {
                if (navigator.onLine) {
                    const image = new Image();
                    image.onload = () => {
                        if (!onLine) {
                            onLine = true;
                            showToast(data.online);
                        }
                    };
                    image.src = "https://harlleyreboucas.github.io/creditos/1x1.png?" + Date.now();
                }
                else {
                    if (onLine) {
                        onLine = false;
                        showToast(data.offline, false);
                    }
                }
            };
            if (state.online) {
                window.removeEventListener("online", state.online);
            }
            if (state.offline) {
                window.removeEventListener("offline", state.offline);
            }
            state.online = checkConnection;
            state.offline = checkConnection;
            window.addEventListener("online", state.online);
            window.addEventListener("offline", state.offline);
            checkConnection();
        }
        catch (error) {
        }
    }
});

// ===== Component: ".widget.my-stories" =====
domWatcher.register(".widget.my-stories", widgetMyStories => {
    if (!widgetMyStories) {
        return;
    }
    const { label: label, results: results } = widgetMyStories.dataset;
    if (label && results) {
        fetchFeedEntries(feedSummaryUrl + "&category=" + label + "&max-results" + "=" + results).then(result => {
            if (!result.length) {
                return;
            }
            widgetMyStories.innerHTML = "";
            const fragment = document.createDocumentFragment();
            result.forEach((story, index) => {
                const storyItem = document.createElement("div");
                storyItem.className = "stories-item";
                storyItem.dataset.index = index;
                const thumbnail = document.createElement("div");
                thumbnail.className = "thumbnail";
                const image = document.createElement("img");
                image.className = "story-image lazy";
                image.dataset.src = story.cropped(100, 150);
                image.src = placeholderImage(100, 150);
                const link = document.createElement("a");
                link.className = "blur";
                link.href = story.link;
                const caption = document.createElement("div");
                caption.className = "content-curve";
                caption.textContent = story.title;
                link.appendChild(caption);
                thumbnail.appendChild(image);
                thumbnail.appendChild(link);
                storyItem.appendChild(thumbnail);
                fragment.appendChild(storyItem);
            });
            widgetMyStories.appendChild(fragment);
        }).catch(() => {
        });
    }
});

// ===== Component: ".widget .featured" =====
domWatcher.registerAll(".widget .featured", featured => {
    const { label: label, results: results, id: excludeId } = featured.dataset;
    const feedOptions = {
        filter: excludeId
    };
    if (label && results) {
        fetchFeedEntries(feedSummaryUrl + "&category=" + label + "&max-results" + "=" + results, feedOptions).then(result => !result.length && excludeId ? fetchFeedEntries("" + feedSummaryUrl + "&max-results" + "=" + results) : result).then(result => {
            featured.innerHTML = "";
            if (!result.length) {
                let message = document.createElement("div");
                message.className = "no-post-found";
                message.textContent = excludeId ? "No related posts found." : "No posts available in this category.";
                featured.append(message);
                return;
            }
            let fragment = document.createDocumentFragment();
            let recentPosts = document.createElement("div");
            recentPosts.classList.add("recent-posts");
            featured.appendChild(recentPosts);
            result.forEach(post => {
                const article = document.createElement("article");
                article.classList.add("recent-post");
                const thumbnail = document.createElement("div");
                thumbnail.classList.add("thumbnail");
                const link = document.createElement("a");
                link.href = post.link;
                const image = document.createElement("img");
                image.alt = post.title;
                image.classList.add("lazy");
                image.dataset.src = post.cropped(200, 140);
                image.src = placeholderImage(100, 70);
                link.appendChild(image);
                thumbnail.appendChild(link);
                const container = document.createElement("div");
                container.classList.add("recent-container");
                const heading = document.createElement("h3");
                const link2 = document.createElement("a");
                link2.href = post.link;
                link2.textContent = post.title;
                heading.appendChild(link2);
                const meta = document.createElement("div");
                meta.classList.add("recent-meta");
                const dateEl = document.createElement("span");
                dateEl.innerHTML = iconHtml("clock") + " " + post.date;
                const commentsEl = document.createElement("span");
                commentsEl.innerHTML = iconHtml("comments") + " " + post.comments;
                const authorEl = document.createElement("span");
                authorEl.innerHTML = iconHtml("user") + " " + post.author;
                meta.append(dateEl, commentsEl, authorEl);
                container.append(heading, meta);
                article.append(thumbnail, container);
                fragment.appendChild(article);
            });
            recentPosts.appendChild(fragment);
        }).catch(() => {
        });
    }
});

// ===== Plugin: Contact Form =====
domWatcher.register(pluginSelector("Contact Form"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status || !window.location.pathname.startsWith(data.location)) {
                return;
            }
            const postBody = document.querySelector(".post-body");
            if (!postBody) {
                return;
            }
            const form = document.createElement("form");
            form.classList.add("contact-form");
            const nameEmailRow = document.createElement("div");
            nameEmailRow.classList.add("name-email");
            form.appendChild(nameEmailRow);
            const createField = (id, type, labelText, placeholder) => {
                const group = document.createElement("div");
                group.classList.add("form-group");
                const label = document.createElement("label");
                let input;
                label.htmlFor = id;
                label.textContent = labelText;
                if (type === "textarea") {
                    input = document.createElement("textarea");
                    input.id = id;
                    input.name = id;
                    input.placeholder = placeholder;
                }
                else {
                    input = document.createElement("input");
                    input.type = type;
                    input.id = id;
                    input.name = id;
                    input.placeholder = placeholder;
                }
                input.required = true;
                group.append(label, input);
                return {
                    group: group,
                    input: input
                };
            };
            const { group: nameGroup, input: nameInput } = createField("name", "text", data.lbs.nm, data.plhd.nm);
            const { group: emailGroup, input: emailInput } = createField("email", "email", data.lbs.em, data.plhd.em);
            const { group: messageGroup, input: messageInput } = createField("message", "textarea", data.lbs.ms, data.plhd.ms);
            nameEmailRow.append(nameGroup, emailGroup);
            form.appendChild(messageGroup);
            const buttonRow = document.createElement("div");
            buttonRow.classList.add("btns");
            const sendButton = document.createElement("button");
            sendButton.type = "submit";
            sendButton.classList.add("send");
            sendButton.textContent = data.btn.sn;
            const resetButton = document.createElement("button");
            resetButton.type = "reset";
            resetButton.classList.add("reset");
            resetButton.textContent = data.btn.rs;
            buttonRow.append(resetButton, sendButton);
            form.appendChild(buttonRow);
            postBody.appendChild(form);
            form.onsubmit = event => {
                event.preventDefault();
                showToast(data.msg.sd);
                const widgetXToken = document.querySelector(".widget.x-token");
                if (!widgetXToken) {
                    return;
                }
                const token = widgetXToken.dataset.token;
                const id = widgetXToken.dataset.id;
                const formData = new FormData(form);
                formData.append("blogID", id);
                formData.append("token", token);
                fetch("https://www.blogger.com/contact-form.do", {
                    method: "POST",
                    body: formData
                }).then(response => response.json()).then(json => {
                    if (json.details.emailSentStatus === "true") {
                        showToast(data.msg.sc);
                        form.reset();
                    }
                    else {
                        showToast(data.msg.fe, false);
                    }
                }).catch(() => showToast(data.msg.fe, false));
            };
        }
        catch {
        }
    }
});

// ===== Plugin: Sitemap =====
domWatcher.register(pluginSelector("Sitemap"), script => {
    if (!script) {
        return;
    }
    let config;
    try {
        config = JSON.parse(script.textContent);
    }
    catch (error) {
        return;
    }
    if (!config.status || !location.pathname.startsWith(config.location)) {
        return;
    }
    const postBody = document.querySelector(".post-body");
    if (!postBody) {
        return;
    }
    const feedUrl = feedSummaryUrl + "&max-results" + "=150";
    const entries = [];
    const loadingEl = document.createElement("div");
    async function fetchEntries(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            const entry = data.feed.entry || [];
            entries.push(...entry);
            const found = data.feed.link.find(item => item.rel === "next");
            if (found) {
                const url = new URL(found.href);
                const replaced = url.pathname.replace(/\/\d+\//, "/");
                const nextUrl = siteOrigin + replaced + url.search;
                await fetchEntries(nextUrl);
            }
        }
        catch (error) {
        }
    }
    loadingEl.className = "sitemap-loading";
    loadingEl.textContent = "Loading sitemap...";
    postBody.appendChild(loadingEl);
    (async function () {
        await fetchEntries(feedUrl);
        const entriesByLabel = function (allEntries) {
            const groups = {};
            allEntries.forEach(entry => {
                const fallback = {
                    term: "Uncategorized"
                };
                (entry.category || [fallback]).forEach(category => {
                    if (!groups[category.term]) {
                        groups[category.term] = [];
                    }
                    groups[category.term].push(entry);
                });
            });
            return groups;
        }(entries);
        const labelsContainer = document.createElement("div");
        labelsContainer.className = "sitemap-labels";
        Object.keys(entriesByLabel).sort().forEach(label => {
            labelsContainer.appendChild(function (label, posts) {
                const labelItem = document.createElement("div");
                labelItem.className = "label-item";
                const header = document.createElement("div");
                header.className = "label-header";
                header.innerHTML = "\n      <span>" + label + "</span>\n      <em>" + posts.length + "</em>\n    ";
                const body = document.createElement("div");
                body.className = "label-body";
                body.style.height = "0px";
                const list = document.createElement("ul");
                list.className = "label-list";
                body.appendChild(list);
                labelItem.append(header, body);
                header.onclick = function () {
                    if (labelItem.classList.contains("open")) {
                        body.style.height = body.scrollHeight + "px";
                        requestAnimationFrame(() => {
                            body.style.height = "0px";
                        });
                        labelItem.classList.remove("open");
                    }
                    else {
                        labelItem.classList.add("open");
                        body.style.height = body.scrollHeight + "px";
                        body.ontransitionend = function () {
                            if (labelItem.classList.contains("open")) {
                                body.style.height = "auto";
                            }
                            body.ontransitionend = null;
                        };
                    }
                };
                (function (posts, listEl) {
                    let offset = 0;
                    (function renderBatch() {
                        posts.slice(offset, offset + 20).forEach(post => {
                            const found = post.link.find(link => link.rel === "alternate");
                            if (!found) {
                                return;
                            }
                            const listItem = document.createElement("li");
                            listItem.innerHTML = "<a href=\"" + found.href + '">' + post.title.$t + "</a>";
                            listEl.appendChild(listItem);
                        });
                        offset += 20;
                        if (offset < posts.length) {
                            requestAnimationFrame(renderBatch);
                        }
                    })();
                })(posts, list);
                return labelItem;
            }(label, entriesByLabel[label]));
        });
        loadingEl.remove();
        postBody.appendChild(labelsContainer);
    })();
});

// ===== Plugin: Pagination =====
domWatcher.register(pluginSelector("Pagination"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            const multiPagination = document.querySelector(".multi-pagination");
            if (!multiPagination) {
                return;
            }
            const paginationTexts = {
                loadmore: multiPagination.dataset.more,
                error: multiPagination.dataset.error,
                loading: multiPagination.dataset.loading,
                nomore: multiPagination.dataset.nomore
            };
            const texts = paginationTexts;
            const setupLoadMore = () => {
                if (multiPagination.dataset.olderUrl) {
                    const loadMore = document.createElement("div");
                    loadMore.className = "load-more";
                    const link = document.createElement("a");
                    link.href = multiPagination.dataset.olderUrl;
                    link.textContent = texts.loadmore;
                    loadMore.appendChild(link);
                    multiPagination.textContent = "";
                    multiPagination.appendChild(loadMore);
                }
                const moreLink = multiPagination.querySelector(".load-more a");
                const recentPosts = document.querySelector(".recent-posts");
                if (moreLink && recentPosts && !moreLink.dataset.bound) {
                    moreLink.dataset.bound = "true";
                    moreLink.onclick = async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const href = moreLink.href;
                        moreLink.classList.add("loading");
                        moreLink.innerHTML = texts.loading;
                        try {
                            const response = await fetch(href);
                            const text = await response.text();
                            const doc = (new DOMParser()).parseFromString(text, "text/html");
                            const elements = doc.querySelectorAll(".recent-posts > *");
                            const fragment = document.createDocumentFragment();
                            elements.forEach(element => fragment.appendChild(element));
                            fragment.querySelectorAll("script").forEach(oldScript => {
                                const newScript = document.createElement("script");
                                Array.from(oldScript.attributes).forEach(attribute => {
                                    newScript.setAttribute(attribute.name, attribute.value);
                                });
                                newScript.text = oldScript.text;
                                oldScript.parentNode.replaceChild(newScript, oldScript);
                            });
                            recentPosts.appendChild(fragment);
                            moreLink.classList.remove("loading");
                            const nextLink = doc.querySelector(".multi-pagination .next-page a");
                            if (nextLink) {
                                moreLink.href = nextLink.href;
                                moreLink.innerHTML = texts.loadmore;
                            }
                            else {
                                moreLink.innerHTML = texts.nomore;
                                moreLink.href = "#no-more";
                                moreLink.classList.add("disabled");
                            }
                        }
                        catch (error) {
                            moreLink.innerHTML = texts.error;
                            moreLink.classList.remove("loading");
                        }
                    };
                }
            };
            const setupNumberedPagination = () => {
                if (window.location.pathname === "/search" && /[?&]q=/.test(window.location.search)) {
                    return setupLoadMore();
                }
                const multiPagination2 = document.querySelector(".multi-pagination");
                const dataOlderUrl = multiPagination2.getAttribute("data-older-url");
                const dataNewerUrl = multiPagination2.getAttribute("data-newer-url");
                let perPage = 0;
                let currentStart = 0;
                let updatedMax = null;
                if (dataOlderUrl) {
                    const url = new URL(dataOlderUrl);
                    perPage = parseInt(url.searchParams.get("max-results")) || 0;
                    currentStart = parseInt(url.searchParams.get("start")) || 0;
                    updatedMax = url.searchParams.get("updated-max");
                }
                else if (dataNewerUrl) {
                    const url = new URL(dataNewerUrl);
                    perPage = parseInt(url.searchParams.get("max-results")) || 0;
                }
                const params = new URLSearchParams(window.location.search);
                const startParam = parseInt(params.get("start")) || 1;
                if (startParam !== 1) {
                    const remaining = perPage - (currentStart - startParam);
                    if (remaining > 0) {
                        fetchFeedEntries("" + feedSummaryUrl + "&max-results" + "=" + remaining + "&published-max=" + updatedMax + "&start-index=2").then(result => {
                            if (!result.length) {
                                return;
                            }
                            const recentPosts = document.querySelector(".recent-posts");
                            const fragment = document.createDocumentFragment();
                            result.forEach(post => {
                                const article = document.createElement("article");
                                article.classList.add("recent-post");
                                const thumbnail = document.createElement("div");
                                thumbnail.classList.add("thumbnail");
                                const link = document.createElement("a");
                                link.href = post.link;
                                const image = document.createElement("img");
                                image.alt = post.title;
                                image.classList.add("lazy");
                                image.dataset.src = post.cropped(200, 140);
                                image.src = placeholderImage(100, 70);
                                link.appendChild(image);
                                thumbnail.appendChild(link);
                                const container = document.createElement("div");
                                container.classList.add("recent-container");
                                const heading = document.createElement("h3");
                                const link2 = document.createElement("a");
                                link2.href = post.link;
                                link2.textContent = post.title;
                                heading.appendChild(link2);
                                const meta = document.createElement("div");
                                meta.classList.add("recent-meta");
                                const dateEl = document.createElement("span");
                                dateEl.innerHTML = iconHtml("clock") + " " + post.date;
                                const commentsEl = document.createElement("span");
                                commentsEl.innerHTML = iconHtml("comments") + " " + post.comments;
                                const authorEl = document.createElement("span");
                                authorEl.innerHTML = iconHtml("user") + " " + post.author;
                                meta.appendChild(dateEl);
                                meta.appendChild(commentsEl);
                                meta.appendChild(authorEl);
                                container.appendChild(heading);
                                container.appendChild(meta);
                                article.appendChild(thumbnail);
                                article.appendChild(container);
                                fragment.appendChild(article);
                            });
                            recentPosts.appendChild(fragment);
                        }).catch(error => {
                        });
                    }
                }
                multiPagination.innerHTML = "";
                const numbered = document.createElement("div");
                numbered.classList.add("numbered-pagination");
                multiPagination.appendChild(numbered);
                const params2 = new URLSearchParams(window.location.search);
                const number2 = parseInt(params2.get("start")) || 1;
                const href = window.location.href;
                let countUrl = "" + feedSummaryUrl + "&max-results" + "=0";
                if (href.includes("search?q=")) {
                    countUrl += "&q=" + params2.get("q");
                }
                else {
                    if (href.includes("search/label")) {
                        countUrl += "&category=" + href.split("search/label/")[1].split("?")[0];
                    }
                }
                fetch(countUrl).then(response => response.json()).then(json => {
                    const totalResults = json.feed.openSearch$totalResults.$t;
                    const totalPages = Math.ceil(totalResults / perPage);
                    const currentPage = Math.floor((number2 - 1) / perPage) + 1;
                    numbered.innerHTML = "";
                    numbered.innerHTML += "<span class=\"page-num " + (currentPage === 1 ? "active" : "") + "\" data-index=\"1\">1</span>";
                    const firstPage = Math.max(2, currentPage - 2);
                    const lastPage = Math.min(totalPages - 1, currentPage + 2);
                    for (let page = firstPage; page <= lastPage; page++) {
                        const startIndex = (page - 1) * perPage + 1;
                        numbered.innerHTML += "<span class=\"page-num " + (number2 === startIndex ? "active" : "") + "\" data-index=\"" + startIndex + '">' + page + "</spa" + "n>";
                    }
                    if (totalPages > 1) {
                        const lastStart = (totalPages - 1) * perPage + 1;
                        numbered.innerHTML += "<span class=\"page-num " + (number2 === lastStart ? "active" : "") + "\" data-index=\"" + lastStart + '">' + totalPages + "</spa" + "n>";
                    }
                    numbered.querySelectorAll(".page-num").forEach(pageNum => {
                        pageNum.onclick = event => {
                            const page = parseInt(event.target.getAttribute("data-index"));
                            goToPage(page);
                        };
                    });
                    const goToPage = page => {
                        if (page === 1) {
                            const link = document.createElement("a");
                            if (href.includes("search?q=")) {
                                const query = params2.get("q");
                                link.href = siteOrigin + "/search?q=" + query + "&max-results=" + perPage;
                            }
                            else if (href.includes("search/label")) {
                                const label = href.split("search/label/")[1].split("?")[0];
                                link.href = siteOrigin + "/search/label/" + label + "?max-results=" + perPage;
                            }
                            else {
                                link.href = siteOrigin;
                            }
                            link.style.display = "none";
                            document.body.appendChild(link);
                            link.click();
                        }
                        else {
                            let url = "" + feedSummaryUrl + "&max-results" + "=1&start-index=" + page;
                            if (href.includes("search?q=")) {
                                url += "&q=" + params2.get("q");
                            }
                            else {
                                if (href.includes("search/label")) {
                                    url += "&category=" + href.split("search/label/")[1].split("?")[0];
                                }
                            }
                            fetch(url).then(response => response.json()).then(json => {
                                if (json.feed.entry && json.feed.entry.length > 0) {
                                    let published = json.feed.entry[0].published.$t;
                                    let updatedMaxParam = published.substring(0, 19) + published.substring(23, 29);
                                    updatedMaxParam = encodeURIComponent(updatedMaxParam);
                                    const link = document.createElement("a");
                                    if (href.includes("search?q=")) {
                                        const query = params2.get("q");
                                        link.href = "/search?q=" + query + "&updated-max=" + updatedMaxParam + "&max-results=" + perPage + "&start=" + page;
                                    }
                                    else if (href.includes("search/label")) {
                                        const label = href.split("search/label/")[1].split("?")[0];
                                        link.href = "/search/label/" + label + "?updated-max=" + updatedMaxParam + "&max-results=" + perPage + "&start=" + page;
                                    }
                                    else {
                                        link.href = "/search?updated-max=" + updatedMaxParam + "&max-results=" + perPage + "&start=" + page;
                                    }
                                    document.body.appendChild(link);
                                    link.click();
                                }
                            }).catch(error => {
                            });
                        }
                    };
                }).catch(error => {
                });
            };
            if (data.style === "loadmore") {
                setupLoadMore();
            }
            else {
                if (data.style === "numbered") {
                    setupNumberedPagination();
                }
            }
        }
        catch (error) {
        }
    }
});

// ===== Lazy image loader (IntersectionObserver on img.lazy) =====
(function () {
    const lazyObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const src = target.dataset.src;
                const placeholderSrc = target.src;
                if (src && src !== placeholderSrc) {
                    target.src = src;
                    target.onload = () => {
                        if (!target.src.startsWith("data:image")) {
                            target.classList.remove("lazy");
                        }
                    };
                    target.onerror = () => {
                        if (placeholderSrc && target.src !== placeholderSrc) {
                            target.src = placeholderSrc;
                        }
                    };
                }
                observer.unobserve(target);
            }
        });
    });
    domWatcher.registerAll("img.lazy", lazy => {
        lazyObserver.observe(lazy);
    });
})();

// ===== Plugin: Font (loads custom fonts) =====
(function () {
    const configScript = getPluginScript("Font");
    if (!configScript) {
        return;
    }
    let config;
    try {
        config = JSON.parse(configScript.textContent);
    }
    catch {
        return;
    }
    if (!config.status || !Array.isArray(config.fonts)) {
        return;
    }
    const loadedFamilies = new Set();
    const loads = config.fonts.map(({ fontUrl: fontUrl, fontFamily = "CustomFont", fontWeight = "400", fontStyle = "normal" }) => fontUrl ? new FontFace(fontFamily, "url(" + fontUrl + ")", {
        weight: fontWeight,
        style: fontStyle,
        display: "swap",
        crossOrigin: "anonymous"
    }).load().then(fontFace => {
        document.fonts.add(fontFace);
        loadedFamilies.add(fontFamily);
    }) : Promise.resolve());
    Promise.all(loads).then(() => {
        if (!loadedFamilies.size) {
            return;
        }
        const fontFamilyValue = [...loadedFamilies].map(item => "'" + item + "'").join(", ") + ", sans-serif";
        document.documentElement.style.fontFamily = fontFamilyValue;
    }).catch(() => {
    });
})();

// ===== Plugin: Pwa =====
domWatcher.register(pluginSelector("Pwa"), (script, state) => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent.trim());
            if (!data.status) {
                return;
            }
            const siteName = document.querySelector("meta[property=\"og:site_name\"]").content;
            const appleTouchIconUrl = document.querySelector("link[rel=\"apple-touch-icon\"]").href || null;
            const manifest = {
                name: siteName,
                short_name: siteName,
                description: "",
                start_url: window.location.origin,
                orientation: "portrait",
                display: "standalone",
                background_color: "#fff",
                theme_color: "#fff",
                icons: []
            };
            if (manifest.icons && appleTouchIconUrl) {
                const sizes = [16, 24, 32, 36, 48, 64, 72, 96, 192, 512];
                const buildIcons = (iconUrl, iconSizes) => iconSizes.map(item => ({
                    src: iconUrl.replace(/s\d+|w\d+-h\d+/g, match => match.startsWith("s") ? "s" + item : match.startsWith("w") ? "w" + item + "-h" + item : match),
                    sizes: item + "x" + item,
                    type: "image/png",
                    purpose: "any"
                }));
                manifest.icons.push(...buildIcons(appleTouchIconUrl, sizes));
            }
            const blobOptions = {
                type: "application/manifest+json"
            };
            const blob = new Blob([JSON.stringify(manifest)], blobOptions);
            if (state.blobUrl) {
                URL.revokeObjectURL(state.blobUrl);
                state.blobUrl = null;
            }
            state.blobUrl = URL.createObjectURL(blob);
            let linkManifest = document.head.querySelector("link[rel=\"manifest\"]");
            if (!linkManifest) {
                linkManifest = document.createElement("link");
                linkManifest.rel = "manifest";
                linkManifest.href = state.blobUrl;
                document.head.appendChild(linkManifest);
            }
            if (!data.prompt) {
                return;
            }
            if (!cookies.has("cookie_consent")) {
                return;
            }
            if (state.beforeInstall) {
                window.removeEventListener("beforeinstallprompt", state.beforeInstall);
            }
            if (state.appInstalled) {
                window.removeEventListener("appinstalled", state.appInstalled);
            }
            state.beforeInstall = function (event) {
                // evento consumido: evita mostrar o popup de novo em navegações SPA
                window.pbdInstall = null;
                if (document.querySelector(".pwa.active")) {
                    return;
                }
                if (cookies.get("pwa") === "true") {
                    return;
                }
                const overlay = document.createElement("div");
                overlay.className = "pwa-overlay pbd_overlay";
                overlay.dataset.pbdId = "pwa-popup";
                const modal = document.createElement("div");
                modal.className = "pwa pbd_model active";
                modal.dataset.closable = "false";
                modal.dataset.pbdId = "pwa-popup";
                const contentEl = document.createElement("div");
                contentEl.className = "content";
                const thumb = document.createElement("div");
                thumb.className = "thumb";
                const image = document.createElement("img");
                image.src = appleTouchIconUrl;
                thumb.appendChild(image);
                const desc = document.createElement("div");
                desc.className = "desc";
                const heading = document.createElement("h3");
                heading.textContent = data.line;
                const paragraph = document.createElement("p");
                paragraph.textContent = data.desc;
                desc.append(heading, paragraph);
                contentEl.append(thumb, desc);
                const actions = document.createElement("div");
                actions.className = "actions";
                const denyButton = document.createElement("div");
                denyButton.className = "btn btn-denied";
                denyButton.textContent = data.cancel;
                const installButton = document.createElement("div");
                installButton.className = "btn btn-install";
                installButton.textContent = data.install;
                actions.append(denyButton, installButton);
                modal.append(contentEl, actions);
                document.body.append(overlay, modal);
                installButton.onclick = async () => {
                    event.prompt();
                    await event.userChoice;
                    modal.remove();
                    overlay.remove();
                };
                denyButton.onclick = () => {
                    cookies.set("pwa", "true", 7);
                    modal.remove();
                    overlay.remove();
                };
            };
            state.appInstalled = function () {
                window.pbdInstall = null;
                cookies.remove("pwa");
                const pwaActive = document.querySelector(".pwa.active");
                const pwaOverlay = document.querySelector(".pwa-overlay");
                if (pwaActive) {
                    pwaActive.remove();
                }
                if (pwaOverlay) {
                    pwaOverlay.remove();
                }
            };
            window.addEventListener("beforeinstallprompt", state.beforeInstall);
            // O navegador costuma disparar "beforeinstallprompt" antes deste script
            // (que carrega atrasado). O loader do template guarda o evento em
            // window.pbdInstall; se ele já aconteceu, mostramos o popup agora.
            if (window.pbdInstall) {
                state.beforeInstall(window.pbdInstall);
            }
            window.addEventListener("appinstalled", state.appInstalled);
        }
        catch (error) {
        }
    }
});

// ===== Plugin: Table Of Contents =====
domWatcher.register(pluginSelector("Table Of Contents"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            const postBody = document.querySelector(".post-body");
            if (!postBody) {
                return;
            }
            const headings = postBody.querySelectorAll("h2, h3, h4");
            if (!postBody.querySelectorAll("h2").length) {
                return;
            }
            const isOpen = data.open === true || data.open === "true";
            const toc = document.createElement("div");
            toc.className = "accordion toc";
            const item = document.createElement("div");
            item.className = "item";
            if (isOpen) {
                item.classList.add("active");
            }
            const header = document.createElement("div");
            header.className = "header";
            header.textContent = data.title;
            const content = document.createElement("div");
            content.className = "content";
            const list = document.createElement("ol");
            content.appendChild(list);
            item.append(header, content);
            toc.appendChild(item);
            const firstParagraph = postBody.querySelector(":scope > p");
            if (firstParagraph) {
                firstParagraph.parentNode.insertBefore(toc, firstParagraph.nextSibling);
            }
            else {
                postBody.insertBefore(toc, postBody.firstChild);
            }
            let currentLevel = 2;
            const listStack = [list];
            headings.forEach(heading => {
                if (!heading.id) {
                    heading.id = heading.textContent.trim().toLowerCase().replace(/\s+/g, "-");
                }
                const level = parseInt(heading.tagName[1], 10);
                const listItem = document.createElement("li");
                const link = document.createElement("a");
                link.textContent = heading.textContent;
                link.href = "#" + heading.id;
                listItem.appendChild(link);
                while (currentLevel < level) {
                    const nestedList = document.createElement("ol");
                    listStack[listStack.length - 1].appendChild(nestedList);
                    listStack.push(nestedList);
                    currentLevel++;
                }
                while (currentLevel > level) {
                    listStack.pop();
                    currentLevel--;
                }
                listStack[listStack.length - 1].appendChild(listItem);
            });
        }
        catch {
        }
    }
});

// ===== Plugin: Split Post =====
domWatcher.register(pluginSelector("Split Post"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            const postBody = document.querySelector(".post-body");
            if (!postBody) {
                return;
            }
            if (!postBody.innerHTML.includes(data.divider)) {
                return;
            }
            const tableOfContents = document.querySelector(".table-of-contents");
            if (tableOfContents) {
                tableOfContents.remove();
            }
            const pagination = document.createElement("div");
            pagination.className = "split-pagination";
            postBody.after(pagination);
            const parts = postBody.innerHTML.split(data.divider);
            let currentPage = function () {
                const params = new URLSearchParams(location.search);
                return parseInt(params.get("page"), 10) || 1;
            }() - 1;
            (function () {
                const start = currentPage * 1;
                const end = start + 1;
                postBody.innerHTML = parts.slice(start, end).join("");
                (function () {
                    pagination.innerHTML = "";
                    const totalPages = Math.ceil(parts.length / 1);
                    if (currentPage > 0) {
                        const link = document.createElement("a");
                        link.href = "?page=" + currentPage;
                        link.innerHTML = iconHtml("left");
                        pagination.appendChild(link);
                    }
                    let firstPage = Math.max(0, currentPage - 1);
                    let lastPage = Math.min(totalPages, firstPage + 3);
                    if (currentPage === totalPages - 1) {
                        firstPage = Math.max(0, totalPages - 3);
                        lastPage = totalPages;
                    }
                    for (let page = firstPage; page < lastPage; page++) {
                        const link = document.createElement("a");
                        link.href = "?page=" + (page + 1);
                        link.textContent = page + 1;
                        if (page === currentPage) {
                            link.classList.add("active");
                        }
                        pagination.appendChild(link);
                    }
                    if (currentPage < totalPages - 1) {
                        const link = document.createElement("a");
                        link.href = "?page=" + (currentPage + 2);
                        link.innerHTML = iconHtml("right");
                        pagination.appendChild(link);
                    }
                })();
            })();
        }
        catch {
        }
    }
});

// ===== Component: ".cmnt-btn" =====
domWatcher.registerAll(".cmnt-btn", cmntBtn => {
    cmntBtn.onclick = event => {
        event.preventDefault();
        const commentForm = document.getElementById("comment-form");
        const iframeContainer = document.querySelector(".iframe-container");
        const iframePlaceholder = document.querySelector(".iframe-placeholder");
        if (!commentForm || !iframeContainer || !iframePlaceholder) {
            return;
        }
        commentForm.height = "95px";
        commentForm.src = cmntBtn.href;
        iframeContainer.style.display = "block";
        iframePlaceholder.style.display = "flex";
        commentForm.onload = () => {
            iframePlaceholder.style.display = "none";
        };
        const cmntBtn2 = cmntBtn.closest(".cmnt-btn");
        if (cmntBtn2 && cmntBtn2.parentNode) {
            cmntBtn2.parentNode.insertBefore(iframeContainer, cmntBtn2.nextSibling);
        }
        cmntBtn.style.display = "none";
        document.querySelectorAll(".cmnt-btn").forEach(cmntBtn3 => {
            if (cmntBtn3 !== cmntBtn) {
                cmntBtn3.style.display = "";
            }
        });
    };
});

// ===== Component: ".comment-content" =====
domWatcher.registerAll(".comment-content", commentContent => {
    commentContent.querySelectorAll("i[rel=\"code\"]").forEach(iCode => {
        let replaced = iCode.innerHTML.replace(/<br\s*\/?>/gi, "\n");
        const div = document.createElement("div");
        div.innerHTML = replaced;
        const text = div.textContent.trim();
        const pre = document.createElement("pre");
        const codeEl = document.createElement("code");
        pre.classList.add("comment");
        codeEl.textContent = text;
        pre.appendChild(codeEl);
        iCode.replaceWith(pre);
    });
    commentContent.querySelectorAll("i[rel=\"img\"]").forEach(iImg => {
        const text = iImg.getAttribute("src").trim();
        if (!text || !/^https?:\/\//i.test(text)) {
            iImg.remove();
            return;
        }
        const image = document.createElement("img");
        image.src = text;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        iImg.replaceWith(image);
    });
});

// ===== Component: ".author-info a" =====
domWatcher.registerAll(".author-info a", link => {
    const lower = link.textContent.trim().toLowerCase();
    if (["facebook", "instagram", "youtube", "telegram", "twitter", "x", "github", "linkedin", "whatsapp"].includes(lower)) {
        link.textContent = "";
        link.className = "social";
        link.innerHTML = iconHtml(lower);
        link.setAttribute("title", lower);
    }
    else {
        link.remove();
    }
});
window.addEventListener("message", event => {
    if (event.origin === "https://www.blogger.com") {
        let match = event.data.match(/\d+/);
        if (match) {
            let commentForm = document.querySelector("#comment-form");
            if (commentForm) {
                commentForm.height = parseInt(match[0]) + 5 + "px";
            }
        }
    }
});

// ===== Component: ".post-body a.post-card" =====
domWatcher.registerAll(".post-body a.post-card", postCard => {
    try {
        const replaced = postCard.getAttribute("href").replace(/[?#].*$/, "");
        let url = feedSummaryUrl + "&path=" + encodeURIComponent(replaced);
        fetchFeedEntries(url).then(result => {
            if (!result || !result.length) {
                return;
            }
            const post = result[0];
            const card = document.createElement("div");
            card.className = "post-card";
            const thumbnail = document.createElement("div");
            thumbnail.className = "thumbnail";
            const link = document.createElement("a");
            link.href = post.link;
            const image = document.createElement("img");
            image.alt = post.title;
            image.src = placeholderImage(100, 80);
            image.dataset.src = post.cropped(200, 160);
            image.className = "lazy no-wk no-lightbox";
            link.appendChild(image);
            thumbnail.appendChild(link);
            const titleDate = document.createElement("div");
            titleDate.className = "title-date";
            const link2 = document.createElement("a");
            link2.href = post.link;
            link2.className = "title";
            link2.textContent = post.title;
            const dateEl = document.createElement("div");
            dateEl.className = "date";
            const icon = document.createElement("i");
            icon.className = "icon-clock";
            dateEl.append(icon, document.createTextNode(post.date));
            titleDate.append(link2, dateEl);
            card.append(thumbnail, titleDate);
            if (postCard.parentNode) {
                postCard.parentNode.replaceChild(card, postCard);
            }
        }).catch(() => {
        });
    }
    catch {
    }
});

// ===== Code block enhancements (language labels, copy button, highlighting) =====
(function () {
    const languageNames = {
        javascript: "JavaScript",
        typescript: "TypeScript",
        python: "Python",
        java: "Java",
        cpp: "C++",
        c: "C",
        csharp: "C#",
        ruby: "Ruby",
        go: "Go",
        php: "PHP",
        rust: "Rust",
        swift: "Swift",
        html: "HTML",
        xml: "XML",
        css: "CSS",
        json: "JSON",
        yaml: "YAML",
        markdown: "Markdown",
        shell: "Shell",
        bash: "Bash",
        plaintext: "Plain Text",
        sql: "SQL",
        kotlin: "Kotlin",
        dart: "Dart",
        scala: "Scala",
        perl: "Perl",
        lua: "Lua",
        r: "R",
        ini: "INI",
        makefile: "Makefile"
    };
    function getLanguage(codeEl) {
        for (const className of codeEl.classList) {
            if (!className.startsWith("language-")) {
                continue;
            }
            let replaced = className.replace("language-", "");
            if (replaced === "php-template") {
                replaced = "html";
            }
            return languageNames[replaced] || replaced;
        }
        return null;
    }
    function highlight(codeEl) {
        if (codeEl.dataset.highlighted) {
            return;
        }
        if (!window.hljs) {
            return;
        }
        hljs.highlightElement(codeEl);
        codeEl.dataset.highlighted = "true";
        const parentElement = codeEl.parentElement;
        if (!parentElement) {
            return;
        }
        const language = getLanguage(codeEl);
        if (language && !parentElement.dataset.lang) {
            parentElement.dataset.lang = language;
        }
    }
    domWatcher.registerAll("pre code", (code, state) => {
        (function (codeEl) {
            const parentElement = codeEl.parentElement;
            if (!parentElement || parentElement.tagName !== "PRE") {
                return;
            }
            if (!codeEl.textContent.trim()) {
                parentElement.remove();
                return;
            }
            parentElement.classList.add("codebox");
            if (!parentElement.querySelector(".line-number")) {
                parentElement.prepend(function (text) {
                    const lineNumbers = document.createElement("div");
                    lineNumbers.className = "line-number";
                    text.replace(/\n$/, "").split("\n").forEach(() => lineNumbers.appendChild(document.createElement("div")));
                    return lineNumbers;
                }(codeEl.textContent));
            }
            if (!parentElement.querySelector(".copy-btn")) {
                parentElement.appendChild(function (codeEl) {
                    const copyButton = document.createElement("div");
                    copyButton.className = "btn copy-btn";
                    copyButton.title = "Copy Code";
                    copyButton.innerHTML = iconHtml("copy");
                    copyButton.onclick = async () => {
                        try {
                            await navigator.clipboard.writeText(codeEl.textContent);
                            showToast("Code copied to clipboard");
                            copyButton.innerHTML = iconHtml("check");
                        }
                        catch (error) {
                            showToast(error.message, false);
                        }
                        setTimeout(() => copyButton.innerHTML = iconHtml("copy"), 1e3);
                    };
                    return copyButton;
                }(codeEl));
            }
            const language = getLanguage(codeEl);
            if (language && !parentElement.dataset.lang) {
                parentElement.dataset.lang = language;
            }
        })(code);
        if (window.hljs) {
            highlight(code);
        }
        else if (!state.loading) {
            state.loading = true;
            const script = document.createElement("script");
            script.src = "https://harlleyreboucas.github.io/creditos/highlight.min.js";
            script.onload = () => {
                state.loaded = true;
                document.querySelectorAll("pre code").forEach(highlight);
            };
            document.head.appendChild(script);
        }
    });
})();

// ===== Plugin: Image Lightbox =====
domWatcher.register(pluginSelector("Image Lightbox"), script => {
    if (script) {
        try {
            if (!JSON.parse(script.textContent).status) {
                return;
            }
            let isOpen = false;
            function openLightbox(event) {
                event.preventDefault();
                event.stopPropagation();
                if (isOpen) {
                    return;
                }
                const currentTarget = event.currentTarget;
                if (currentTarget.classList.contains("no-lightbox")) {
                    return;
                }
                isOpen = true;
                const originInfo = function (imageEl) {
                    const rect = imageEl.getBoundingClientRect();
                    const info = {
                        rect: rect,
                        scrollTop: window.scrollY,
                        scrollLeft: window.scrollX,
                        top: rect.top + window.scrollY,
                        left: rect.left + window.scrollX,
                        bg: imageEl.style.backgroundColor
                    };
                    return info;
                }(currentTarget);
                const overlay = function () {
                    const overlayEl = document.createElement("div");
                    const overlayStyles = {
                        position: "fixed",
                        inset: "0",
                        backgroundColor: "rgba(0,0,0, 0.85)",
                        zIndex: "9998",
                        opacity: "0",
                        transition: "opacity 0.3s ease",
                        cursor: "pointer"
                    };
                    Object.assign(overlayEl.style, overlayStyles);
                    overlayEl.classList.add("no-scroll");
                    return overlayEl;
                }();
                const closeButton = function () {
                    const buttonEl = document.createElement("div");
                    const buttonStyles = {
                        position: "fixed",
                        top: "20px",
                        right: "20px",
                        zIndex: "10000",
                        color: "#fff",
                        width: "24px",
                        height: "24px",
                        cursor: "pointer"
                    };
                    Object.assign(buttonEl.style, buttonStyles);
                    buttonEl.innerHTML = iconHtml("close");
                    return buttonEl;
                }();
                overlay.append(closeButton);
                const zoomImage = function (source, origin) {
                    const imageCopy = source.cloneNode();
                    const imageStyles = {
                        position: "absolute",
                        top: origin.top + "px",
                        left: origin.left + "px",
                        width: origin.rect.width + "px",
                        height: origin.rect.height + "px",
                        transition: "all 0.35s cubic-bezier(0.2, 0, 0.2, 1)",
                        zIndex: "9999",
                        objectFit: "contain",
                        cursor: "zoom-out"
                    };
                    Object.assign(imageCopy.style, imageStyles);
                    imageCopy.classList.add("no-scroll");
                    return imageCopy;
                }(currentTarget, originInfo);
                var sourceImage;
                var sourceInfo;
                document.body.append(overlay, zoomImage);
                currentTarget.style.visibility = "hidden";
                sourceImage = currentTarget;
                sourceInfo = originInfo;
                requestAnimationFrame(() => {
                    overlay.style.opacity = "1";
                    const innerWidth = window.innerWidth;
                    const innerHeight = window.innerHeight;
                    const naturalWidth = sourceImage.naturalWidth || sourceInfo.rect.width;
                    const aspectRatio = naturalWidth / (sourceImage.naturalHeight || sourceInfo.rect.height);
                    let targetWidth = Math.min(.92 * innerWidth, naturalWidth);
                    let targetHeight = targetWidth / aspectRatio;
                    if (targetHeight > .92 * innerHeight) {
                        targetHeight = .92 * innerHeight;
                        targetWidth = targetHeight * aspectRatio;
                    }
                    Object.assign(zoomImage.style, {
                        top: sourceInfo.scrollTop + (innerHeight - targetHeight) / 2 + "px",
                        left: sourceInfo.scrollLeft + (innerWidth - targetWidth) / 2 + "px",
                        width: targetWidth + "px",
                        height: targetHeight + "px"
                    });
                    setTimeout(() => {
                        isOpen = false;
                    }, 350);
                });
                const closeLightbox = () => function (sourceImage, zoomImage, overlay, origin) {
                    if (isOpen) {
                        return;
                    }
                    const closeStyles = {
                        top: origin.top + "px",
                        left: origin.left + "px",
                        width: origin.rect.width + "px",
                        height: origin.rect.height + "px",
                        transform: "scale(1)"
                    };
                    isOpen = true;
                    overlay.style.opacity = "0";
                    Object.assign(zoomImage.style, closeStyles);
                    const onTransitionEnd = event => {
                        if (event.propertyName === "top") {
                            zoomImage.removeEventListener("transitionend", onTransitionEnd);
                            sourceImage.style.visibility = "";
                            sourceImage.style.backgroundColor = origin.bg;
                            overlay.remove();
                            zoomImage.remove();
                            isOpen = false;
                        }
                    };
                    zoomImage.addEventListener("transitionend", onTransitionEnd);
                }(currentTarget, zoomImage, overlay, originInfo);
                const elements = {
                    overlay: overlay,
                    clone: zoomImage,
                    closeBtn: closeButton
                };
                (function (elements, close) {
                    const handler = event => {
                        event.preventDefault();
                        close();
                    };
                    elements.clone.onclick = handler;
                    elements.overlay.onclick = handler;
                    elements.closeBtn.onclick = handler;
                    elements.overlay.ontouchmove = event => {
                        event.preventDefault();
                        event.stopPropagation();
                    };
                })(elements, closeLightbox);
                (function (zoomImage, overlay, close) {
                    let startY = 0;
                    let deltaY = 0;
                    let startTop = 0;
                    zoomImage.ontouchstart = event => {
                        startY = event.touches[0].clientY;
                        startTop = parseFloat(zoomImage.style.top);
                    };
                    zoomImage.ontouchmove = event => {
                        event.preventDefault();
                        event.stopPropagation();
                        deltaY = event.touches[0].clientY - startY;
                        zoomImage.style.transition = "none";
                        overlay.style.transition = "none";
                        zoomImage.style.top = startTop + deltaY + "px";
                        const scale = 1 - Math.min(Math.abs(deltaY), 150) / 150 * .15;
                        zoomImage.style.transform = "scale(" + scale + ")";
                        overlay.style.opacity = "" + (1 - Math.abs(deltaY) / (window.innerHeight / 2));
                    };
                    zoomImage.ontouchend = () => {
                        zoomImage.style.transition = "all 0.3s ease";
                        overlay.style.transition = "opacity 0.3s ease";
                        zoomImage.style.transform = "scale(1)";
                        if (Math.abs(deltaY) > 100) {
                            close();
                        }
                        else {
                            zoomImage.style.top = startTop + "px";
                            overlay.style.opacity = "1";
                        }
                    };
                })(zoomImage, overlay, closeLightbox);
            }
            document.querySelectorAll(".post-body img").forEach(img => {
                img.addEventListener("click", openLightbox);
            });
        }
        catch (error) {
        }
    }
});

// ===== Component: ".single-nextprev" =====
domWatcher.register(".single-nextprev", singleNextprev => {
    if (!singleNextprev) {
        return;
    }
    const prev = singleNextprev.querySelector(".prev");
    const next = singleNextprev.querySelector(".next");
    const fetchLinkedPost = linkEl => {
        if (!linkEl) {
            return Promise.resolve(null);
        }
        const href = linkEl.getAttribute("href");
        if (!href) {
            return Promise.resolve(null);
        }
        const url = feedSummaryUrl + "&path=" + encodeURIComponent(href);
        return fetchFeedEntries(url).then(result => result && result[0] ? {
            href: href,
            post: result[0]
        } : null).catch(() => null);
    };
    const createNavLink = (direction, href, post) => {
        const link = document.createElement("a");
        link.href = href;
        link.className = direction;
        const nameTitle = document.createElement("div");
        nameTitle.className = "name-title";
        const nameEl = document.createElement("div");
        nameEl.className = "name";
        nameEl.textContent = direction === "prev" ? "Previous" : "Next";
        const titleEl = document.createElement("div");
        titleEl.className = "title";
        titleEl.textContent = post.title;
        nameTitle.append(nameEl, titleEl);
        const thumb = document.createElement("div");
        thumb.className = "thumb";
        const image = document.createElement("img");
        image.src = post.cropped(300, 170);
        image.alt = post.title;
        thumb.append(image);
        if (direction === "prev") {
            link.append(thumb, nameTitle);
        }
        else {
            link.append(nameTitle, thumb);
        }
        return link;
    };
    Promise.all([fetchLinkedPost(prev), fetchLinkedPost(next)]).then(([prevData, nextData]) => {
        if (prev && !prevData || next && !nextData) {
            return;
        }
        if (!prevData && !nextData) {
            return;
        }
        const container = document.createElement("div");
        container.className = "post-nextprev";
        if (prevData) {
            container.append(createNavLink("prev", prevData.href, prevData.post));
        }
        if (nextData) {
            container.append(createNavLink("next", nextData.href, nextData.post));
        }
        singleNextprev.replaceWith(container);
    });
});

// ===== Component: ".accordion .item" =====
domWatcher.registerAll(".accordion .item", item => {
    const header = item.querySelector(".header");
    const content = item.querySelector(".content");
    header.onclick = () => {
        const isActive = item.classList.contains("active");
        content.ontransitionend = null;
        if (isActive) {
            content.style.height = content.scrollHeight + "px";
            content.offsetHeight;
            content.style.height = "0px";
            item.classList.remove("active");
        }
        else {
            content.style.height = content.scrollHeight + "px";
            item.classList.add("active");
            content.ontransitionend = () => {
                content.style.height = "auto";
            };
        }
    };
});

// ===== Component: "#inarticle-ads" =====
domWatcher.register("#inarticle-ads", inarticleAds => {
    if (!inarticleAds) {
        return;
    }
    const template = inarticleAds.querySelector("template");
    if (!template) {
        return;
    }
    const postBody = document.querySelector(".post-body");
    if (!postBody) {
        return;
    }
    if (postBody.querySelector(".inarticle-ad")) {
        return;
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = template.innerHTML;
    const content = wrapper.querySelector(".content");
    if (!content) {
        return;
    }
    function createAdBlock() {
        const adEl = document.createElement("div");
        adEl.className = "inarticle-ad";
        const clone = content.cloneNode(true);
        adEl.appendChild(clone);
        adEl.querySelectorAll("script").forEach(script => {
            const script2 = document.createElement("script");
            [...script.attributes].forEach(attribute => {
                script2.setAttribute(attribute.name, attribute.value);
            });
            script2.textContent = script.textContent;
            script.parentNode.replaceChild(script2, script);
        });
        return adEl;
    }
    const blocks = postBody.querySelectorAll("\n    :scope > p,\n    :scope > div:not([class]):not([id]),\n    :scope > ul,\n    :scope > ol,\n    :scope > blockquote\n  ");
    if (!blocks.length) {
        return;
    }
    let wordCount = 0;
    blocks.forEach(block => {
        const textContent = block.textContent || "";
        wordCount += textContent.trim().split(/\s+/).filter(Boolean).length;
    });
    blocks[0].before(createAdBlock());
    const extraAds = Math.floor(wordCount / 200);
    if (extraAds > 0) {
        const interval = Math.floor(blocks.length / (extraAds + 1));
        for (let index = 1; index <= extraAds; index++) {
            const position = interval * index;
            if (blocks[position]) {
                blocks[position].before(createAdBlock());
            }
        }
    }
    if (wordCount >= 100) {
        blocks[blocks.length - 1].after(createAdBlock());
    }
    inarticleAds.remove();
});

// ===== Plugin: SafeLink =====
domWatcher.register(pluginSelector("SafeLink"), script => {
    if (script) {
        try {
            let data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            const postBody = document.querySelector(".post-body");
            if (!postBody) {
                return;
            }
            const codec = (() => {
                return {
                    encode: text => {
                        const encodedBytes = ((plainText, key) => {
                            const bytes = (new TextEncoder()).encode(key);
                            return (new TextEncoder()).encode(plainText).map((byte, index) => byte ^ bytes[index % bytes.length]);
                        })(text, "#rmn");
                        return btoa(String.fromCharCode.apply(null, encodedBytes));
                    },
                    decode: encoded => {
                        const encodedBytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
                        const bytes = (new TextEncoder()).encode("#rmn");
                        const decodedBytes = encodedBytes.map((item, index) => item ^ bytes[index % bytes.length]);
                        return (new TextDecoder()).decode(decodedBytes);
                    }
                };
            })();
            const hash = location.hash;
            if (hash.indexOf("#safelink_") > -1) {
                const sliced = hash.substring(hash.indexOf("#safelink_") + "#safelink_".length);
                let targetUrl = codec.decode(sliced);
                if (!/^https?:\/\//i.test(targetUrl)) {
                    targetUrl = "http://" + targetUrl;
                }
                const firstElementChild = postBody.firstElementChild;
                const viewBox = document.createElement("div");
                viewBox.classList.add("view-safelink");
                if (firstElementChild) {
                    firstElementChild.parentNode.insertBefore(viewBox, firstElementChild.nextSibling);
                }
                else {
                    postBody.appendChild(viewBox);
                }
                const gotoBox = document.createElement("div");
                gotoBox.classList.add("goto-safelink");
                gotoBox.style.display = "none";
                const lastElementChild = postBody.lastElementChild;
                if (lastElementChild) {
                    lastElementChild.parentNode.insertBefore(gotoBox, lastElementChild);
                }
                else {
                    postBody.appendChild(gotoBox);
                }
                const link = document.createElement("a");
                link.href = "#";
                link.textContent = data.view.after;
                link.className = "button";
                link.target = "_blank";
                const continueButton = document.createElement("button");
                continueButton.classList.add("continue");
                continueButton.textContent = data.view.middle;
                continueButton.style.display = "none";
                const before = data.view.before;
                let time = data.view.time;
                const waitButton = document.createElement("button");
                waitButton.classList.add("wait");
                waitButton.disabled = true;
                waitButton.textContent = before.replace(/#\{d\}/g, time);
                viewBox.appendChild(waitButton);
                viewBox.appendChild(continueButton);
                const intervalId = setInterval(() => {
                    time--;
                    waitButton.textContent = before.replace(/#\{d\}/g, time);
                    if (time <= 0) {
                        clearInterval(intervalId);
                        waitButton.remove();
                        continueButton.style.display = "";
                    }
                }, 1e3);
                continueButton.onclick = () => {
                    const scrollOptions = {
                        behavior: "smooth",
                        block: "center"
                    };
                    if (!gotoBox.contains(link)) {
                        gotoBox.appendChild(link);
                    }
                    link.href = targetUrl;
                    gotoBox.style.display = "";
                    link.scrollIntoView(scrollOptions);
                    continueButton.remove();
                };
            }
            if (hash.indexOf("#safelink_") === -1 && window.location.pathname.indexOf(data.gen.path) === 0) {
                const linkPool = [];
                fetchFeedEntries(feedSummaryUrl + "&max-results" + "=8").then(result => {
                    linkPool.push(...result.map(post => post.link));
                }).catch(() => {
                    linkPool.push(location.origin + location.pathname);
                });
                const generator = document.createElement("div");
                generator.classList.add("safelink-generator");
                postBody.appendChild(generator);
                const area = document.createElement("div");
                area.classList.add("area", "exp");
                generator.appendChild(area);
                const iconEl = document.createElement("div");
                iconEl.classList.add("icon", "link");
                iconEl.innerHTML = iconHtml("link");
                const input = document.createElement("input");
                input.type = "text";
                input.placeholder = "Enter URL here";
                const clearButton = document.createElement("div");
                clearButton.classList.add("btn", "clear", "none");
                clearButton.innerHTML = iconHtml("trash");
                const copyButton = document.createElement("div");
                copyButton.classList.add("btn", "copy", "none");
                copyButton.innerHTML = iconHtml("copy");
                const submitButton = document.createElement("div");
                submitButton.classList.add("btn", "submit", "disabled");
                submitButton.innerHTML = iconHtml("right");
                area.appendChild(iconEl);
                area.appendChild(input);
                area.appendChild(clearButton);
                area.appendChild(copyButton);
                area.appendChild(submitButton);
                input.oninput = () => {
                    if (!input.value.trim()) {
                        input.value = "";
                    }
                    submitButton.classList.toggle("disabled", input.value === "");
                };
                clearButton.onclick = () => {
                    input.value = "";
                    input.readOnly = false;
                    input.focus();
                    copyButton.classList.add("none");
                    clearButton.classList.add("none");
                    submitButton.classList.remove("none");
                    submitButton.classList.add("disabled");
                    area.classList.add("exp");
                };
                copyButton.onclick = () => {
                    navigator.clipboard.writeText(input.value).then(() => {
                        return showToast(data.gen.copy);
                    }).catch(() => {
                        return showToast(data.gen.error, false);
                    });
                };
                submitButton.onclick = event => {
                    event.preventDefault();
                    if (linkPool.length === 0) {
                        return;
                    }
                    let index = Math.floor(Math.random() * linkPool.length);
                    let randomLink = linkPool[index];
                    input.readOnly = true;
                    input.value = randomLink + "#safelink_" + codec.encode(input.value);
                    copyButton.classList.remove("none");
                    submitButton.classList.add("none");
                    clearButton.classList.remove("none");
                    area.classList.remove("exp");
                };
            }
        }
        catch (error) {
        }
    }
});

// ===== Plugin: Watermark =====
domWatcher.register(pluginSelector("Watermark"), script => {
    if (script) {
        try {
            const data = JSON.parse(script.textContent);
            if (!data.status) {
                return;
            }
            document.querySelectorAll(".post-body img").forEach(img => {
                if (img.classList.contains("no-wk")) {
                    return;
                }
                if (img.dataset.src && img.classList.contains("lazy")) {
                    img.src = img.dataset.src;
                    img.dataset.src = "";
                    img.classList.remove("lazy");
                }
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const image = new Image();
                // Sem proxy externo: carrega a imagem direto (se o servidor não liberar CORS, a imagem fica sem marca d'água)
                const proxiedSrc = img.src;
                image.crossOrigin = "Anonymous";
                image.onload = () => {
                    const width = image.width;
                    const height = image.height;
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(image, 0, 0, width, height);
                    const fontSize = Math.min(width / 20, height / 20);
                    ctx.font = fontSize + "px Arial";
                    ctx.textBaseline = "middle";
                    ctx.textAlign = "center";
                    const text = data.text;
                    const boxWidth = ctx.measureText(text).width + 30;
                    const boxHeight = fontSize + 16;
                    const boxX = width - boxWidth;
                    const boxY = height - boxHeight;
                    const textX = boxX + boxWidth / 2;
                    const textY = boxY + boxHeight / 2;
                    ((x, y, width, height) => {
                        const radius = Math.min(0, height / 2, width / 2);
                        ctx.beginPath();
                        ctx.moveTo(x + radius, y);
                        ctx.lineTo(x + width - radius, y);
                        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                        ctx.lineTo(x + width, y + height - radius);
                        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                        ctx.lineTo(x + radius, y + height);
                        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                        ctx.lineTo(x, y + radius);
                        ctx.quadraticCurveTo(x, y, x + radius, y);
                        ctx.closePath();
                    })(boxX, boxY, boxWidth, boxHeight);
                    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                    ctx.fill();
                    ctx.fillStyle = "white";
                    ctx.fillText(text, textX, textY);
                    const parentElement = img.parentElement;
                    const isLinked = parentElement.tagName === "A";
                    canvas.toBlob(blob => {
                        const objectUrl = URL.createObjectURL(blob);
                        img.src = objectUrl;
                        img.classList.add("watermarked");
                        if (isLinked && parentElement.href && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(parentElement.href.split(/[?#]/)[0])) {
                            parentElement.href = objectUrl;
                        }
                    }, "image/webp");
                };
                image.onerror = () => {
                };
                image.src = proxiedSrc;
            });
        }
        catch {
        }
    }
});

// ===== Plugin: Copy Paste (blocks copy/context menu when configured) =====
(function () {
    const configScript = getPluginScript("Copy Paste");
    if (configScript) {
        try {
            const data = JSON.parse(configScript.textContent);
            if (data.status !== true) {
                return;
            }
            const documentElement = document.documentElement;
            if (!documentElement.classList.contains("no-select")) {
                documentElement.classList.add("no-select");
            }
            if (data.menu !== true) {
                return;
            }
            function createMenuLabel(iconName, text) {
                const label = document.createElement("span");
                label.className = "icon-title";
                const iconEl = document.createElement("span");
                iconEl.innerHTML = iconHtml(iconName);
                const textEl = document.createElement("span");
                textEl.textContent = text;
                label.append(iconEl, textEl);
                return label;
            }
            function closeMenu(menu, overlay) {
                menu.classList.remove("active");
                overlay.classList.remove("active");
                menu.ontransitionend = () => menu.remove();
                overlay.ontransitionend = () => overlay.remove();
            }
            document.body.addEventListener("contextmenu", function (event) {
                const closest = selector => event.target.closest(selector);
                if (["pre", "code", "input", "textarea"].some(item => closest(item))) {
                    return;
                }
                event.preventDefault();
                if (closest(".context-menu") || closest(".context-overlay")) {
                    return;
                }
                if (document.querySelector(".context-menu")) {
                    return;
                }
                const article = closest("article");
                const img = closest("img");
                const anchor = closest("a");
                if (img && !img.src.startsWith("blob:") && !article) {
                    img.classList.add("shake");
                    img.onanimationend = () => img.classList.remove("shake");
                    return;
                }
                if (anchor && anchor.href.startsWith("https://www.blogger.com")) {
                    return;
                }
                let title = document.title;
                let href = location.href;
                let imageSrc = null;
                let opensInNewTab = false;
                if (article) {
                    const h3 = article.querySelector("h3");
                    const img = article.querySelector("img");
                    const articleLink = article.querySelector("a");
                    if (h3) {
                        title = h3.innerText;
                    }
                    if (img) {
                        imageSrc = img.dataset.src || img.src;
                    }
                    if (articleLink) {
                        href = articleLink.href;
                    }
                }
                else {
                    if (anchor) {
                        href = anchor.href;
                        title = anchor.innerText || title;
                        opensInNewTab = anchor.target === "_blank";
                    }
                }
                const menu = document.createElement("div");
                menu.className = "context-menu";
                const overlay = document.createElement("div");
                overlay.className = "context-overlay";
                const options = document.createElement("div");
                options.className = "options";
                menu.appendChild(options);
                if (article && imageSrc) {
                    const link = document.createElement("a");
                    link.className = "item";
                    link.href = href;
                    link.appendChild(createMenuLabel("world", "Read Post"));
                    link.onclick = () => closeMenu(menu, overlay);
                    options.appendChild(link);
                    const copyUrl = document.createElement("div");
                    copyUrl.className = "item";
                    copyUrl.appendChild(createMenuLabel("copy", "Copy URL"));
                    copyUrl.onclick = () => {
                        navigator.clipboard.writeText(href);
                        showToast("Link copied");
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(copyUrl);
                    const shareUrl = document.createElement("div");
                    shareUrl.className = "item";
                    shareUrl.appendChild(createMenuLabel("share", "Share URL"));
                    shareUrl.onclick = () => {
                        const shareData = {
                            title: title,
                            url: href
                        };
                        if (navigator.share) {
                            navigator.share(shareData).catch(() => {
                            });
                        }
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(shareUrl);
                    const favoriteItem = document.createElement("div");
                    favoriteItem.className = "item add-favorite context-fav";
                    favoriteItem.dataset.url = href;
                    favoriteItem.dataset.title = title;
                    favoriteItem.dataset.src = imageSrc;
                    favoriteItem.appendChild(createMenuLabel("heart", "Add"));
                    favoriteItem.addEventListener("click", () => {
                        closeMenu(menu, overlay);
                    });
                    options.appendChild(favoriteItem);
                }
                if (anchor && !article && !img) {
                    const link = document.createElement("a");
                    link.className = "item";
                    link.href = href;
                    if (opensInNewTab) {
                        link.target = "_blank";
                    }
                    link.appendChild(createMenuLabel("world", "Go To Link"));
                    link.onclick = () => closeMenu(menu, overlay);
                    options.appendChild(link);
                    const copyUrl = document.createElement("div");
                    copyUrl.className = "item";
                    copyUrl.appendChild(createMenuLabel("copy", "Copy URL"));
                    copyUrl.onclick = () => {
                        navigator.clipboard.writeText(href);
                        showToast("Link copied");
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(copyUrl);
                    const shareUrl = document.createElement("div");
                    shareUrl.className = "item";
                    shareUrl.appendChild(createMenuLabel("share", "Share URL"));
                    shareUrl.onclick = () => {
                        const shareData = {
                            title: title,
                            url: href
                        };
                        if (navigator.share) {
                            navigator.share(shareData).catch(() => {
                            });
                        }
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(shareUrl);
                }
                if (img && !article) {
                    const src = img.src;
                    const fileName = "image_" + Date.now() + ".webp";
                    const link = document.createElement("a");
                    link.className = "item";
                    link.href = src;
                    link.target = "_blank";
                    link.appendChild(createMenuLabel("external", "Open Image"));
                    link.onclick = () => closeMenu(menu, overlay);
                    options.appendChild(link);
                    const copyImage = document.createElement("div");
                    copyImage.className = "item";
                    copyImage.appendChild(createMenuLabel("copy", "Copy Image"));
                    copyImage.onclick = async () => {
                        const image = new Image();
                        image.crossOrigin = "anonymous";
                        image.src = src;
                        image.onload = async () => {
                            const canvas = document.createElement("canvas");
                            canvas.width = image.naturalWidth;
                            canvas.height = image.naturalHeight;
                            canvas.getContext("2d").drawImage(image, 0, 0);
                            canvas.toBlob(async (pngBlob) => {
                                const clipboardData = {
                                    "image/png": pngBlob
                                };
                                await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
                                showToast("Image copied");
                            });
                        };
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(copyImage);
                    const shareImage = document.createElement("div");
                    shareImage.className = "item";
                    shareImage.appendChild(createMenuLabel("share", "Share Image"));
                    shareImage.onclick = async () => {
                        const response = await fetch(src);
                        const blob = await response.blob();
                        const file = new File([blob], fileName, { type: blob.type });
                        const shareData = {
                            files: [file]
                        };
                        if (navigator.canShare) {
                            navigator.share(shareData).catch(() => {
                            });
                        }
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(shareImage);
                    const downloadLink = document.createElement("a");
                    downloadLink.className = "item";
                    downloadLink.href = src;
                    downloadLink.download = fileName;
                    downloadLink.appendChild(createMenuLabel("download", "Download"));
                    downloadLink.onclick = () => closeMenu(menu, overlay);
                    options.appendChild(downloadLink);
                }
                if (!article && !anchor && !img) {
                    const link = document.createElement("a");
                    link.className = "item";
                    link.href = location.origin;
                    link.appendChild(createMenuLabel("home", "Homepage"));
                    link.onclick = () => closeMenu(menu, overlay);
                    options.appendChild(link);
                    const sharePage = document.createElement("div");
                    sharePage.className = "item";
                    sharePage.appendChild(createMenuLabel("share", "Share Page"));
                    sharePage.onclick = () => {
                        const shareData = {
                            title: title,
                            url: href
                        };
                        if (navigator.share) {
                            navigator.share(shareData).catch(() => {
                            });
                        }
                        closeMenu(menu, overlay);
                    };
                    options.appendChild(sharePage);
                }
                const reloadLink = document.createElement("a");
                reloadLink.className = "item";
                reloadLink.href = location.href.split("#")[0];
                reloadLink.appendChild(createMenuLabel("reload", "Reload"));
                reloadLink.onclick = () => closeMenu(menu, overlay);
                options.appendChild(reloadLink);
                document.body.append(menu, overlay);
                requestAnimationFrame(() => {
                    menu.classList.add("active");
                    overlay.classList.add("active");
                });
                overlay.onpointerdown = () => closeMenu(menu, overlay);
                menu.ontouchmove = event2 => {
                    event2.preventDefault();
                    event2.stopPropagation();
                };
                const offsetWidth = menu.offsetWidth;
                const offsetHeight = menu.offsetHeight;
                const left = Math.min(Math.max(event.clientX - offsetWidth / 2, 10), innerWidth - offsetWidth - 10);
                const top = Math.min(Math.max(event.clientY - offsetHeight / 2, 10), innerHeight - offsetHeight - 10);
                menu.style.left = left + "px";
                menu.style.top = top + "px";
            });
        }
        catch {
        }
    }
})();

// ===== Plugin: Single Page Application =====
domWatcher.register(pluginSelector("Single Page Application"), (script, state) => {
    if (script) {
        try {
            if (!JSON.parse(script.textContent).status) {
                return;
            }
            let spaLoader = document.querySelector(".spa-loader");
            if (!spaLoader) {
                spaLoader = document.createElement("div");
                spaLoader.className = "spa-loader";
                const loader = document.createElement("div");
                loader.className = "loader";
                spaLoader.appendChild(loader);
                document.pbd.appendChild(spaLoader);
                spaLoader.oncontextmenu = event => event.stopPropagation();
                spaLoader.ontouchmove = event => {
                    event.preventDefault();
                    event.stopPropagation();
                };
            }
            const onClick = event => {
                const target = event.target;
                const anchor = target.closest("a");
                if (!anchor || !anchor.href) {
                    return;
                }
                const url = new URL(anchor.href, location.href);
                const isPullToRefresh = target.dataset.pullToRefresh === "true";
                if (anchor.target !== "_blank" && url.origin === location.origin && url.protocol !== "blob:" && url.protocol !== "mailto:" && url.protocol !== "tel:" && (location.origin + location.pathname + location.search !== url.origin + url.pathname + url.search || !url.hash)) {
                    event.preventDefault();
                    if (isPullToRefresh) {
                        navigate(url.href, false);
                    }
                    else {
                        const isNewPage = url.href !== location.href;
                        navigate(url.href, isNewPage);
                    }
                }
            };
            let currentUrl = window.location.href.split("#")[0];
            const onPopState = event => {
                let newUrl = window.location.href.split("#")[0];
                if (currentUrl !== newUrl) {
                    newUrl = window.location.href;
                }
                if (newUrl && currentUrl !== newUrl) {
                    navigate(newUrl, false);
                }
            };
            const navigate = (url, pushHistory = false) => {
                spaLoader.classList.add("active");
                fetch(url).then(result => result.text()).then(result => {
                    let doc = (new DOMParser()).parseFromString(result, "text/html");
                    let head = doc.querySelector("head");
                    let body = doc.querySelector("body");
                    if (!head || !body) {
                        return;
                    }
                    let metaThemeColor = document.querySelector("meta[name=\"theme-color\"]");
                    let newMetaThemeColor = head.querySelector("meta[name=\"theme-color\"]");
                    const historyState = {
                        link: url
                    };
                    if (metaThemeColor && newMetaThemeColor) {
                        newMetaThemeColor.content = metaThemeColor.content;
                    }
                    document.head.replaceWith(head);
                    document.body.innerHTML = body.innerHTML;
                    if (pushHistory) {
                        history.pushState(historyState, "", url);
                        window.scrollTo(0, 0);
                    }
                    document.querySelectorAll("script").forEach(oldScript => {
                        if (oldScript.dataset.reload === "false") {
                            return;
                        }
                        let newScript = document.createElement("script");
                        for (let attribute of oldScript.attributes) {
                            newScript.setAttribute(attribute.name, attribute.value);
                        }
                        if (oldScript.src) {
                            newScript.src = oldScript.src;
                        }
                        else {
                            newScript.textContent = oldScript.textContent;
                        }
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                }).catch(error => {
                }).finally(() => {
                    setTimeout(() => {
                        spaLoader.classList.remove("active");
                    }, 400);
                });
            };
            if (state.click) {
                document.body.removeEventListener("click", state.click);
            }
            if (state.popstate) {
                window.removeEventListener("popstate", state.popstate);
            }
            state.click = onClick;
            state.popstate = onPopState;
            document.body.addEventListener("click", state.click);
            window.addEventListener("popstate", state.popstate);
        }
        catch (error) {
        }
    }
});

// ===== Plugin: Pull to Refresh =====
(function () {
    const configScript = getPluginScript("Pull to Refresh");
    if (configScript) {
        try {
            if (!JSON.parse(configScript.textContent).status) {
                return;
            }
            const tanDegrees = degrees => Math.tan(degrees * Math.PI / 180);
            const getHeader = () => document.querySelector("header");
            const getContent = () => document.querySelector("main") || document.body;
            let pullRefreshIndicator = document.querySelector(".pull-refresh-indicator");
            let pullRefreshIcon = pullRefreshIndicator?.querySelector(".pull-refresh-icon");
            if (!(pullRefreshIndicator && pullRefreshIcon)) {
                pullRefreshIndicator = document.createElement("div");
                pullRefreshIndicator.className = "pull-refresh-indicator";
                pullRefreshIcon = document.createElement("div");
                pullRefreshIcon.className = "pull-refresh-icon";
                pullRefreshIndicator.appendChild(pullRefreshIcon);
                (document.pbd || document.body).appendChild(pullRefreshIndicator);
                pullRefreshIcon.innerHTML = iconHtml("loader");
            }
            let startY = 0;
            let startX = 0;
            let pullDistance = 0;
            let isPulling = false;
            let isCancelled = false;
            let horizontalScroller = null;
            let startedAtTop = false;
            let isIgnored = false;
            let ptrActive = false;
            const positionIndicator = () => {
                const header = getHeader();
                if (header) {
                    const rect = header.getBoundingClientRect();
                    pullRefreshIndicator.style.top = Math.max(0, rect.bottom) + "px";
                }
                else {
                    pullRefreshIndicator.style.top = "0px";
                }
            };
            const passiveListener = {
                passive: true
            };
            positionIndicator();
            window.addEventListener("resize", positionIndicator, passiveListener);
            const getScrollLockState = () => {
                const style = window.getComputedStyle(document.body);
                const lockState = {
                    locked: style.overflow === "hidden" || style.overflowY === "hidden",
                    byPtr: ptrActive
                };
                return lockState;
            };
            const activateIcon = () => {
                if (!ptrActive) {
                    pullRefreshIcon.classList.add("ptr-active");
                    ptrActive = true;
                }
            };
            const deactivateIcon = () => {
                pullRefreshIcon.classList.remove("ptr-active");
                ptrActive = false;
            };
            const startPulling = () => {
                if (!isPulling) {
                    isPulling = true;
                    activateIcon();
                    positionIndicator();
                    pullRefreshIndicator.style.visibility = "visible";
                }
            };
            const updatePull = distance => {
                const content = getContent();
                if (!content) {
                    return;
                }
                const clamped = Math.max(0, Math.min(distance, 160));
                const ratio = clamped / 160;
                const eased = (1 - Math.pow(1 - ratio, 1.8)) * 160;
                content.style.transition = "none";
                pullRefreshIndicator.style.transition = "none";
                pullRefreshIcon.style.transition = "none";
                content.style.transform = "translateY(" + eased + "px)";
                pullRefreshIndicator.style.height = eased + "px";
                const progress = Math.min(clamped / 120, 1);
                pullRefreshIcon.style.opacity = progress;
                const scale = .5 + .5 * progress;
                const rotation = 360 * progress;
                pullRefreshIcon.style.transform = "rotate(" + rotation + "deg) scale" + "(" + scale + ")";
            };
            const onTransitionEnd = event => {
                if (event.propertyName !== "transform") {
                    return;
                }
                const content = getContent();
                if (content) {
                    content.style.transition = "";
                    content.style.transform = "";
                    content.removeEventListener("transitionend", onTransitionEnd);
                }
                pullRefreshIndicator.style.transition = "";
                pullRefreshIndicator.style.visibility = "hidden";
                pullRefreshIcon.style.transition = "";
            };
            const resetPull = () => {
                const content = getContent();
                if (content) {
                    content.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
                    pullRefreshIndicator.style.transition = "height 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
                    pullRefreshIcon.style.transition = "opacity 0.2s ease, transform 0.3s ease";
                    content.style.transform = "translateY(0)";
                    pullRefreshIndicator.style.height = "0px";
                    pullRefreshIcon.style.opacity = "0";
                    pullRefreshIcon.style.transform = "rotate(0deg) scale(.5)";
                    content.addEventListener("transitionend", onTransitionEnd);
                }
            };
            const triggerRefresh = () => {
                const link = document.createElement("a");
                link.href = window.location.href.split("#")[0];
                link.dataset.pullToRefresh = "true";
                document.body.append(link);
                link.click();
                link.remove();
                resetPull();
            };
            const isAtTop = node => {
                if (window.scrollY > 0) {
                    return false;
                }
                while (node) {
                    const style = window.getComputedStyle(node);
                    if (/(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY)) {
                        return node.scrollTop === 0;
                    }
                    node = node.parentElement;
                }
                return true;
            };
            const findHorizontalScroller = node => {
                while (node) {
                    const style = window.getComputedStyle(node);
                    const isScrollable = node.scrollWidth > node.clientWidth;
                    if ((style.overflowX === "auto" || style.overflowX === "scroll") && isScrollable) {
                        return node;
                    }
                    node = node.parentElement;
                }
                return null;
            };
            const findVerticalScroller = node => {
                while (node && node !== document.body) {
                    const style = window.getComputedStyle(node);
                    const isScrollable = node.scrollHeight > node.clientHeight;
                    if ((style.overflowY === "auto" || style.overflowY === "scroll") && isScrollable) {
                        return node;
                    }
                    node = node.parentElement;
                }
                return null;
            };
            const onTouchStart = event => {
                if (!getContent()) {
                    return;
                }
                const touch = event.touches[0];
                startY = touch.clientY;
                startX = touch.clientX;
                pullDistance = 0;
                isCancelled = false;
                isPulling = false;
                isIgnored = false;
                horizontalScroller = findHorizontalScroller(event.target);
                startedAtTop = window.scrollY === 0;
            };
            const onTouchMove = event => {
                const touch = event.touches[0];
                const clientY = touch.clientY;
                const deltaX = touch.clientX - startX;
                const deltaY = clientY - startY;
                const dampened = Math.pow(Math.max(deltaY, 0), .85);
                pullDistance = Math.min(dampened, 160);
                const atTop = window.scrollY === 0;
                const { locked: locked, byPtr: byPtr } = getScrollLockState();
                const verticalScroller = findVerticalScroller(event.target);
                if (!isIgnored) {
                    if (isPulling) {
                        event.preventDefault();
                        updatePull(pullDistance);
                        return;
                    }
                    if (!(locked && !byPtr && atTop && startedAtTop && !horizontalScroller && !verticalScroller && deltaY > 0)) {
                        if (horizontalScroller && verticalScroller && verticalScroller.scrollTop > 0 && deltaY > 0) {
                            isIgnored = true;
                        }
                        else {
                            if (horizontalScroller && atTop && startedAtTop && !verticalScroller) {
                                const angleRatio = Math.abs(deltaY) / (Math.abs(deltaX) || 1);
                                if (Math.abs(deltaX) > 0 && angleRatio <= tanDegrees(42)) {
                                    return;
                                }
                                if (deltaY > 0 && angleRatio > tanDegrees(42)) {
                                    event.preventDefault();
                                }
                                if (deltaY > 0 && angleRatio > tanDegrees(60)) {
                                    event.preventDefault();
                                    startPulling();
                                    updatePull(pullDistance);
                                }
                                return;
                            }
                            if (horizontalScroller && atTop && startedAtTop && verticalScroller) {
                                const angleRatio = Math.abs(deltaY) / (Math.abs(deltaX) || 1);
                                if (Math.abs(deltaX) > 0 && angleRatio <= tanDegrees(44)) {
                                    pullDistance = 0;
                                    return;
                                }
                                else {
                                    if (verticalScroller.scrollTop === 0 && deltaY > 0 && angleRatio >= tanDegrees(44)) {
                                        event.preventDefault();
                                        startPulling();
                                        updatePull(pullDistance);
                                    }
                                    return;
                                }
                            }
                            if (verticalScroller) {
                                if (verticalScroller.scrollTop > 0 && deltaY > 0) {
                                    return;
                                }
                                if (verticalScroller.scrollTop === 0 && deltaY > 0 && atTop) {
                                    event.preventDefault();
                                    return;
                                }
                            }
                            if (startY && isAtTop(event.target)) {
                                const angleRatio = Math.abs(deltaY) / (Math.abs(deltaX) || 1);
                                if (pullDistance > 0 && angleRatio > tanDegrees(44) && atTop && startedAtTop) {
                                    event.preventDefault();
                                    startPulling();
                                    updatePull(pullDistance);
                                }
                                else {
                                    if (pullDistance > 0 && angleRatio <= tanDegrees(44)) {
                                        isIgnored = true;
                                    }
                                    else {
                                        if (pullDistance > 0 && atTop && !startedAtTop) {
                                            event.preventDefault();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            const onTouchEnd = () => {
                deactivateIcon();
                if (isPulling) {
                    if (!isCancelled && pullDistance >= 120) {
                        triggerRefresh();
                    }
                    else {
                        resetPull();
                    }
                    isPulling = false;
                    startY = 0;
                    pullDistance = 0;
                }
            };
            const passiveOptions = {
                passive: true
            };
            const activeOptions = {
                passive: false
            };
            window.addEventListener("touchstart", onTouchStart, passiveOptions);
            window.addEventListener("touchmove", onTouchMove, activeOptions);
            window.addEventListener("touchend", onTouchEnd);
        }
        catch {
        }
    }
})();

// ===== Component: "[id^="open-"]" =====
domWatcher.registerAll("[id^=\"open-\"]", (idOpen, state) => {
    if (!state.popstateInit) {
        state.popstateInit = true;
        window.addEventListener("popstate", event => {
            state.isNavigating = true;
            const state2 = event.state || {};
            const popup = state2.popup || null;
            document.querySelectorAll("[id^=\"open-\"]").forEach(idOpen2 => {
                idOpen2.checked = idOpen2.id === popup;
            });
            const toast = state2.toast || null;
            document.querySelectorAll(".pop-ov.active").forEach(popOvActive => {
                if (popOvActive.dataset.toastId !== toast) {
                    popOvActive.classList.remove("active");
                    popOvActive.ontransitionend = () => {
                        if (!popOvActive.classList.contains("active")) {
                            popOvActive.remove();
                        }
                    };
                }
            });
            state.isNavigating = false;
        });
    }
    idOpen.addEventListener("change", function () {
        if (!state.isNavigating) {
            if (this.checked) {
                state.isNavigating = true;
                document.querySelectorAll("[id^=\"open-\"]").forEach(idOpen2 => {
                    if (idOpen2 !== this) {
                        idOpen2.checked = false;
                    }
                });
                state.isNavigating = false;
                const popup = history.state?.popup;
                if (popup && popup !== this.id) {
                    history.replaceState({
                        ...history.state,
                        popup: this.id
                    }, "", "");
                }
                else {
                    if (!popup) {
                        history.pushState({
                            ...history.state,
                            popup: this.id
                        }, "", "");
                    }
                }
            }
            else {
                const id = this.id;
                setTimeout(() => {
                    const idOpen2 = document.querySelector("[id^=\"open-\"]:checked");
                    if (!(state.isNavigating || history.state?.popup !== id || idOpen2)) {
                        history.back();
                    }
                }, 10);
            }
        }
    });
});
