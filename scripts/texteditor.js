(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const DOCUMENTS = "/home/dead/Documents";

    const TextEditor = {

        currentPath: null,

        dirty: false,

        /* open()      -> just show the editor window
           open(path)  -> load that file */
        open(path) {
            if (path === undefined) {
                openWin("editor");
                return;
            }

            if (!this.confirmDiscard()) return;

            const file = FS.find(path);

            if (!file || file.type !== "file") {
                notify("File not found.", "error");
                return;
            }

            this.currentPath = FS.normalize(path);

            $("editorName").value = file.name;
            $("editorContent").value = file.content || "";

            this.dirty = false;
            this.updateTitle();

            openWin("editor");
        },

        newDocument() {
            if (!this.confirmDiscard()) return;

            this.currentPath = null;

            $("editorName").value = "untitled.txt";
            $("editorContent").value = "";

            this.dirty = false;
            this.updateTitle();

            openWin("editor");

            $("editorContent").focus();
        },

        confirmDiscard() {
            return (
                !this.dirty ||
                confirm("You have unsaved changes. Discard them?")
            );
        },

        markDirty() {
            if (!this.dirty) {
                this.dirty = true;
                this.updateTitle();
            }
        },

        updateTitle() {
            const label = this.currentPath || "Untitled (not saved yet)";

            $("editorPath").textContent =
                label + (this.dirty ? "  *" : "");
        },

        save() {
            const name = $("editorName").value.trim();

            if (!this.currentPath) {
                this.saveAs();
                return;
            }

            if (!name) {
                notify("Filename cannot be empty.", "error");
                return;
            }

            const content = $("editorContent").value;

            try {
                /* File was deleted while open: recreate it where it was. */
                if (!FS.exists(this.currentPath)) {
                    FS.create(this.currentPath, "file", content);
                }

                const oldName = FS.name(this.currentPath);

                if (name !== oldName) {
                    FS.rename(this.currentPath, name);

                    this.currentPath = FS.join(
                        FS.parent(this.currentPath),
                        name
                    );
                }

                FS.write(this.currentPath, content);

                this.dirty = false;
                this.updateTitle();

                refreshLowOS();

                notify("Saved.");

            } catch (error) {
                notify(error.message, "error");
            }
        },

        saveAs() {
            const name = $("editorName").value.trim();

            if (!name) {
                notify("Enter a filename.", "error");
                return;
            }

            const content = $("editorContent").value;

            /* "dir/name" saves there; a bare name goes to Documents. */
            const path = name.includes("/")
                ? FS.normalize(name)
                : FS.join(DOCUMENTS, name);

            try {
                if (FS.exists(path)) {
                    if (FS.find(path).type !== "file") {
                        throw new Error("That name is a folder");
                    }

                    if (!confirm("File exists. Overwrite?")) return;

                    FS.write(path, content);
                } else {
                    FS.create(path, "file", content);
                }

                this.currentPath = path;

                $("editorName").value = FS.name(path);

                this.dirty = false;
                this.updateTitle();

                refreshLowOS();

                notify("Saved to " + FS.parent(path));

            } catch (error) {
                notify(error.message, "error");
            }
        },

        /* Send the buffer to the CPU lab. */
        runAsm() {
            if (!window.Lab) return;

            window.Lab.load($("editorContent").value);
            window.Lab.run();
        }
    };

    function notify(message, kind) {
        if (typeof window.toast === "function") {
            window.toast(message, kind);
        } else {
            alert(message);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const on = (id, event, handler) => {
            const element = $(id);

            if (element) element.addEventListener(event, handler);
        };

        on("editorSave", "click", () => TextEditor.save());
        on("editorSaveAs", "click", () => TextEditor.saveAs());
        on("editorNew", "click", () => TextEditor.newDocument());
        on("editorRun", "click", () => TextEditor.runAsm());

        on("editorName", "input", () => TextEditor.markDirty());
        on("editorContent", "input", () => TextEditor.markDirty());

        on("editorContent", "keydown", (event) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "s"
            ) {
                event.preventDefault();
                TextEditor.save();
                return;
            }

            if (event.key === "Tab" && !event.shiftKey) {
                event.preventDefault();

                const area = event.target;

                area.setRangeText(
                    "    ",
                    area.selectionStart,
                    area.selectionEnd,
                    "end"
                );

                TextEditor.markDirty();
            }
        });

        TextEditor.updateTitle();
        $("editorPath").textContent = "No file selected";
    });

    window.TextEditor = TextEditor;

})();
