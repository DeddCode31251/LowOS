(function () {
    "use strict";

    /* Recursive-descent parser: no eval / Function, so nothing can be injected.
       expr   = term (("+" | "-") term)*
       term   = unary (("*" | "/") unary)*
       unary  = ("-" | "+") unary | primary
       primary= number | "(" expr ")"                                        */

    function tokenize(text) {
        const source = text.replace(/\s+/g, "");
        const tokens = [];

        let i = 0;

        while (i < source.length) {
            const number = source.slice(i).match(/^(\d+\.?\d*|\.\d+)/);

            if (number) {
                tokens.push(parseFloat(number[0]));
                i += number[0].length;
                continue;
            }

            if ("+-*/()".includes(source[i])) {
                tokens.push(source[i]);
                i++;
                continue;
            }

            throw new Error("Invalid character");
        }

        return tokens;
    }

    function evaluate(text) {
        const tokens = tokenize(text);

        let position = 0;

        const peek = () => tokens[position];
        const take = () => tokens[position++];

        function expression() {
            let value = term();

            while (peek() === "+" || peek() === "-") {
                const op = take();
                const right = term();

                value = op === "+" ? value + right : value - right;
            }

            return value;
        }

        function term() {
            let value = unary();

            while (peek() === "*" || peek() === "/") {
                const op = take();
                const right = unary();

                if (op === "/" && right === 0) {
                    throw new Error("Division by zero");
                }

                value = op === "*" ? value * right : value / right;
            }

            return value;
        }

        function unary() {
            if (peek() === "-") {
                take();
                return -unary();
            }

            if (peek() === "+") {
                take();
                return unary();
            }

            return primary();
        }

        function primary() {
            const token = take();

            if (typeof token === "number") return token;

            if (token === "(") {
                const value = expression();

                if (take() !== ")") {
                    throw new Error("Missing )");
                }

                return value;
            }

            throw new Error("Unexpected token");
        }

        if (!tokens.length) return 0;

        const result = expression();

        if (position !== tokens.length) {
            throw new Error("Unexpected token");
        }

        if (!Number.isFinite(result)) {
            throw new Error("Invalid result");
        }

        /* hides float noise: 0.1 + 0.2 -> 0.3 */
        return parseFloat(result.toPrecision(12));
    }

    const Calculator = {

        expression: "",

        justEvaluated: false,

        evaluate,

        open() {
            openWin("calculator");

            this.expression = "";
            this.justEvaluated = false;

            this.update();
        },

        update() {
            const display = document.getElementById("calcDisplay");

            if (!display) return;

            display.value = this.expression || "0";
        },

        press(value) {
            if (this.expression === "Error") {
                this.expression = "";
            }

            if (value === "C") {
                this.expression = "";
                this.justEvaluated = false;
                this.update();
                return;
            }

            if (value === "BACK") {
                this.expression = this.expression.slice(0, -1);
                this.justEvaluated = false;
                this.update();
                return;
            }

            if (value === "=") {
                if (!this.expression) return;

                try {
                    this.expression = String(evaluate(this.expression));
                    this.justEvaluated = true;
                } catch (error) {
                    this.expression = "Error";
                    this.justEvaluated = false;
                }

                this.update();
                return;
            }

            /* After "=", typing a digit starts fresh; an operator continues. */
            if (this.justEvaluated && /[\d.(]/.test(value)) {
                this.expression = "";
            }

            this.justEvaluated = false;

            this.expression += value;

            this.update();
        },

        handleKey(event) {
            const win = document.getElementById("calculator");

            if (!win || !win.classList.contains("open")) return;

            const target = event.target;

            /* Don't hijack typing in other windows' inputs. */
            if (
                target.matches &&
                target.matches("input, textarea") &&
                target.id !== "calcDisplay"
            ) {
                return;
            }

            if (event.ctrlKey || event.metaKey || event.altKey) return;

            if (/^[0-9+\-*/().]$/.test(event.key)) {
                event.preventDefault();
                this.press(event.key);
            } else if (event.key === "Enter" || event.key === "=") {
                event.preventDefault();
                this.press("=");
            } else if (event.key === "Backspace") {
                event.preventDefault();
                this.press("BACK");
            } else if (event.key === "Escape" || event.key === "Delete") {
                this.press("C");
            }
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-calc]").forEach((button) => {
            button.addEventListener("click", () =>
                Calculator.press(button.dataset.calc)
            );
        });

        const win = document.getElementById("calculator");

        if (win) {
            win.addEventListener("keydown", (event) =>
                Calculator.handleKey(event)
            );
        }
    });

    window.Calculator = Calculator;

})();
