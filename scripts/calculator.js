(function () {
    "use strict";

    var expression = "";

    function open() {
        var existing =
            document.getElementById(
                "lowos-calculator"
            );

        if (existing) {
            return;
        }

        var win =
            document.createElement("div");

        win.id = "lowos-calculator";
        win.className =
            "lowos-app-window calculator-window";

        win.style.left = "50%";
        win.style.top = "50%";
        win.style.transform =
            "translate(-50%, -50%)";

        win.innerHTML = `
            <div class="lowos-titlebar">
                <span>Calculator</span>

                <button class="lowos-close-button">
                    x
                </button>
            </div>

            <div class="calculator-display">
                0
            </div>

            <div class="calculator-buttons">

                <button data-action="clear">
                    C
                </button>

                <button data-value="(">
                    (
                </button>

                <button data-value=")">
                    )
                </button>

                <button data-value="/">
                    /
                </button>

                <button data-value="7">7</button>
                <button data-value="8">8</button>
                <button data-value="9">9</button>
                <button data-value="*">*</button>

                <button data-value="4">4</button>
                <button data-value="5">5</button>
                <button data-value="6">6</button>
                <button data-value="-">-</button>

                <button data-value="1">1</button>
                <button data-value="2">2</button>
                <button data-value="3">3</button>
                <button data-value="+">+</button>

                <button data-value="0">0</button>
                <button data-value=".">.</button>

                <button data-action="backspace">
                    DEL
                </button>

                <button data-action="equals">
                    =
                </button>

            </div>
        `;

        document.body.appendChild(win);

        var display =
            win.querySelector(
                ".calculator-display"
            );

        win.querySelector(
            ".lowos-close-button"
        ).onclick = function () {
            win.remove();
        };

        win.querySelectorAll(
            "[data-value]"
        ).forEach(function (button) {
            button.onclick = function () {
                expression +=
                    button.dataset.value;

                display.textContent =
                    expression;
            };
        });

        win.querySelector(
            '[data-action="clear"]'
        ).onclick = function () {
            expression = "";
            display.textContent = "0";
        };

        win.querySelector(
            '[data-action="backspace"]'
        ).onclick = function () {
            expression =
                expression.slice(0, -1);

            display.textContent =
                expression || "0";
        };

        win.querySelector(
            '[data-action="equals"]'
        ).onclick = function () {
            calculate(display);
        };

        makeDraggable(win);
    }

    function calculate(display) {
        if (!expression) {
            return;
        }

        try {
            if (
                !/^[0-9+\-*/().\s]+$/.test(
                    expression
                )
            ) {
                throw new Error();
            }

            var result =
                Function(
                    '"use strict"; return (' +
                    expression +
                    ")"
                )();

            if (
                typeof result !== "number" ||
                !Number.isFinite(result)
            ) {
                throw new Error();
            }

            expression = String(result);

            display.textContent =
                expression;
        } catch (error) {
            expression = "";
            display.textContent = "Error";
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

    window.LowOSCalculator = {
        open: open
    };
})();
