(function () {
    "use strict";

    var history = [];
    var historyIndex = -1;

    function open() {
        var existing =
            document.getElementById(
                "lowos-browser"
            );

        if (existing) {
            return;
        }

        var win =
            document.createElement("div");

        win.id = "lowos-browser";
        win.className =
            "lowos-app-window browser-window";

        win.style.left = "50%";
        win.style.top = "50%";
        win.style.transform =
            "translate(-50%, -50%)";

        win.innerHTML = `
            <div class="lowos-titlebar">
                <span>Web Browser</span>

                <button class="lowos-close-button">
                    x
                </button>
            </div>

            <div class="browser-toolbar">

                <button id="browser-back">
                    Back
                </button>

                <button id="browser-forward">
                    Forward
                </button>

                <button id="browser-reload">
                    Reload
                </button>

                <input
                    id="browser-address"
                    placeholder="Enter URL or search"
                >

                <button id="browser-go">
                    Go
                </button>

            </div>

            <div class="browser-frame-container">

                <div
                    id="browser-home"
                    class="browser-home"
                >
                    <h1>2BytesOS Browser</h1>
                    <p>
                        Enter a URL or search query.
                    </p>
                </div>

                <iframe
                    id="browser-frame"
                    style="display:none"
                    sandbox="
                        allow-forms
                        allow-modals
                        allow-popups
                        allow-presentation
                        allow-same-origin
                        allow-scripts
                    "
                ></iframe>

            </div>
        `;

        document.body.appendChild(win);

        win.querySelector(
            ".lowos-close-button"
        ).onclick = function () {
            win.remove();
        };

        var address =
            win.querySelector(
                "#browser-address"
            );

        win.querySelector(
            "#browser-go"
        ).onclick = function () {
            navigate(address.value);
        };

        address.addEventListener(
            "keydown",
            function (event) {
                if (event.key === "Enter") {
                    navigate(address.value);
                }
            }
        );

        win.querySelector(
            "#browser-back"
        ).onclick = back;

        win.querySelector(
            "#browser-forward"
        ).onclick = forward;

        win.querySelector(
            "#browser-reload"
        ).onclick = reload;

        makeDraggable(win);
    }

    function makeUrl(input) {
        input = input.trim();

        if (!input) {
            return null;
        }

        if (
            input.startsWith("http://") ||
            input.startsWith("https://")
        ) {
            return input;
        }

        if (
            input.includes(".") &&
            !input.includes(" ")
        ) {
            return "https://" + input;
        }

        return (
            "https://www.google.com/search?q=" +
            encodeURIComponent(input)
        );
    }

    function navigate(input, saveHistory) {
        var url = makeUrl(input);

        if (!url) {
            return;
        }

        var win =
            document.getElementById(
                "lowos-browser"
            );

        if (!win) {
            return;
        }

        var frame =
            win.querySelector(
                "#browser-frame"
            );

        var home =
            win.querySelector(
                "#browser-home"
            );

        var address =
            win.querySelector(
                "#browser-address"
            );

        address.value = url;

        home.style.display = "none";
        frame.style.display = "block";

        frame.src = url;

        if (saveHistory !== false) {
            history =
                history.slice(
                    0,
                    historyIndex + 1
                );

            history.push(url);

            historyIndex =
                history.length - 1;
        }
    }

    function back() {
        if (historyIndex <= 0) {
            return;
        }

        historyIndex--;

        navigate(
            history[historyIndex],
            false
        );
    }

    function forward() {
        if (
            historyIndex >=
            history.length - 1
        ) {
            return;
        }

        historyIndex++;

        navigate(
            history[historyIndex],
            false
        );
    }

    function reload() {
        var frame =
            document.getElementById(
                "browser-frame"
            );

        if (frame) {
            frame.src = frame.src;
        }
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

    window.LowOSBrowser = {
        open: open
    };
})();
