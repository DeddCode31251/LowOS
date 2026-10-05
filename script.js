(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const DESKTOP = "/home/dead/Desktop";
    const ZONES = ["filesZone", "workspaceZone", "systemZone"];
    const DEFAULT_ZONE = "filesZone";

    const BOOT_LINES = [
        "LowOS bootloader v3.0",
        "[ OK ] Initializing toy CPU (AX BX CX DX)",
        "[ OK ] Mounting virtual filesystem",
        "[ OK ] Starting window manager",
        "[ OK ] Starting LowOS shell",
        "Ready."
    ];

    const APPS = [
        ["welcome", "readme.asm"],
        ["term", "Shell"],
        ["lab", "CPU Lab"],
        ["proj", "Projects"],
        ["files", "File Manager"],
        ["editor", "Text Editor"],
        ["calculator", "Calculator"],
        ["browser", "Browser"],
        ["trash", "Trash"]
    ];

    let highestZ = 20;
    let selectedDesktopPath = null;

    const isMobile = () =>
        window.matchMedia && matchMedia("(max-width: 800px)").matches;

    const isTouch = () =>
        window.matchMedia && matchMedia("(pointer: coarse)").matches;

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#039;");
    }

    /* ======================================================
       TOASTS
       ====================================================== */

    function toast(message, kind) {
        let box = $("toasts");

        if (!box) {
            box = document.createElement("div");
            box.id = "toasts";
            box.setAttribute("role", "status");
            box.setAttribute("aria-live", "polite");
            document.body.appendChild(box);
        }

        const item = document.createElement("div");

        item.className = "toast" + (kind === "error" ? " error" : "");
        item.textContent = message;

        box.appendChild(item);

        while (box.children.length > 4) {
            box.firstChild.remove();
        }

        setTimeout(() => {
            item.classList.add("out");
            setTimeout(() => item.remove(), 300);
        }, kind === "error" ? 4000 : 2200);
    }

    /* ======================================================
       WINDOWS
       ====================================================== */

    function focusWin(win) {
        document.querySelectorAll(".win.active").forEach((w) => {
            if (w !== win) w.classList.remove("active");
        });

        highestZ++;
        win.style.zIndex = highestZ;
        win.classList.add("active");
    }

    function keepOnScreen(win) {
        if (isMobile() || win.classList.contains("max")) return;

        const rect = win.getBoundingClientRect();

        let left = parseFloat(win.style.left) || rect.left;
        let top = parseFloat(win.style.top) || rect.top;

        left = Math.max(0, Math.min(left, window.innerWidth - Math.min(rect.width, window.innerWidth)));
        top = Math.max(44, Math.min(top, window.innerHeight - 60));

        win.style.left = left + "px";
        win.style.top = top + "px";
    }

    function openWin(id) {
        const win = $(id);

        if (!win) return;

        win.classList.add("open");

        keepOnScreen(win);
        focusWin(win);

        const input = win.querySelector(
            "input:not([readonly]):not([type=hidden]), textarea"
        );

        if (input && id !== "browser") {
            setTimeout(() => input.focus(), 30);
        }
    }

    function closeWin(id) {
        const win = typeof id === "string" ? $(id) : id;

        if (!win) return;

        if (
            win.id === "editor" &&
            window.TextEditor &&
            !TextEditor.confirmDiscard()
        ) {
            return;
        }

        win.classList.remove("open", "active", "max");
    }

    function setupWindows() {
        document.querySelectorAll(".win").forEach((win) => {
            const bar = win.querySelector(".wh");
            const close = win.querySelector("[data-close]");

            win.addEventListener("pointerdown", () => focusWin(win), true);

            if (close) {
                close.setAttribute("role", "button");
                close.setAttribute("tabindex", "0");
                close.setAttribute("aria-label", "Close window");

                close.addEventListener("click", (event) => {
                    event.stopPropagation();
                    closeWin(win);
                });

                close.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        closeWin(win);
                    }
                });
            }

            if (!bar) return;

            bar.addEventListener("dblclick", (event) => {
                if (event.target.closest("[data-close]") || isMobile()) return;

                win.classList.toggle("max");
            });

            bar.addEventListener("pointerdown", (event) => {
                if (
                    event.button > 0 ||
                    event.target.closest("[data-close]") ||
                    win.classList.contains("max") ||
                    isMobile()
                ) {
                    return;
                }

                const rect = win.getBoundingClientRect();

                const offsetX = event.clientX - rect.left;
                const offsetY = event.clientY - rect.top;

                bar.setPointerCapture(event.pointerId);
                bar.style.cursor = "grabbing";

                const move = (e) => {
                    const x = Math.max(
                        -rect.width + 90,
                        Math.min(e.clientX - offsetX, window.innerWidth - 90)
                    );

                    const y = Math.max(
                        40,
                        Math.min(e.clientY - offsetY, window.innerHeight - 40)
                    );

                    win.style.left = x + "px";
                    win.style.top = y + "px";
                };

                const up = () => {
                    bar.style.cursor = "";
                    bar.removeEventListener("pointermove", move);
                    bar.removeEventListener("pointerup", up);
                    bar.removeEventListener("pointercancel", up);
                };

                bar.addEventListener("pointermove", move);
                bar.addEventListener("pointerup", up);
                bar.addEventListener("pointercancel", up);
            });
        });

        window.addEventListener("resize", () => {
            document.querySelectorAll(".win.open").forEach(keepOnScreen);
        });
    }

    /* ======================================================
       APP LAUNCHER
       ====================================================== */

    function openApp(id, arg) {
        switch (id) {
            case "files":
                FileManager.open(arg);
                break;

            case "editor":
                TextEditor.open(arg);
                break;

            case "calculator":
                Calculator.open();
                break;

            case "browser":
                BrowserApp.open();
                break;

            case "trash":
                renderTrash();
                openWin("trash");
                break;

            default:
                openWin(id);
        }
    }

    function openItem(path) {
        const node = FS.find(path);

        if (!node) {
            toast("Item no longer exists.", "error");
            refreshLowOS();
            return;
        }

        if (node.type === "directory") {
            FileManager.open(path);
        } else {
            TextEditor.open(path);
        }
    }

    function renameItem(path) {
        const oldName = FS.name(path);
        const newName = prompt("New name:", oldName);

        if (!newName || newName === oldName) return;

        try {
            FS.rename(path, newName);
            selectedDesktopPath = null;
            refreshLowOS();
        } catch (error) {
            toast(error.message, "error");
        }
    }

    function trashItem(path) {
        const name = FS.name(path);

        if (!confirm(`Move "${name}" to Trash?`)) return;

        try {
            FS.remove(path);
            selectedDesktopPath = null;
            refreshLowOS();
            toast(`Moved "${name}" to Trash.`);
        } catch (error) {
            toast(error.message, "error");
        }
    }

    /* ======================================================
       DESKTOP
       ====================================================== */

    function iconLabel(name) {
        if (!name.includes(".") || name.endsWith(".")) return "FILE";

        const extension = name.split(".").pop().toLowerCase();

        if (extension === "json") return "{}";

        return extension.slice(0, 4).toUpperCase();
    }

    function createIcon(item) {
        const element = document.createElement("div");

        element.className = "ico";
        element.tabIndex = 0;
        element.draggable = true;
        element.title = item.name;

        element.setAttribute("role", "button");

        element.dataset.path = FS.join(DESKTOP, item.name);
        element.dataset.kind = item.type;

        const icon = document.createElement("div");

        icon.className =
            "icon " + (item.type === "directory" ? "dir" : "file");

        icon.textContent =
            item.type === "directory" ? "DIR" : iconLabel(item.name);

        const label = document.createElement("span");

        label.textContent = item.name;

        element.append(icon, label);

        if (element.dataset.path === selectedDesktopPath) {
            element.classList.add("selected");
        }

        return element;
    }

    function renderDesktopFiles() {
        if (typeof FS === "undefined") return;

        let items = [];

        try {
            items = FS.listSorted(DESKTOP);
        } catch (error) {
            console.warn("LowOS: Desktop folder missing", error);
        }

        ZONES.forEach((zone) => {
            const grid = $(zone) && $(zone).querySelector(".desktop-grid");

            if (grid) grid.textContent = "";
        });

        items.forEach((item) => {
            let zone = FS.boxOf(item.id);

            if (!ZONES.includes(zone)) zone = DEFAULT_ZONE;

            const grid = $(zone).querySelector(".desktop-grid");

            grid.appendChild(createIcon(item));
        });
    }

    function selectIcon(icon) {
        document
            .querySelectorAll(".ico.selected")
            .forEach((el) => el.classList.remove("selected"));

        if (icon) {
            icon.classList.add("selected");
            selectedDesktopPath = icon.dataset.path;
        } else {
            selectedDesktopPath = null;
        }
    }

    function clearDropTargets() {
        document
            .querySelectorAll(".drop-target")
            .forEach((el) => el.classList.remove("drop-target"));
    }

    function setupDesktop() {
        const desktop = $("desktop");

        if (!desktop) return;

        desktop.addEventListener("dblclick", (event) => {
            const icon = event.target.closest(".ico[data-path]");

            if (icon) openItem(icon.dataset.path);
        });

        desktop.addEventListener("keydown", (event) => {
            const icon = event.target.closest(".ico");

            if (!icon) return;

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();

                if (icon.dataset.open) {
                    openApp(icon.dataset.open);
                } else if (icon.dataset.path) {
                    openItem(icon.dataset.path);
                }
            }
        });

        desktop.addEventListener("dragstart", (event) => {
            const icon = event.target.closest(".ico[data-path]");

            if (!icon) return;

            event.dataTransfer.setData("text/lowos-path", icon.dataset.path);
            event.dataTransfer.effectAllowed = "move";
        });

        desktop.addEventListener("dragover", (event) => {
            if (!event.dataTransfer.types.includes("text/lowos-path")) return;

            const folder = event.target.closest(".ico[data-kind=directory]");
            const zone = event.target.closest(".desktop-zone");

            clearDropTargets();

            if (folder) {
                event.preventDefault();
                folder.classList.add("drop-target");
            } else if (zone && ZONES.includes(zone.id)) {
                event.preventDefault();
                zone.classList.add("drop-target");
            }
        });

        desktop.addEventListener("dragleave", (event) => {
            if (!desktop.contains(event.relatedTarget)) clearDropTargets();
        });

        desktop.addEventListener("dragend", clearDropTargets);

        desktop.addEventListener("drop", (event) => {
            const path = event.dataTransfer.getData("text/lowos-path");

            clearDropTargets();

            if (!path) return;

            event.preventDefault();

            const node = FS.find(path);

            if (!node) return;

            const folder = event.target.closest(".ico[data-kind=directory]");
            const zone = event.target.closest(".desktop-zone");

            try {
                if (folder) {
                    if (folder.dataset.path === path) return;

                    FS.move(path, folder.dataset.path);
                    toast(`Moved to ${FS.name(folder.dataset.path)}.`);
                } else if (zone && ZONES.includes(zone.id)) {
                    FS.setBox(node.id, zone.id);
                }

                refreshLowOS();
            } catch (error) {
                toast(error.message, "error");
            }
        });
    }

    /* ======================================================
       GLOBAL CLICKS, MENUS, KEYBOARD
       ====================================================== */

    function buildStartMenu() {
        const menu = document.createElement("div");

        menu.id = "startMenu";
        menu.className = "context-menu start-menu hidden";

        APPS.forEach(([id, label]) => {
            const button = document.createElement("button");

            button.dataset.open = id;
            button.textContent = label;

            menu.appendChild(button);
        });

        const separator = document.createElement("div");

        separator.className = "menu-sep";
        menu.appendChild(separator);

        const reboot = document.createElement("button");

        reboot.textContent = "Reboot";
        reboot.addEventListener("click", () => reboot_());

        menu.appendChild(reboot);

        document.body.appendChild(menu);

        const brand = $("menu");

        if (brand) {
            brand.addEventListener("click", (event) => {
                event.stopPropagation();

                const wasHidden = menu.classList.contains("hidden");

                hideMenus();

                if (wasHidden) menu.classList.remove("hidden");
            });
        }
    }

    function hideMenus() {
        const context = $("contextMenu");
        const start = $("startMenu");

        if (context) context.classList.add("hidden");
        if (start) start.classList.add("hidden");
    }

    function setupContextMenu() {
        const menu = $("contextMenu");
        const desktop = $("desktop");

        if (!menu || !desktop) return;

        let targetPath = null;

        desktop.addEventListener("contextmenu", (event) => {
            if (event.target.closest(".ico[data-open]")) {
                event.preventDefault();
                return;
            }

            event.preventDefault();

            const icon = event.target.closest(".ico[data-path]");

            targetPath = icon ? icon.dataset.path : null;

            if (icon) selectIcon(icon);

            menu
                .querySelectorAll(".item-only")
                .forEach((el) => el.classList.toggle("hidden", !icon));

            hideMenus();

            menu.classList.remove("hidden");

            const x = Math.min(
                event.clientX,
                window.innerWidth - menu.offsetWidth - 4
            );

            const y = Math.min(
                event.clientY,
                window.innerHeight - menu.offsetHeight - 4
            );

            menu.style.left = Math.max(0, x) + "px";
            menu.style.top = Math.max(0, y) + "px";
        });

        const on = (id, handler) => {
            const element = $(id);

            if (element) element.addEventListener("click", handler);
        };

        on("contextOpen", () => targetPath && openItem(targetPath));
        on("contextRename", () => targetPath && renameItem(targetPath));
        on("contextDelete", () => targetPath && trashItem(targetPath));
        on("contextNewFile", () => FileManager.newFile(DESKTOP));
        on("contextNewFolder", () => FileManager.newFolder(DESKTOP));
        on("contextRefresh", () => {
            refreshLowOS();
            toast("Refreshed.");
        });
    }

    function setupGlobalEvents() {
        document.addEventListener("click", (event) => {
            hideMenus();

            const opener = event.target.closest("[data-open]");

            if (opener) {
                openApp(opener.dataset.open);
                return;
            }

            const icon = event.target.closest(".ico[data-path]");

            if (icon) {
                selectIcon(icon);

                if (isTouch()) openItem(icon.dataset.path);

                return;
            }

            if (event.target.closest("#desktop")) selectIcon(null);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hideMenus();
                return;
            }

            const typing = event.target.matches &&
                event.target.matches("input, textarea, select");

            if (typing || !selectedDesktopPath) return;

            if (event.key === "Delete") {
                event.preventDefault();
                trashItem(selectedDesktopPath);
            } else if (event.key === "F2") {
                event.preventDefault();
                renameItem(selectedDesktopPath);
            }
        });
    }

    /* ======================================================
       TRASH
       ====================================================== */

    function renderTrash() {
        const container = $("trashList");

        if (!container) return;

        container.textContent = "";

        const items = FS.getTrash();

        if (!items.length) {
            const empty = document.createElement("div");

            empty.className = "file-empty";
            empty.textContent = "Trash is empty.";

            container.appendChild(empty);

            return;
        }

        items.slice().reverse().forEach((item) => {
            const row = document.createElement("div");

            row.className = "trash-row";

            const info = document.createElement("div");
            const name = document.createElement("strong");
            const where = document.createElement("small");

            name.textContent =
                (item.type === "directory" ? "[DIR] " : "") + item.name;

            where.textContent =
                item.originalPath + "  ·  id " + item.id.slice(0, 8);

            info.append(name, where);

            const actions = document.createElement("div");

            actions.className = "trash-actions";

            const restore = document.createElement("button");
            const remove = document.createElement("button");

            restore.textContent = "Restore";
            remove.textContent = "Delete";
            remove.className = "danger";

            restore.addEventListener("click", () => {
                try {
                    FS.restore(item.id);
                    refreshLowOS();
                    toast(`Restored "${item.name}".`);
                } catch (error) {
                    toast(error.message, "error");
                }
            });

            remove.addEventListener("click", () => {
                if (!confirm(`Permanently delete "${item.name}"?`)) return;

                FS.permanent(item.id);
                renderTrash();
            });

            actions.append(restore, remove);
            row.append(info, actions);
            container.appendChild(row);
        });
    }

    function setupTrash() {
        const refresh = $("trashRefresh");
        const empty = $("trashEmpty");

        if (refresh) refresh.addEventListener("click", renderTrash);

        if (empty) {
            empty.addEventListener("click", () => {
                const count = FS.getTrash().length;

                if (!count) {
                    toast("Trash is already empty.");
                    return;
                }

                if (!confirm(`Permanently delete ${count} item(s)?`)) return;

                FS.clearTrash();
                renderTrash();
            });
        }
    }

    /* ======================================================
       CPU LAB
       ====================================================== */

    function updateRegs(state) {
        const element = $("regs");

        if (element) element.textContent = CPU.registerLine(state);
    }

    const Lab = {
        load(source) {
            $("src").value = source;
            openWin("lab");
        },

        run() {
            const out = $("cpuOut");
            const state = CPU.run($("src").value);

            out.textContent = CPU.format(state).join("\n");
            out.classList.toggle("error", !!state.error);

            updateRegs(state);

            return state;
        },

        reset() {
            $("src").value = CPU.DEFAULT_SOURCE;

            $("cpuOut").textContent = "";
            $("cpuOut").classList.remove("error");

            updateRegs({
                regs: { AX: 0, BX: 0, CX: 0, DX: 0 },
                pc: 0,
                zf: 0
            });
        }
    };

    window.Lab = Lab;

    function setupLab() {
        const run = $("run");
        const reset = $("reset");
        const src = $("src");

        if (run) run.addEventListener("click", () => Lab.run());
        if (reset) reset.addEventListener("click", () => Lab.reset());

        if (src) {
            src.addEventListener("keydown", (event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    Lab.run();
                }

                if (event.key === "Tab" && !event.shiftKey) {
                    event.preventDefault();

                    src.setRangeText(
                        "    ",
                        src.selectionStart,
                        src.selectionEnd,
                        "end"
                    );
                }
            });
        }
    }

    /* ======================================================
       TERMINAL UI
       ====================================================== */

    function termPrint(text, className) {
        const output = $("termOut");

        if (!output) return;

        String(text).split("\n").forEach((line) => {
            const row = document.createElement("div");

            if (className) row.className = className;

            row.textContent = line;

            output.appendChild(row);
        });

        while (output.children.length > 600) {
            output.firstChild.remove();
        }

        output.scrollTop = output.scrollHeight;
    }

    function termClear() {
        const output = $("termOut");

        if (output) output.textContent = "";
    }

    function updatePrompt() {
        const prompt = document.querySelector(".terminal-input .pr");

        if (prompt) {
            prompt.textContent = `dead@lowos:${Shell.promptPath()}$`;
        }
    }

    function termBanner() {
        termPrint("LowOS shell ready. Type 'help' for commands.", "sys");
    }

    function setupTerminal() {
        const input = $("termIn");
        const output = $("termOut");

        if (!input || !output) return;

        let historyIndex = 0;
        let draft = "";

        updatePrompt();

        output.addEventListener("click", () => {
            if (!String(window.getSelection())) input.focus();
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                const line = input.value;

                input.value = "";

                const echo = document.createElement("div");

                echo.className = "echo";

                const prompt = document.createElement("span");

                prompt.className = "pr";
                prompt.textContent = `dead@lowos:${Shell.promptPath()}$`;

                echo.append(prompt, document.createTextNode(" " + line));

                output.appendChild(echo);

                if (line.trim()) {
                    if (Shell.history[Shell.history.length - 1] !== line) {
                        Shell.history.push(line);
                    }

                    if (Shell.history.length > 200) Shell.history.shift();

                    const result = Shell.exec(line);

                    if (result.out) termPrint(result.out);
                    if (result.error) termPrint(result.error, "error");
                }

                historyIndex = Shell.history.length;
                draft = "";

                updatePrompt();

                output.scrollTop = output.scrollHeight;

                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();

                if (historyIndex === Shell.history.length) draft = input.value;

                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = Shell.history[historyIndex];
                }

                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();

                if (historyIndex < Shell.history.length) {
                    historyIndex++;

                    input.value =
                        historyIndex === Shell.history.length
                            ? draft
                            : Shell.history[historyIndex];
                }

                return;
            }

            if (event.key === "Tab") {
                event.preventDefault();

                const result = Shell.complete(input.value);

                input.value = result.line;

                if (result.options.length > 1) {
                    termPrint(result.options.join("  "), "sys");
                }

                return;
            }

            if (event.ctrlKey && event.key.toLowerCase() === "l") {
                event.preventDefault();
                termClear();
                return;
            }

            if (event.ctrlKey && event.key.toLowerCase() === "c") {
                if (window.getSelection().toString()) return;

                event.preventDefault();
                termPrint("^C", "sys");
                input.value = "";
            }
        });
    }

    /* ======================================================
       BACKUP / IMPORT
       ====================================================== */

    function exportData() {
        const blob = new Blob(
            [JSON.stringify(FS.exportData(), null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "lowos-backup.json";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function importData() {
        const input = document.createElement("input");

        input.type = "file";
        input.accept = "application/json,.json";

        input.addEventListener("change", async () => {
            const file = input.files[0];

            if (!file) return;

            try {
                FS.importData(JSON.parse(await file.text()));

                refreshLowOS();

                toast("Filesystem imported.");
                termPrint("Filesystem imported.", "sys");
            } catch (error) {
                toast("Import failed: " + error.message, "error");
            }
        });

        input.click();
    }

    /* ======================================================
       REFRESH
       ====================================================== */

    function refreshLowOS() {
        try {
            renderDesktopFiles();
        } catch (error) {
            console.error("Desktop render error:", error);
        }

        if (window.FileManager) FileManager.refresh();

        const trash = $("trash");

        if (trash && trash.classList.contains("open")) renderTrash();

        updatePrompt();
    }

    /* ======================================================
       CLOCK
       ====================================================== */

    function clock() {
        const element = $("clock");

        if (!element) return;

        const now = new Date();

        element.textContent = now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        element.title = now.toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    /* ======================================================
       BOOT
       ====================================================== */

    function runBoot(fast) {
        return new Promise((resolve) => {
            const boot = $("boot");

            if (!boot) {
                resolve();
                return;
            }

            const text = $("bootText");
            const fill = $("fill");
            const pct = $("pct");

            boot.classList.remove("hidden", "fade");

            text.textContent = "";
            fill.style.width = "0";
            pct.textContent = "0%";

            let index = 0;
            let done = false;

            const skip = () => finish();

            const finish = () => {
                if (done) return;

                done = true;

                clearInterval(timer);
                clearTimeout(failsafe);

                boot.removeEventListener("click", skip);
                window.removeEventListener("keydown", skip);

                fill.style.width = "100%";
                pct.textContent = "100%";

                boot.classList.add("fade");

                setTimeout(() => {
                    boot.classList.add("hidden");
                    boot.classList.remove("fade");
                    resolve();
                }, fast ? 0 : 230);
            };

            const timer = setInterval(() => {
                if (index < BOOT_LINES.length) {
                    text.textContent += BOOT_LINES[index] + "\n";
                    index++;

                    const percent = Math.round((index / BOOT_LINES.length) * 100);

                    fill.style.width = percent + "%";
                    pct.textContent = percent + "%";
                } else {
                    finish();
                }
            }, fast ? 25 : 110);

            const failsafe = setTimeout(finish, 4000);

            boot.addEventListener("click", skip);
            window.addEventListener("keydown", skip);
        });
    }

    function hideBootNow() {
        const boot = $("boot");

        if (boot) boot.classList.add("hidden");
    }

    /* Named reboot_ to avoid clashing with the Shell `reboot` command. */
    async function reboot_() {
        document.querySelectorAll(".win").forEach((win) => {
            win.classList.remove("open", "active", "max");
        });

        if (window.TextEditor) {
            TextEditor.dirty = false;
            TextEditor.currentPath = null;
        }

        hideMenus();
        termClear();

        FS.init();
        FS.currentPath = FS.HOME;

        refreshLowOS();

        await runBoot(false);

        termBanner();
        openWin("term");
    }

    /* ======================================================
       STARTUP
       ====================================================== */

    function safely(label, fn) {
        try {
            fn();
        } catch (error) {
            console.error(label + " startup error:", error);
        }
    }

    function startup() {
        /* Everything is initialised first; the boot animation then plays
           on top of an already-working desktop, and can be skipped. */
        safely("Filesystem", () => FS.init());
        safely("Windows", setupWindows);
        safely("Desktop", setupDesktop);
        safely("Context menu", setupContextMenu);
        safely("Start menu", buildStartMenu);
        safely("Events", setupGlobalEvents);
        safely("Trash", setupTrash);
        safely("CPU lab", setupLab);
        safely("Terminal", setupTerminal);
        safely("Desktop files", renderDesktopFiles);

        safely("Clock", () => {
            clock();
            setInterval(clock, 1000);
        });

        Object.assign(Shell.ui, {
            openApp,
            openFile: (path) => TextEditor.open(path),
            clear: termClear,
            reboot: () => { setTimeout(reboot_, 0); },
            exportData,
            importData,
            loadLab: (source) => Lab.load(source),
            updateRegs,
            refresh: refreshLowOS
        });

        termBanner();

        let seen = false;

        try {
            seen = sessionStorage.getItem("lowos.booted") === "1";
            sessionStorage.setItem("lowos.booted", "1");
        } catch (error) {
            /* sessionStorage unavailable - always do the full boot */
        }

        runBoot(seen).then(() => {
            let first = true;

            try {
                first = !localStorage.getItem("lowos.welcomed");
                localStorage.setItem("lowos.welcomed", "1");
            } catch (error) {
                /* ignore */
            }

            openWin(first ? "welcome" : "term");
        });
    }

    window.openWin = openWin;
    window.closeWin = closeWin;
    window.refreshLowOS = refreshLowOS;
    window.toast = toast;
    window.renderTrash = renderTrash;

    window.addEventListener("error", (event) => {
        console.error("LowOS error:", event.error || event.message);

        /* A script error must never leave the boot screen stuck. */
        hideBootNow();
    });

    window.addEventListener("unhandledrejection", (event) => {
        console.error("LowOS promise error:", event.reason);
    });

    document.addEventListener("DOMContentLoaded", startup);

})();
