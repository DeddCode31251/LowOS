(function () {
    "use strict";

    const START_TIME = Date.now();

    /* script.js fills these in with real UI actions. */
    const ui = {
        openApp() {},
        openFile() {},
        clear() {},
        reboot() {},
        exportData() {},
        importData() {},
        loadLab() {},
        updateRegs() {},
        refresh() {}
    };

    /* ---------- parsing ---------- */

    function tokenize(line) {
        const tokens = [];

        let current = "";
        let quote = null;
        let started = false;
        let quoted = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (quote) {
                if (char === quote) {
                    quote = null;
                } else if (
                    char === "\\" &&
                    quote === "\"" &&
                    (line[i + 1] === "\"" || line[i + 1] === "\\")
                ) {
                    current += line[++i];
                } else {
                    current += char;
                }

                continue;
            }

            if (char === "\"" || char === "'") {
                quote = char;
                started = true;
                quoted = true;
                continue;
            }

            if (/\s/.test(char)) {
                if (started) {
                    tokens.push({ value: current, quoted });
                    current = "";
                    started = false;
                    quoted = false;
                }

                continue;
            }

            current += char;
            started = true;
        }

        if (quote) throw new Error("unterminated quote");

        if (started) tokens.push({ value: current, quoted });

        return tokens;
    }

    function parseFlags(args) {
        const flags = new Set();
        const positional = [];

        args.forEach((arg) => {
            if (/^-[a-zA-Z]+$/.test(arg)) {
                arg.slice(1).split("").forEach((f) => flags.add(f));
            } else {
                positional.push(arg);
            }
        });

        return { flags, pos: positional };
    }

    function unescapeText(text) {
        return text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function fmtDate(timestamp) {
        return new Date(timestamp)
            .toISOString()
            .slice(0, 16)
            .replace("T", " ");
    }

    function fmtDuration(ms) {
        const total = Math.floor(ms / 1000);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;

        return (h ? h + "h " : "") + (h || m ? m + "m " : "") + s + "s";
    }

    function requireArgs(args, count, usage) {
        if (args.length < count) {
            throw new Error("usage: " + usage);
        }
    }

    function fileAt(path) {
        const node = FS.find(path);

        if (!node) throw new Error(path + ": no such file");
        if (node.type !== "file") throw new Error(path + ": is a directory");

        return node;
    }

    function dirAt(path) {
        const node = FS.find(path);

        if (!node) throw new Error(path + ": no such directory");
        if (node.type !== "directory") throw new Error(path + ": not a directory");

        return node;
    }

    function countOption(args, fallback) {
        const copy = args.slice();
        const index = copy.indexOf("-n");

        let count = fallback;

        if (index !== -1) {
            count = parseInt(copy[index + 1], 10);

            if (!Number.isInteger(count) || count < 0) {
                throw new Error("invalid line count");
            }

            copy.splice(index, 2);
        }

        return { count, rest: copy };
    }

    let previousDir = null;

    /* ---------- commands ---------- */

    const COMMANDS = {};

    function define(name, usage, description, run, mutates) {
        COMMANDS[name] = { usage, description, run, mutates: !!mutates };
    }

    define("help", "help", "Show this list", () => {
        const lines = ["LowOS commands:", ""];

        Object.entries(COMMANDS).forEach(([name, cmd]) => {
            lines.push("  " + cmd.usage.padEnd(30) + cmd.description);
        });

        lines.push("");
        lines.push("Tips: Tab completes, Up/Down browse history,");
        lines.push("      echo hi > file.txt writes output to a file (>> appends).");

        return lines;
    });

    define("pwd", "pwd", "Print working directory", () => FS.currentPath);

    define("ls", "ls [-l] [path]", "List directory", (args) => {
        const { flags, pos } = parseFlags(args);

        const path = pos[0] || FS.currentPath;
        const node = FS.find(path);

        if (!node) throw new Error(path + ": no such file or directory");

        const long = (n) =>
            (n.type === "directory" ? "d" : "-") + " " +
            String(FS.size(n)).padStart(7) + "  " +
            fmtDate(n.modifiedAt) + "  " +
            n.name + (n.type === "directory" ? "/" : "");

        if (node.type === "file") {
            return flags.has("l") ? long(node) : node.name;
        }

        const items = FS.sorted(node.children);

        if (!items.length) return "(empty)";

        if (flags.has("l")) return items.map(long);

        return items
            .map((n) => n.name + (n.type === "directory" ? "/" : ""))
            .join("  ");
    });

    define("cd", "cd [path | -]", "Change directory", (args) => {
        let target = args[0] || FS.HOME;

        if (target === "-") {
            if (!previousDir) throw new Error("no previous directory");
            target = previousDir;
        }

        dirAt(target);

        previousDir = FS.currentPath;
        FS.currentPath = FS.normalize(target);
    });

    define("tree", "tree [path]", "Show directory tree", (args) => {
        return FS.tree(args[0] || FS.currentPath);
    });

    define("touch", "touch <file...>", "Create file / update time", (args) => {
        requireArgs(args, 1, "touch <file...>");

        args.forEach((arg) => FS.touch(FS.resolve(arg)));
    }, true);

    define("mkdir", "mkdir [-p] <folder...>", "Create directory", (args) => {
        const { flags, pos } = parseFlags(args);

        requireArgs(pos, 1, "mkdir [-p] <folder...>");

        pos.forEach((arg) => {
            const path = FS.resolve(arg);

            if (flags.has("p")) {
                FS.mkdirp(path);
            } else {
                FS.create(path, "directory");
            }
        });
    }, true);

    define("cat", "cat <file...>", "Print file contents", (args) => {
        requireArgs(args, 1, "cat <file...>");

        return args.map((arg) => fileAt(FS.resolve(arg)).content).join("\n");
    });

    define("write", "write <file> <text>", "Overwrite a file (\\n = newline)", (args) => {
        requireArgs(args, 2, "write <file> <text>");

        const path = FS.resolve(args[0]);

        if (!FS.exists(path)) FS.create(path, "file", "");

        FS.write(path, unescapeText(args.slice(1).join(" ")));

        return "Wrote " + path;
    }, true);

    define("append", "append <file> <text>", "Append a line to a file", (args) => {
        requireArgs(args, 2, "append <file> <text>");

        const path = FS.resolve(args[0]);
        const file = fileAt(path);

        const existing = file.content;
        const separator = existing && !existing.endsWith("\n") ? "\n" : "";

        FS.write(
            path,
            existing + separator + unescapeText(args.slice(1).join(" "))
        );

        return "Updated " + path;
    }, true);

    define("rm", "rm <path...>", "Move to Trash", (args) => {
        const { pos } = parseFlags(args);

        requireArgs(pos, 1, "rm <path...>");

        pos.forEach((arg) => FS.remove(FS.resolve(arg)));

        return `Moved ${pos.length} item(s) to Trash.`;
    }, true);

    define("restore", "restore <trash-id-or-name>", "Restore from Trash", (args) => {
        requireArgs(args, 1, "restore <trash-id-or-name>");

        const node = FS.restore(args[0]);

        return "Restored " + node.name;
    }, true);

    define("empty", "empty", "Empty the Trash", () => {
        const count = FS.getTrash().length;

        FS.clearTrash();

        return `Trash emptied (${count} item(s) deleted).`;
    }, true);

    define("trash", "trash [list | empty]", "Open Trash / list / empty", (args) => {
        if (args[0] === "list") {
            const items = FS.getTrash();

            if (!items.length) return "Trash is empty.";

            return items.map(
                (item) =>
                    item.id.slice(0, 8) + "  " +
                    item.name.padEnd(24) +
                    item.originalPath
            );
        }

        if (args[0] === "empty") {
            return COMMANDS.empty.run([]);
        }

        ui.openApp("trash");
    }, true);

    define("rename", "rename <path> <new-name>", "Rename file or folder", (args) => {
        requireArgs(args, 2, "rename <path> <new-name>");

        FS.rename(FS.resolve(args[0]), args[1]);

        return "Renamed to " + args[1];
    }, true);

    define("mv", "mv <source> <destination>", "Move / rename", (args) => {
        requireArgs(args, 2, "mv <source> <destination>");

        FS.move(FS.resolve(args[0]), FS.resolve(args[1]));
    }, true);

    define("cp", "cp <source> <destination>", "Copy file or folder", (args) => {
        requireArgs(args, 2, "cp <source> <destination>");

        FS.copy(FS.resolve(args[0]), FS.resolve(args[1]));
    }, true);

    define("open", "open <path>", "Open file or folder", (args) => {
        requireArgs(args, 1, "open <path>");

        const path = FS.resolve(args[0]);
        const node = FS.find(path);

        if (!node) throw new Error(args[0] + ": not found");

        if (node.type === "directory") {
            ui.openApp("files", path);
        } else {
            ui.openFile(path);
        }
    });

    define("edit", "edit <file>", "Edit a file (creates it if missing)", (args) => {
        requireArgs(args, 1, "edit <file>");

        const path = FS.resolve(args[0]);

        if (!FS.exists(path)) FS.create(path, "file", "");

        fileAt(path);

        ui.openFile(path);
    }, true);

    define("files", "files", "Open File Manager", () => ui.openApp("files"));
    define("calc", "calc", "Open Calculator", () => ui.openApp("calculator"));
    define("browser", "browser", "Open Browser", () => ui.openApp("browser"));
    define("lab", "lab", "Open CPU Lab", () => ui.openApp("lab"));
    define("about", "about", "About LowOS", () => ui.openApp("welcome"));

    define("run", "run <file.asm>", "Assemble and run a program", (args) => {
        requireArgs(args, 1, "run <file.asm>");

        const file = fileAt(FS.resolve(args[0]));
        const state = CPU.run(file.content);

        ui.updateRegs(state);

        return CPU.format(state);
    });

    define("clear", "clear", "Clear the screen", () => ui.clear());

    define("date", "date", "Show date and time", () => new Date().toString());

    define("echo", "echo <text>", "Print text", (args) => args.join(" "));

    define("whoami", "whoami", "Current user", () => "dead");

    define("history", "history", "Show command history", () => {
        return Shell.history.map(
            (line, i) => String(i + 1).padStart(4) + "  " + line
        );
    });

    define("head", "head [-n N] <file>", "First lines of a file", (args) => {
        const { count, rest } = countOption(args, 10);

        requireArgs(rest, 1, "head [-n N] <file>");

        return fileAt(FS.resolve(rest[0])).content
            .split("\n").slice(0, count);
    });

    define("tail", "tail [-n N] <file>", "Last lines of a file", (args) => {
        const { count, rest } = countOption(args, 10);

        requireArgs(rest, 1, "tail [-n N] <file>");

        const lines = fileAt(FS.resolve(rest[0])).content.split("\n");

        return count === 0 ? [] : lines.slice(-count);
    });

    define("wc", "wc <file>", "Count lines, words, characters", (args) => {
        requireArgs(args, 1, "wc <file>");

        const content = fileAt(FS.resolve(args[0])).content;

        const lines = content ? content.split("\n").length : 0;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;

        return `${lines} lines  ${words} words  ${content.length} chars  ${args[0]}`;
    });

    define("stat", "stat <path>", "Show file information", (args) => {
        requireArgs(args, 1, "stat <path>");

        const info = FS.stat(FS.resolve(args[0]));

        return [
            "  Path: " + info.path,
            "  Type: " + info.type,
            "  Size: " + info.size + " chars" +
                (info.type === "directory" ? ` (${info.items} item(s))` : ""),
            "Create: " + fmtDate(info.createdAt),
            "Modify: " + fmtDate(info.modifiedAt),
            "    Id: " + info.id
        ];
    });

    define("find", "find [path] <name>", "Find by name (substring)", (args) => {
        requireArgs(args, 1, "find [path] <name>");

        const start = args.length > 1 ? FS.resolve(args[0]) : FS.currentPath;
        const query = (args.length > 1 ? args[1] : args[0]).toLowerCase();

        const results = [];

        dirAt(start);

        FS.walk(start, (node, path) => {
            if (path !== start && node.name.toLowerCase().includes(query)) {
                results.push(path + (node.type === "directory" ? "/" : ""));
            }
        });

        return results.length ? results : "(no matches)";
    });

    define("grep", "grep [-i] <text> <path...>", "Search inside files", (args) => {
        const { flags, pos } = parseFlags(args);

        requireArgs(pos, 2, "grep [-i] <text> <path...>");

        const pattern = new RegExp(
            escapeRegExp(pos[0]),
            flags.has("i") ? "i" : ""
        );

        const results = [];

        pos.slice(1).forEach((target) => {
            const start = FS.resolve(target);

            if (!FS.exists(start)) throw new Error(target + ": not found");

            FS.walk(start, (node, path) => {
                if (node.type !== "file") return;

                node.content.split("\n").forEach((line, index) => {
                    if (pattern.test(line)) {
                        results.push(`${path}:${index + 1}: ${line}`);
                    }
                });
            });
        });

        if (!results.length) return "(no matches)";

        if (results.length > 200) {
            return results.slice(0, 200).concat(
                `... ${results.length - 200} more`
            );
        }

        return results;
    });

    define("uname", "uname", "System information", () => {
        return "LowOS 3.0 JavaScript (browser) toy-cpu/4reg";
    });

    define("uptime", "uptime", "Time since page load", () => {
        return "up " + fmtDuration(Date.now() - START_TIME);
    });

    define("neofetch", "neofetch", "System summary", () => {
        return [
            "dead@lowos",
            "----------",
            "OS:      LowOS (browser)",
            "Kernel:  JavaScript",
            "Shell:   LowOS Shell",
            "CPU:     4 register toy CPU",
            "Storage: " + FS.size("/") + " chars in localStorage",
            "Trash:   " + FS.getTrash().length + " item(s)",
            "Uptime:  " + fmtDuration(Date.now() - START_TIME)
        ];
    });

    define("export", "export", "Download a backup of the filesystem", () => {
        ui.exportData();

        return "Backup downloaded.";
    });

    define("import", "import", "Restore from a backup file", () => {
        ui.importData();

        return "Choose a LowOS backup (.json) file...";
    });

    define("reset", "reset --yes", "Erase everything and start over", (args) => {
        if (args[0] !== "--yes") {
            return "This erases ALL files and the Trash. Run 'reset --yes' to confirm.";
        }

        FS.reset();

        return "Filesystem reset to defaults.";
    }, true);

    define("reboot", "reboot", "Restart LowOS", () => ui.reboot());

    /* ---------- execution ---------- */

    function writeRedirect(redirect, text) {
        const path = FS.resolve(redirect.path);
        const node = FS.find(path);

        if (node && node.type !== "file") {
            throw new Error(redirect.path + ": is a directory");
        }

        if (!node) FS.create(path, "file", "");

        if (redirect.mode === ">") {
            FS.write(path, text);
        } else {
            const existing = FS.find(path).content;
            const separator = existing && !existing.endsWith("\n") ? "\n" : "";

            FS.write(path, existing + separator + text);
        }
    }

    const Shell = {

        history: [],

        ui,

        commands: COMMANDS,

        /* Returns { out, error } - never throws. */
        exec(line) {
            line = String(line).trim();

            if (!line) return { out: "", error: null };

            let tokens;

            try {
                tokens = tokenize(line);
            } catch (error) {
                return { out: "", error: error.message };
            }

            let redirect = null;

            const index = tokens.findIndex(
                (t) => !t.quoted && (t.value === ">" || t.value === ">>")
            );

            if (index !== -1) {
                const target = tokens[index + 1];

                if (!target) {
                    return {
                        out: "",
                        error: "syntax error: expected a file name after " +
                               tokens[index].value
                    };
                }

                redirect = { mode: tokens[index].value, path: target.value };

                tokens = tokens.slice(0, index).concat(tokens.slice(index + 2));
            }

            const argv = tokens.map((t) => t.value);

            if (!argv.length) return { out: "", error: null };

            const name = argv[0].toLowerCase();
            const command = COMMANDS[name];

            if (!command) {
                return {
                    out: "",
                    error: `${argv[0]}: command not found. Type 'help' to list commands.`
                };
            }

            try {
                const result = command.run(argv.slice(1));

                let text =
                    Array.isArray(result)
                        ? result.join("\n")
                        : result === undefined || result === null
                            ? ""
                            : String(result);

                if (redirect) {
                    writeRedirect(redirect, text);
                    text = "";
                }

                if (command.mutates || redirect) ui.refresh();

                return { out: text, error: null };

            } catch (error) {
                return { out: "", error: `${name}: ${error.message}` };
            }
        },

        /* Tab completion. Returns { line, options }. */
        complete(line) {
            const match = line.match(/^(.*?)(\S*)$/);

            const before = match[1];
            const word = match[2];

            let candidates = [];

            if (before.trim() === "") {
                candidates = Object.keys(COMMANDS).filter(
                    (name) => name.startsWith(word.toLowerCase())
                );
            } else {
                const slash = word.lastIndexOf("/");
                const dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
                const base = word.slice(slash + 1);

                const dir = FS.find(dirPart ? FS.normalize(dirPart) : FS.currentPath);

                if (dir && dir.type === "directory") {
                    candidates = FS.sorted(dir.children)
                        .filter((n) => n.name.startsWith(base))
                        .map(
                            (n) =>
                                dirPart + n.name +
                                (n.type === "directory" ? "/" : "")
                        );
                }
            }

            if (!candidates.length) return { line, options: [] };

            if (candidates.length === 1) {
                const only = candidates[0];

                return {
                    line: before + only + (only.endsWith("/") ? "" : " "),
                    options: []
                };
            }

            let prefix = candidates[0];

            candidates.forEach((candidate) => {
                while (!candidate.startsWith(prefix)) {
                    prefix = prefix.slice(0, -1);
                }
            });

            return { line: before + prefix, options: candidates };
        },

        promptPath() {
            const path = FS.currentPath;

            if (path === FS.HOME) return "~";

            if (path.startsWith(FS.HOME + "/")) {
                return "~" + path.slice(FS.HOME.length);
            }

            return path;
        }
    };

    window.Shell = Shell;

    if (typeof module !== "undefined" && module.exports) {
        module.exports = Shell;
    }

})();
