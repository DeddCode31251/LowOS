(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const HOME_URL = "https://example.com";

    const BrowserApp = {

        history: [],

        position: -1,

        loaded: false,

        open() {
            openWin("browser");

            /* The iframe stays blank until the browser is first opened,
               so startup never waits on the network. */
            if (!this.loaded) {
                this.loaded = true;
                this.go();
            }

            const input = $("browserAddress");

            if (input) {
                setTimeout(() => input.select(), 50);
            }
        },

        normalize(url) {
            url = String(url).trim();

            if (!url) return HOME_URL;

            if (url === "about:blank") return url;

            if (/^https?:\/\//i.test(url)) return url;

            if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(url)) {
                return "http://" + url;
            }

            if (url.includes(".") && !/\s/.test(url)) {
                return "https://" + url;
            }

            return (
                "https://www.google.com/search?igu=1&q=" +
                encodeURIComponent(url)
            );
        },

        go(addHistory = true) {
            const input = $("browserAddress");
            const frame = $("browserFrame");

            if (!input || !frame) return;

            const url = this.normalize(input.value);

            input.value = url;
            frame.src = url;

            if (addHistory && this.history[this.position] !== url) {
                this.history = this.history.slice(0, this.position + 1);
                this.history.push(url);
                this.position = this.history.length - 1;
            }

            this.updateButtons();
        },

        back() {
            if (this.position <= 0) return;

            this.position--;
            this.loadHistoryURL(this.history[this.position]);
        },

        forward() {
            if (this.position >= this.history.length - 1) return;

            this.position++;
            this.loadHistoryURL(this.history[this.position]);
        },

        loadHistoryURL(url) {
            $("browserAddress").value = url;
            $("browserFrame").src = url;

            this.updateButtons();
        },

        reload() {
            const frame = $("browserFrame");

            if (!frame || !this.loaded) return;

            /* frame.src = frame.src fails to reload if the page navigated
               itself, so reassign from our own record. */
            const url = this.history[this.position];

            if (url) {
                frame.src = "about:blank";
                setTimeout(() => { frame.src = url; }, 30);
            }
        },

        external() {
            const input = $("browserAddress");

            window.open(
                this.normalize(input.value),
                "_blank",
                "noopener"
            );
        },

        updateButtons() {
            const back = $("browserBack");
            const forward = $("browserForward");

            if (back) back.disabled = this.position <= 0;

            if (forward) {
                forward.disabled =
                    this.position >= this.history.length - 1;
            }
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        const on = (id, event, handler) => {
            const element = $(id);

            if (element) element.addEventListener(event, handler);
        };

        on("browserGo", "click", () => BrowserApp.go());
        on("browserBack", "click", () => BrowserApp.back());
        on("browserForward", "click", () => BrowserApp.forward());
        on("browserReload", "click", () => BrowserApp.reload());
        on("browserExternal", "click", () => BrowserApp.external());

        on("browserAddress", "keydown", (event) => {
            if (event.key === "Enter") BrowserApp.go();
        });

        BrowserApp.updateButtons();
    });

    window.BrowserApp = BrowserApp;

})();
