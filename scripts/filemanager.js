(function () {
    "use strict";

    const FileManager = {

        currentPath: "/home/dead/Desktop",

        selectedPath: null,

        clipboard: null, /* { path, mode: "copy" | "cut" } */

        open(path) {
            if (path) {
                const node = FS.find(path);

                if (!node || node.type !== "directory") {
                    notify("Folder not found.", "error");
                    return;
                }

                this.currentPath = FS.normalize(path);
                this.selectedPath = null;
            }

            openWin("files");

            this.refresh();
        },

        goUp() {
            const parent = FS.parent(this.currentPath);

            if (parent !== null) {
                this.currentPath = parent;
                this.selectedPath = null;
                this.refresh();
            }
        },

        refresh() {
            const pathElement = document.getElementById("filePath");
            const list = document.getElementById("fileList");

            if (!pathElement || !list) return;

            /* If the folder was deleted, climb to the nearest existing one. */
            while (
                this.currentPath !== "/" &&
                (
                    !FS.find(this.currentPath) ||
                    FS.find(this.currentPath).type !== "directory"
                )
            ) {
                this.currentPath = FS.parent(this.currentPath);
            }

            pathElement.textContent = this.currentPath;

            list.textContent = "";

            if (
                this.selectedPath &&
                !FS.exists(this.selectedPath)
            ) {
                this.selectedPath = null;
            }

            if (this.currentPath !== "/") {
                const back = document.createElement("div");

                back.className = "file-row";

                back.innerHTML = `
                    <span class="file-type">DIR</span>
                    <span class="file-name">..</span>
                    <span class="file-meta">parent</span>
                `;

                back.addEventListener("dblclick", () => this.goUp());

                list.appendChild(back);
            }

            const entries = FS.listSorted(this.currentPath);

            if (!entries.length) {
                const empty = document.createElement("div");

                empty.className = "file-empty";
                empty.textContent = "Directory is empty.";

                list.appendChild(empty);

                return;
            }

            entries.forEach((item) => {
                const itemPath = FS.join(this.currentPath, item.name);

                const row = document.createElement("div");

                row.className = "file-row";
                row.dataset.path = itemPath;

                if (itemPath === this.selectedPath) {
                    row.classList.add("selected");
                }

                if (
                    this.clipboard &&
                    this.clipboard.mode === "cut" &&
                    this.clipboard.path === itemPath
                ) {
                    row.classList.add("cut");
                }

                const type = document.createElement("span");
                const name = document.createElement("span");
                const meta = document.createElement("span");

                type.className = "file-type";
                name.className = "file-name";
                meta.className = "file-meta";

                type.textContent =
                    item.type === "directory"
                        ? "DIR"
                        : getExtension(item.name);

                name.textContent = item.name;

                meta.textContent =
                    item.type === "directory"
                        ? item.children.length + " item(s)"
                        : formatSize(item.content.length) +
                          " · " + formatDate(item.modifiedAt);

                row.append(type, name, meta);

                row.addEventListener("click", () => {
                    list
                        .querySelectorAll(".file-row.selected")
                        .forEach((el) => el.classList.remove("selected"));

                    row.classList.add("selected");

                    this.selectedPath = itemPath;
                });

                row.addEventListener("dblclick", () => {
                    if (item.type === "directory") {
                        this.currentPath = itemPath;
                        this.selectedPath = null;
                        this.refresh();
                    } else {
                        TextEditor.open(itemPath);
                    }
                });

                list.appendChild(row);
            });
        },

        newFile(path = this.currentPath) {
            const name = prompt("File name:", "new-file.txt");

            if (!name) return;

            try {
                FS.create(FS.join(path, name.trim()), "file", "");
                sync(this);
            } catch (error) {
                notify(error.message, "error");
            }
        },

        newFolder(path = this.currentPath) {
            const name = prompt("Folder name:", "new-folder");

            if (!name) return;

            try {
                FS.create(FS.join(path, name.trim()), "directory");
                sync(this);
            } catch (error) {
                notify(error.message, "error");
            }
        },

        renameSelected() {
            if (!this.selectedPath) {
                notify("Select a file or folder first.");
                return;
            }

            const oldName = FS.name(this.selectedPath);
            const newName = prompt("New name:", oldName);

            if (!newName || newName === oldName) return;

            try {
                FS.rename(this.selectedPath, newName);
                this.selectedPath = null;
                sync(this);
            } catch (error) {
                notify(error.message, "error");
            }
        },

        deleteSelected() {
            if (!this.selectedPath) {
                notify("Select a file or folder first.");
                return;
            }

            const name = FS.name(this.selectedPath);

            if (!confirm(`Move "${name}" to Trash?`)) return;

            try {
                FS.remove(this.selectedPath);
                this.selectedPath = null;
                sync(this);
                notify(`Moved "${name}" to Trash.`);
            } catch (error) {
                notify(error.message, "error");
            }
        },

        copySelected() {
            if (!this.selectedPath) {
                notify("Select a file or folder first.");
                return;
            }

            this.clipboard = { path: this.selectedPath, mode: "copy" };
            notify(`Copied "${FS.name(this.selectedPath)}".`);
            this.refresh();
        },

        cutSelected() {
            if (!this.selectedPath) {
                notify("Select a file or folder first.");
                return;
            }

            if (FS.isProtected(this.selectedPath)) {
                notify("Protected system directory.", "error");
                return;
            }

            this.clipboard = { path: this.selectedPath, mode: "cut" };
            notify(`Cut "${FS.name(this.selectedPath)}".`);
            this.refresh();
        },

        paste() {
            if (!this.clipboard) {
                notify("Clipboard is empty.");
                return;
            }

            const { path, mode } = this.clipboard;

            if (!FS.exists(path)) {
                this.clipboard = null;
                notify("The copied item no longer exists.", "error");
                return;
            }

            try {
                const name = FS.name(path);

                if (mode === "cut") {
                    if (FS.parent(path) === this.currentPath) {
                        notify("Item is already in this folder.");
                        return;
                    }

                    FS.move(
                        path,
                        FS.join(
                            this.currentPath,
                            FS.uniqueName(this.currentPath, name)
                        )
                    );

                    this.clipboard = null;
                } else {
                    FS.copy(
                        path,
                        FS.join(
                            this.currentPath,
                            FS.uniqueName(this.currentPath, name)
                        )
                    );
                }

                sync(this);
            } catch (error) {
                notify(error.message, "error");
            }
        }
    };

    /* ---------- helpers ---------- */

    function sync(manager) {
        if (typeof refreshLowOS === "function") {
            refreshLowOS();
        } else {
            manager.refresh();
        }
    }

    function notify(message, kind) {
        if (typeof window.toast === "function") {
            window.toast(message, kind);
        } else {
            alert(message);
        }
    }

    function getExtension(name) {
        if (!name.includes(".") || name.endsWith(".")) {
            return "FILE";
        }

        return name.split(".").pop().toUpperCase().slice(0, 6);
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + " B";

        return (bytes / 1024).toFixed(1) + " KB";
    }

    function formatDate(timestamp) {
        return new Date(timestamp)
            .toISOString()
            .slice(0, 16)
            .replace("T", " ");
    }

    document.addEventListener("DOMContentLoaded", () => {
        const on = (id, handler) => {
            const element = document.getElementById(id);

            if (element) element.addEventListener("click", handler);
        };

        on("fileBack", () => FileManager.goUp());
        on("newFile", () => FileManager.newFile());
        on("newFolder", () => FileManager.newFolder());
        on("fileRename", () => FileManager.renameSelected());
        on("fileDelete", () => FileManager.deleteSelected());
        on("fileCopy", () => FileManager.copySelected());
        on("fileCut", () => FileManager.cutSelected());
        on("filePaste", () => FileManager.paste());
        on("fileRefresh", () => FileManager.refresh());
    });

    window.FileManager = FileManager;

})();
