(function () {
    "use strict";

    var currentPath = "/home/dead";

    function icon(item) {
        if (item.type === "directory") {
            return "DIR";
        }

        if (item.name.endsWith(".txt")) {
            return "TXT";
        }

        if (item.name.endsWith(".js")) {
            return "JS";
        }

        if (item.name.endsWith(".html")) {
            return "HTML";
        }

        return "FILE";
    }

    function open() {
        var existing =
            document.getElementById(
                "lowos-file-manager"
            );

        if (existing) {
            existing.remove();
        }

        var win =
            document.createElement("div");

        win.id = "lowos-file-manager";
        win.className = "lowos-app-window";

        win.style.width = "720px";
        win.style.height = "500px";
        win.style.left = "50%";
        win.style.top = "50%";
        win.style.transform =
            "translate(-50%, -50%)";

        win.innerHTML = `
            <div class="lowos-titlebar">
                <span>File Manager</span>
                <button class="lowos-close-button">x</button>
            </div>

            <div class="lowos-toolbar">
                <button id="fm-back">Back</button>
                <button id="fm-up">Up</button>
                <button id="fm-home">Home</button>

                <input id="fm-path">

                <button id="fm-go">Go</button>
            </div>

            <div class="lowos-file-actions">
                <button id="fm-new-folder">
                    New Folder
                </button>

                <button id="fm-new-file">
                    New File
                </button>

                <button id="fm-refresh">
                    Refresh
                </button>
            </div>

            <div
                id="fm-content"
                class="lowos-file-grid"
            ></div>
        `;

        document.body.appendChild(win);

        makeDraggable(win);

        win.querySelector(
            ".lowos-close-button"
        ).onclick = function () {
            win.remove();
        };

        document.getElementById(
            "fm-back"
        ).onclick = function () {
            navigate(
                LowOSFileSystem.normalizePath(
                    currentPath + "/.."
                )
            );
        };

        document.getElementById(
            "fm-up"
        ).onclick = function () {
            navigate(
                LowOSFileSystem.normalizePath(
                    currentPath + "/.."
                )
            );
        };

        document.getElementById(
            "fm-home"
        ).onclick = function () {
            navigate("/home/dead");
        };

        document.getElementById(
            "fm-go"
        ).onclick = function () {
            navigate(
                document.getElementById(
                    "fm-path"
                ).value
            );
        };

        document.getElementById(
            "fm-refresh"
        ).onclick = render;

        document.getElementById(
            "fm-new-folder"
        ).onclick = createFolder;

        document.getElementById(
            "fm-new-file"
        ).onclick = createFile;

        render();
    }

    function navigate(path) {
        path =
            LowOSFileSystem.normalizePath(path);

        var node =
            LowOSFileSystem.findNode(path);

        if (
            !node ||
            node.type !== "directory"
        ) {
            alert("Directory not found.");
            return;
        }

        currentPath = path;

        render();
    }

    function render() {
        var content =
            document.getElementById(
                "fm-content"
            );

        var path =
            document.getElementById(
                "fm-path"
            );

        if (!content || !path) {
            return;
        }

        path.value = currentPath;

        var items =
            LowOSFileSystem.listDirectory(
                currentPath
            );

        content.innerHTML = "";

        if (items.length === 0) {
            content.innerHTML =
                '<div class="lowos-empty-folder">Directory is empty.</div>';

            return;
        }

        items.forEach(function (item) {
            var element =
                document.createElement("div");

            element.className =
                "lowos-file-item";

            element.innerHTML =
                '<div class="lowos-file-icon">' +
                icon(item) +
                "</div>" +
                '<div class="lowos-file-name">' +
                escapeHtml(item.name) +
                "</div>";

            element.ondblclick =
                function () {
                    var path =
                        currentPath +
                        "/" +
                        item.name;

                    if (
                        item.type ===
                        "directory"
                    ) {
                        navigate(path);
                    } else {
                        openFile(path);
                    }
                };

            element.oncontextmenu =
                function (event) {
                    event.preventDefault();

                    contextMenu(
                        event.clientX,
                        event.clientY,
                        item
                    );
                };

            content.appendChild(element);
        });
    }

    function escapeHtml(value) {
        var div =
            document.createElement("div");

        div.textContent = value;

        return div.innerHTML;
    }

    function openFile(path) {
        var file =
            LowOSFileSystem.findNode(path);

        if (!file) {
            return;
        }

        if (
            file.name.endsWith(".txt")
        ) {
            LowOSTextEditor.open(path);
            return;
        }

        alert(
            "No application is registered for this file."
        );
    }

    function createFolder() {
        var name =
            prompt("Folder name:");

        if (!name) {
            return;
        }

        try {
            LowOSFileSystem.createDirectory(
                currentPath + "/" + name
            );

            render();
        } catch (error) {
            alert(error.message);
        }
    }

    function createFile() {
        var name =
            prompt(
                "File name:",
                "newfile.txt"
            );

        if (!name) {
            return;
        }

        try {
            LowOSFileSystem.createFile(
                currentPath + "/" + name,
                ""
            );

            render();
        } catch (error) {
            alert(error.message);
        }
    }

    function contextMenu(x, y, item) {
        var old =
            document.getElementById(
                "lowos-context-menu"
            );

        if (old) {
            old.remove();
        }

        var menu =
            document.createElement("div");

        menu.id =
            "lowos-context-menu";

        menu.style.left = x + "px";
        menu.style.top = y + "px";

        menu.innerHTML = `
            <button id="ctx-open">Open</button>
            <button id="ctx-rename">Rename</button>
            <button id="ctx-delete">Delete</button>
        `;

        document.body.appendChild(menu);

        document.getElementById(
            "ctx-open"
        ).onclick = function () {
            var path =
                currentPath +
                "/" +
                item.name;

            if (
                item.type ===
                "directory"
            ) {
                navigate(path);
            } else {
                openFile(path);
            }

            menu.remove();
        };

        document.getElementById(
            "ctx-rename"
        ).onclick = function () {
            var name =
                prompt(
                    "New name:",
                    item.name
                );

            if (!name) {
                return;
            }

            try {
                LowOSFileSystem.renamePath(
                    currentPath +
                    "/" +
                    item.name,
                    name
                );

                render();
            } catch (error) {
                alert(error.message);
            }

            menu.remove();
        };

        document.getElementById(
            "ctx-delete"
        ).onclick = function () {
            if (
                !confirm(
                    "Delete " +
                    item.name +
                    "?"
                )
            ) {
                return;
            }

            try {
                LowOSFileSystem.deletePath(
                    currentPath +
                    "/" +
                    item.name
                );

                render();
            } catch (error) {
                alert(error.message);
            }

            menu.remove();
        };
    }

    function makeDraggable(element) {
        var title =
            element.querySelector(
                ".lowos-titlebar"
            );

        var active = false;
        var x = 0;
        var y = 0;

        title.addEventListener(
            "pointerdown",
            function (event) {
                if (
                    event.target.classList.contains(
                        "lowos-close-button"
                    )
                ) {
                    return;
                }

                active = true;

                var rect =
                    element.getBoundingClientRect();

                x =
                    event.clientX -
                    rect.left;

                y =
                    event.clientY -
                    rect.top;

                element.style.transform =
                    "none";

                title.setPointerCapture(
                    event.pointerId
                );
            }
        );

        title.addEventListener(
            "pointermove",
            function (event) {
                if (!active) {
                    return;
                }

                element.style.left =
                    event.clientX -
                    x +
                    "px";

                element.style.top =
                    event.clientY -
                    y +
                    "px";
            }
        );

        title.addEventListener(
            "pointerup",
            function () {
                active = false;
            }
        );
    }

    window.LowOSFileManager = {
        open: open
    };
})();
