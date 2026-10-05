(function () {
    "use strict";

    var currentFile = null;

    function open(path) {
        currentFile = path;

        var existing =
            document.getElementById(
                "lowos-text-editor"
            );

        if (existing) {
            existing.remove();
        }

        var content =
            LowOSFileSystem.readFile(path);

        var win =
            document.createElement("div");

        win.id = "lowos-text-editor";
        win.className = "lowos-app-window";

        win.style.width = "700px";
        win.style.height = "500px";
        win.style.left = "50%";
        win.style.top = "50%";
        win.style.transform =
            "translate(-50%, -50%)";

        win.innerHTML = `
            <div class="lowos-titlebar">
                <span>Text Editor</span>

                <button class="lowos-close-button">
                    x
                </button>
            </div>

            <div class="lowos-editor-toolbar">
                <span>${path}</span>

                <button id="editor-save">
                    Save
                </button>
            </div>

            <textarea
                id="editor-textarea"
                spellcheck="false"
            ></textarea>
        `;

        document.body.appendChild(win);

        var textarea =
            win.querySelector(
                "#editor-textarea"
            );

        textarea.value = content;

        win.querySelector(
            ".lowos-close-button"
        ).onclick = function () {
            win.remove();
        };

        win.querySelector(
            "#editor-save"
        ).onclick = function () {
            try {
                LowOSFileSystem.writeFile(
                    currentFile,
                    textarea.value
                );

                alert("Saved.");
            } catch (error) {
                alert(error.message);
            }
        };

        makeDraggable(win);
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

    window.LowOSTextEditor = {
        open: open
    };
})();
