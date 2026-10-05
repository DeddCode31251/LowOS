var topZ = 10;

function raise(w) {
    topZ++;
    w.style.zIndex = topZ;
}

function openWin(id) {
    var w = document.getElementById(id);

    if (!w) {
        return;
    }

    w.style.display = "flex";
    raise(w);
}

function closeWin(w) {
    w.style.display = "none";
}

function drag(w) {
    var h = w.querySelector(".wh");
    var x = 0;
    var y = 0;
    var active = false;

    h.addEventListener("pointerdown", function (e) {
        if (
            e.target.matches("[data-close]") ||
            innerWidth <= 640
        ) {
            return;
        }

        active = true;
        x = e.clientX;
        y = e.clientY;

        h.setPointerCapture(e.pointerId);
        h.style.cursor = "grabbing";
    });

    h.addEventListener("pointermove", function (e) {
        if (!active) {
            return;
        }

        var nx = Math.max(
            0,
            Math.min(
                innerWidth - 80,
                w.offsetLeft + e.clientX - x
            )
        );

        var ny = Math.max(
            40,
            Math.min(
                innerHeight - 40,
                w.offsetTop + e.clientY - y
            )
        );

        w.style.left = nx + "px";
        w.style.top = ny + "px";

        x = e.clientX;
        y = e.clientY;
    });

    h.addEventListener("pointerup", function () {
        active = false;
        h.style.cursor = "";
    });

    h.addEventListener("pointercancel", function () {
        active = false;
        h.style.cursor = "";
    });
}

document.querySelectorAll(".win").forEach(function (w) {
    drag(w);

    w.addEventListener("pointerdown", function () {
        raise(w);
    });

    var close = w.querySelector("[data-close]");

    if (close) {
        close.addEventListener("click", function () {
            closeWin(w);
        });
    }
});

document.querySelectorAll("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () {
        openWin(b.dataset.open);
    });
});

document.getElementById("menu").addEventListener(
    "click",
    function () {
        openWin("welcome");
    }
);

function tick() {
    document.getElementById("clock").textContent =
        new Date().toLocaleString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
}

tick();
setInterval(tick, 1000);

var R = {
    AX: 0,
    BX: 0,
    CX: 0,
    DX: 0
};

var PC = 0;
var ZF = 0;

function showRegs() {
    document.getElementById("regs").textContent =
        "AX=" + R.AX +
        " BX=" + R.BX +
        " CX=" + R.CX +
        " DX=" + R.DX +
        " PC=" + PC +
        " ZF=" + ZF;
}

function val(t) {
    t = t.trim().toUpperCase();

    if (t in R) {
        return R[t];
    }

    return parseInt(t, 10) || 0;
}

function runAsm(src) {
    R = {
        AX: 0,
        BX: 0,
        CX: 0,
        DX: 0
    };

    ZF = 0;

    var out = [];
    var labels = {};
    var prog = [];

    src.split("\n").forEach(function (line) {
        line = line.split(";")[0].trim();

        if (!line) {
            return;
        }

        if (line.slice(-1) === ":") {
            labels[
                line.slice(0, -1).toLowerCase()
            ] = prog.length;
        } else {
            prog.push(line);
        }
    });

    var steps = 0;

    for (PC = 0; PC < prog.length; PC++) {
        if (++steps > 5000) {
            out.push(
                "error: stopped after 5000 steps"
            );
            break;
        }

        var p = prog[PC].split(/[\s,]+/);
        var op = p[0].toUpperCase();
        var a = (p[1] || "").toUpperCase();
        var b = p[2];

        if (op === "MOV") {
            R[a] = val(b);
        } else if (op === "ADD") {
            R[a] += val(b);
            ZF = +(R[a] === 0);
        } else if (op === "SUB") {
            R[a] -= val(b);
            ZF = +(R[a] === 0);
        } else if (op === "MUL") {
            R[a] *= val(b);
            ZF = +(R[a] === 0);
        } else if (op === "INC") {
            R[a]++;
            ZF = +(R[a] === 0);
        } else if (op === "DEC") {
            R[a]--;
            ZF = +(R[a] === 0);
        } else if (op === "CMP") {
            ZF = +(val(a) === val(b));
        } else if (op === "JNZ") {
            if (!ZF) {
                var target =
                    labels[
                        (p[1] || "").toLowerCase()
                    ];

                if (target === undefined) {
                    out.push(
                        "error: unknown label '" +
                        p[1] +
                        "'"
                    );
                    break;
                }

                PC = target - 1;
            }
        } else if (op === "OUT") {
            out.push(
                "OUT " +
                a +
                " = " +
                val(a)
            );
        } else if (op === "HLT") {
            break;
        } else {
            out.push(
                "error line " +
                (PC + 1) +
                ": unknown op '" +
                op +
                "'"
            );
            break;
        }
    }

    showRegs();

    return out.join("\n");
}

document.getElementById("run").addEventListener(
    "click",
    function () {
        var result = runAsm(
            document.getElementById("src").value
        );

        document.getElementById("cpuOut").textContent =
            result || "(no output)";
    }
);

document.getElementById("reset").addEventListener(
    "click",
    function () {
        R = {
            AX: 0,
            BX: 0,
            CX: 0,
            DX: 0
        };

        PC = 0;
        ZF = 0;

        showRegs();

        document.getElementById(
            "cpuOut"
        ).textContent = "";
    }
);

var out = document.getElementById("termOut");
var inp = document.getElementById("termIn");

function say(text) {
    var div = document.createElement("div");

    div.textContent = text;

    out.appendChild(div);

    out.scrollTop = out.scrollHeight;
}

function terminalPath(path) {
    return LowOSFileSystem.normalizePath(path);
}

var currentDirectory = "/home/dead";

var cmds = {
    help: function () {
        return [
            "help",
            "whoami",
            "pwd",
            "ls",
            "cd <directory>",
            "mkdir <directory>",
            "touch <file>",
            "cat <file>",
            "rm <file>",
            "write <file> <text>",
            "date",
            "echo <text>",
            "calculator",
            "browser",
            "files",
            "editor",
            "clear",
            "reboot"
        ].join("\n");
    },

    whoami: function () {
        return "dead";
    },

    pwd: function () {
        return currentDirectory;
    },

    ls: function () {
        var items =
            LowOSFileSystem.listDirectory(
                currentDirectory
            );

        return items
            .map(function (item) {
                return item.type === "directory"
                    ? item.name + "/"
                    : item.name;
            })
            .join("  ");
    },

    cd: function (arg) {
        if (!arg) {
            return "usage: cd <directory>";
        }

        var path;

        if (arg.startsWith("/")) {
            path = arg;
        } else {
            path =
                currentDirectory +
                "/" +
                arg;
        }

        path =
            LowOSFileSystem.normalizePath(path);

        var node =
            LowOSFileSystem.findNode(path);

        if (!node || node.type !== "directory") {
            return "cd: directory not found";
        }

        currentDirectory = path;

        return "";
    },

    mkdir: function (arg) {
        if (!arg) {
            return "usage: mkdir <directory>";
        }

        var path =
            terminalPath(
                currentDirectory + "/" + arg
            );

        try {
            LowOSFileSystem.createDirectory(path);
            return "";
        } catch (error) {
            return "mkdir: " + error.message;
        }
    },

    touch: function (arg) {
        if (!arg) {
            return "usage: touch <file>";
        }

        var path =
            terminalPath(
                currentDirectory + "/" + arg
            );

        try {
            LowOSFileSystem.createFile(path, "");
            return "";
        } catch (error) {
            return "touch: " + error.message;
        }
    },

    cat: function (arg) {
        if (!arg) {
            return "usage: cat <file>";
        }

        var path =
            terminalPath(
                currentDirectory + "/" + arg
            );

        try {
            return LowOSFileSystem.readFile(path);
        } catch (error) {
            return "cat: " + error.message;
        }
    },

    rm: function (arg) {
        if (!arg) {
            return "usage: rm <file>";
        }

        var path =
            terminalPath(
                currentDirectory + "/" + arg
            );

        try {
            LowOSFileSystem.deletePath(path);
            return "";
        } catch (error) {
            return "rm: " + error.message;
        }
    },

    write: function (args) {
        var parts = args.split(" ");

        var file = parts.shift();

        if (!file || parts.length === 0) {
            return "usage: write <file> <text>";
        }

        var path =
            terminalPath(
                currentDirectory + "/" + file
            );

        try {
            LowOSFileSystem.writeFile(
                path,
                parts.join(" ")
            );

            return "";
        } catch (error) {
            return "write: " + error.message;
        }
    },

    date: function () {
        return new Date().toString();
    },

    echo: function (args) {
        return args;
    },

    calculator: function () {
        openCalculator();
        return "calculator opened";
    },

    browser: function () {
        openBrowser();
        return "browser opened";
    },

    files: function () {
        openFileManager();
        return "file manager opened";
    },

    editor: function () {
        openTextEditor();
        return "text editor opened";
    },

    clear: function () {
        out.innerHTML = "";
        return "";
    },

    reboot: function () {
        location.reload();
        return "rebooting...";
    }
};

say("LowOS shell v1.0");
say("Type 'help' for available commands.");

inp.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") {
        return;
    }

    var line = inp.value.trim();

    inp.value = "";

    if (!line) {
        return;
    }

    say(
        "user@2bytes:" +
        currentDirectory +
        "$ " +
        line
    );

    var parts = line.split(" ");
    var command = parts.shift().toLowerCase();
    var args = parts.join(" ");

    var fn = cmds[command];

    var result = fn
        ? fn(args)
        : "command not found: " + command;

    if (result) {
        say(result);
    }
});

var lines = [
    "LowOS BIOS v1.0",
    "memory test ........ 640K OK",
    "cpu: 4 registers ... OK",
    "filesystem .......... OK",
    "loading applications . OK",
    "loading desktop",
    "",
    "Welcome to LowOS."
];

var bootIndex = 0;
var pct = 0;

var bt = document.getElementById("bootText");
var boot = document.getElementById("boot");
var fill = document.getElementById("fill");
var pctEl = document.getElementById("pct");

function endBoot() {
    clearInterval(bootTimer);

    boot.style.display = "none";

    openWin("welcome");

    showRegs();
}

var bootTimer = setInterval(function () {
    pct = Math.min(100, pct + 3);

    fill.style.width = pct + "%";
    pctEl.textContent = pct + "%";

    if (
        pct % 15 === 0 &&
        bootIndex < lines.length
    ) {
        bt.textContent +=
            lines[bootIndex++] + "\n";
    }

    if (pct >= 100) {
        clearInterval(bootTimer);

        setTimeout(endBoot, 400);
    }
}, 80);

boot.addEventListener("click", endBoot);

function openCalculator() {
    if (
        window.LowOSCalculator &&
        typeof window.LowOSCalculator.open === "function"
    ) {
        window.LowOSCalculator.open();
    }
}

function openBrowser() {
    if (
        window.LowOSBrowser &&
        typeof window.LowOSBrowser.open === "function"
    ) {
        window.LowOSBrowser.open();
    }
}

function openFileManager() {
    if (
        window.LowOSFileManager &&
        typeof window.LowOSFileManager.open === "function"
    ) {
        window.LowOSFileManager.open();
    }
}

function openTextEditor() {
    var path =
        "/home/dead/Documents/example.txt";

    if (
        !LowOSFileSystem.exists(path)
    ) {
        LowOSFileSystem.createFile(
            path,
            "Welcome to LowOS.\n"
        );
    }

    LowOSTextEditor.open(path);
}
