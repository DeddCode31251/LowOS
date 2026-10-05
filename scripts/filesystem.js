(function () {
    "use strict";

    const STORAGE_KEY = "lowos.filesystem.v3";
    const TRASH_KEY = "lowos.trash.v3";
    const DESKTOP_KEY = "lowos.desktop.v3";

    const HOME = "/home/dead";

    const STANDARD_DIRS = [
        HOME + "/Desktop",
        HOME + "/Documents",
        HOME + "/Downloads",
        HOME + "/Pictures",
        HOME + "/Projects",
        "/system",
        "/tmp"
    ];

    /* These can never be deleted, renamed or moved. */
    const PROTECTED = new Set(["/", "/home", HOME].concat(STANDARD_DIRS));

    let root = null;
    let trash = [];
    let desktopBoxes = {};

    /* Falls back to memory when localStorage is unavailable
       (private mode, blocked cookies, quota problems). */
    const memoryStore = {};

    const store = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                return key in memoryStore ? memoryStore[key] : null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                memoryStore[key] = value;
                return false;
            }
        }
    };

    function uid() {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 10)
        );
    }

    function makeNode(name, type, content) {
        const now = Date.now();

        return {
            id: uid(),
            name,
            type,
            content: type === "file" ? (content || "") : "",
            children: type === "directory" ? [] : undefined,
            createdAt: now,
            modifiedAt: now
        };
    }

    function sortNodes(nodes) {
        return nodes.slice().sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1;
            }

            return a.name.localeCompare(
                b.name,
                undefined,
                { numeric: true, sensitivity: "base" }
            );
        });
    }

    function isValidNode(node, depth) {
        if (
            !node ||
            typeof node !== "object" ||
            typeof node.name !== "string" ||
            depth > 64
        ) {
            return false;
        }

        if (node.type === "file") {
            return (
                node.content === undefined ||
                typeof node.content === "string"
            );
        }

        if (node.type === "directory") {
            return (
                Array.isArray(node.children) &&
                node.children.every(
                    (child) => isValidNode(child, depth + 1)
                )
            );
        }

        return false;
    }

    function isValidRoot(node) {
        return (
            isValidNode(node, 0) &&
            node.type === "directory" &&
            node.name === "/"
        );
    }

    /* Fills in missing ids / timestamps on loaded or imported data. */
    function repair(node) {
        const now = Date.now();

        if (!node.id) node.id = uid();
        if (!node.createdAt) node.createdAt = now;
        if (!node.modifiedAt) node.modifiedAt = node.createdAt;

        if (node.type === "file") {
            if (typeof node.content !== "string") node.content = "";
            delete node.children;
        } else {
            node.content = "";
            node.children.forEach(repair);
        }
    }

    function readJSON(key, fallback) {
        try {
            const raw = store.get(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function ensureDir(path) {
        let node = root;

        path.split("/").filter(Boolean).forEach((part) => {
            let next = node.children.find((c) => c.name === part);

            if (!next) {
                next = makeNode(part, "directory");
                node.children.push(next);
            } else if (next.type !== "directory") {
                throw new Error(
                    "Cannot create " + path + ": " + part + " is a file"
                );
            }

            node = next;
        });
    }

    function ensureDefaults() {
        STANDARD_DIRS.forEach((dir) => {
            try {
                ensureDir(dir);
            } catch (error) {
                console.warn("LowOS:", error.message);
            }
        });
    }

    function nodeSize(node) {
        if (node.type === "file") {
            return (node.content || "").length;
        }

        return node.children.reduce(
            (sum, child) => sum + nodeSize(child),
            0
        );
    }

    function cloneNode(node) {
        const now = Date.now();

        const copy = {
            id: uid(),
            name: node.name,
            type: node.type,
            content: node.type === "file" ? (node.content || "") : "",
            children: undefined,
            createdAt: now,
            modifiedAt: now
        };

        if (node.type === "directory") {
            copy.children = node.children.map(cloneNode);
        }

        return copy;
    }

    function createDefaultFilesystem() {
        root = makeNode("/", "directory");

        ensureDefaults();

        const find = (path) => FS.find(path);

        const add = (dir, name, content) => {
            find(dir).children.push(makeNode(name, "file", content));
        };

        add(
            HOME + "/Desktop",
            "welcome.txt",
            "Welcome to LowOS.\n\nThis is your virtual desktop."
        );

        add(
            HOME + "/Desktop",
            "notes.md",
            "# LowOS Notes\n\nThis file lives inside the virtual filesystem."
        );

        add(
            HOME + "/Documents",
            "document.txt",
            "Create, edit and rename files from LowOS."
        );

        add(
            HOME + "/Projects",
            "hello.c",
            "#include <stdio.h>\n\nint main(void) {\n    printf(\"Hello from LowOS!\\n\");\n    return 0;\n}"
        );

        add(
            HOME + "/Projects",
            "sum.asm",
            "; sum 1..10 into AX\n\nMOV AX, 0\nMOV CX, 10\n\nloop:\nADD AX, CX\nDEC CX\nJNZ loop\n\nOUT AX\nHLT\n"
        );

        return root;
    }

    const FS = {

        HOME,

        currentPath: HOME + "/Desktop",

        /* ---------- persistence ---------- */

        init() {
            const saved = readJSON(STORAGE_KEY, null);

            if (isValidRoot(saved)) {
                root = saved;
                repair(root);
            } else {
                if (saved) {
                    console.warn("LowOS: filesystem was corrupt, resetting.");
                }

                root = null;
                createDefaultFilesystem();
            }

            const savedTrash = readJSON(TRASH_KEY, []);

            trash = Array.isArray(savedTrash)
                ? savedTrash.filter(
                    (item) =>
                        item &&
                        typeof item.id === "string" &&
                        isValidNode(item.node, 0)
                )
                : [];

            trash.forEach((item) => repair(item.node));

            const savedBoxes = readJSON(DESKTOP_KEY, {});

            desktopBoxes =
                savedBoxes && typeof savedBoxes === "object"
                    ? savedBoxes
                    : {};

            ensureDefaults();

            if (!this.exists(this.currentPath)) {
                this.currentPath = HOME;
            }

            this.save();
        },

        save() {
            const ok =
                store.set(STORAGE_KEY, JSON.stringify(root)) &
                store.set(TRASH_KEY, JSON.stringify(trash)) &
                store.set(DESKTOP_KEY, JSON.stringify(desktopBoxes));

            if (!ok && typeof window.toast === "function") {
                window.toast(
                    "Storage is full or blocked. Changes will not survive a reload.",
                    "error"
                );
            }

            return !!ok;
        },

        reset() {
            root = null;
            trash = [];
            desktopBoxes = {};
            createDefaultFilesystem();
            this.currentPath = HOME + "/Desktop";
            this.save();
        },

        exportData() {
            return {
                app: "LowOS",
                version: 3,
                exportedAt: new Date().toISOString(),
                root,
                trash,
                desktop: desktopBoxes
            };
        },

        importData(data) {
            if (!data || data.app !== "LowOS" || !isValidRoot(data.root)) {
                throw new Error("Not a valid LowOS backup file");
            }

            const newTrash = Array.isArray(data.trash)
                ? data.trash.filter(
                    (item) =>
                        item &&
                        typeof item.id === "string" &&
                        isValidNode(item.node, 0)
                )
                : [];

            root = data.root;
            repair(root);

            trash = newTrash;
            trash.forEach((item) => repair(item.node));

            desktopBoxes =
                data.desktop && typeof data.desktop === "object"
                    ? data.desktop
                    : {};

            ensureDefaults();

            if (!this.exists(this.currentPath)) {
                this.currentPath = HOME;
            }

            this.save();
        },

        /* ---------- paths ---------- */

        validName(name) {
            return (
                typeof name === "string" &&
                name.trim() !== "" &&
                name !== "." &&
                name !== ".." &&
                name.length <= 100 &&
                !/[\/\\\u0000-\u001f]/.test(name)
            );
        },

        isProtected(path) {
            return PROTECTED.has(this.normalize(path));
        },

        normalize(path) {
            if (path === undefined || path === null || path === "") {
                return this.currentPath;
            }

            path = String(path).replaceAll("\\", "/");

            if (path === "~" || path.startsWith("~/")) {
                path = HOME + path.slice(1);
            }

            if (!path.startsWith("/")) {
                path = this.currentPath + "/" + path;
            }

            const parts = [];

            path.split("/").forEach((part) => {
                if (!part || part === ".") return;

                if (part === "..") {
                    parts.pop();
                    return;
                }

                parts.push(part);
            });

            return "/" + parts.join("/");
        },

        resolve(path) {
            return this.normalize(path);
        },

        parent(path) {
            path = this.normalize(path);

            if (path === "/") return null;

            const index = path.lastIndexOf("/");

            return index === 0 ? "/" : path.slice(0, index);
        },

        name(path) {
            path = this.normalize(path);

            return path === "/" ? "/" : path.split("/").pop();
        },

        join(dir, name) {
            return this.normalize(dir + "/" + name);
        },

        /* ---------- lookup ---------- */

        find(path) {
            path = this.normalize(path);

            if (path === "/") return root;

            let node = root;

            for (const part of path.split("/").filter(Boolean)) {
                if (!node.children) return null;

                node = node.children.find(
                    (child) => child.name === part
                );

                if (!node) return null;
            }

            return node;
        },

        exists(path) {
            return !!this.find(path);
        },

        list(path) {
            const node = this.find(path);

            if (!node || node.type !== "directory") {
                throw new Error("Not a directory");
            }

            return node.children;
        },

        listSorted(path) {
            return sortNodes(this.list(path));
        },

        sorted(nodes) {
            return sortNodes(nodes);
        },

        size(nodeOrPath) {
            const node =
                typeof nodeOrPath === "string"
                    ? this.find(nodeOrPath)
                    : nodeOrPath;

            if (!node) throw new Error("Path not found");

            return nodeSize(node);
        },

        stat(path) {
            const node = this.find(path);

            if (!node) throw new Error("Path not found");

            return {
                path: this.normalize(path),
                name: node.name,
                type: node.type,
                size: nodeSize(node),
                items: node.type === "directory"
                    ? node.children.length
                    : 0,
                createdAt: node.createdAt,
                modifiedAt: node.modifiedAt,
                id: node.id
            };
        },

        /* Calls callback(node, fullPath) for the node and everything below it. */
        walk(path, callback) {
            const start = this.normalize(path);
            const node = this.find(start);

            if (!node) throw new Error("Path not found");

            const visit = (current, currentPath) => {
                callback(current, currentPath);

                if (current.type === "directory") {
                    current.children.forEach((child) => {
                        visit(
                            child,
                            currentPath === "/"
                                ? "/" + child.name
                                : currentPath + "/" + child.name
                        );
                    });
                }
            };

            visit(node, start);
        },

        /* "name.txt" -> "name (1).txt" when the name is already taken. */
        uniqueName(dirPath, name) {
            const dir = this.find(dirPath);

            if (!dir || dir.type !== "directory") return name;

            const taken = (candidate) =>
                dir.children.some((child) => child.name === candidate);

            if (!taken(name)) return name;

            const dot = name.lastIndexOf(".");
            const stem = dot > 0 ? name.slice(0, dot) : name;
            const extension = dot > 0 ? name.slice(dot) : "";

            let count = 1;
            let candidate;

            do {
                candidate = stem + " (" + count + ")" + extension;
                count++;
            } while (taken(candidate));

            return candidate;
        },

        /* ---------- create / modify ---------- */

        create(path, type = "file", content = "") {
            path = this.normalize(path);

            if (path === "/") {
                throw new Error("Cannot create root");
            }

            const name = this.name(path);

            if (!this.validName(name)) {
                throw new Error("Invalid name");
            }

            if (this.exists(path)) {
                throw new Error("File already exists");
            }

            const parent = this.find(this.parent(path));

            if (!parent || parent.type !== "directory") {
                throw new Error("Parent directory does not exist");
            }

            const node = makeNode(name, type, content);

            parent.children.push(node);
            parent.modifiedAt = Date.now();

            this.save();

            return node;
        },

        /* Like mkdir -p */
        mkdirp(path) {
            path = this.normalize(path);

            let current = "";

            path.split("/").filter(Boolean).forEach((part) => {
                current += "/" + part;

                if (!this.exists(current)) {
                    this.create(current, "directory");
                } else if (this.find(current).type !== "directory") {
                    throw new Error(current + " is not a directory");
                }
            });
        },

        write(path, content) {
            const node = this.find(path);

            if (!node) throw new Error("File not found");
            if (node.type !== "file") throw new Error("Not a file");

            node.content = String(content);
            node.modifiedAt = Date.now();

            this.save();

            return node;
        },

        touch(path) {
            const node = this.find(path);

            if (!node) {
                return this.create(path, "file", "");
            }

            node.modifiedAt = Date.now();
            this.save();

            return node;
        },

        rename(path, newName) {
            path = this.normalize(path);

            if (path === "/") {
                throw new Error("Cannot rename root");
            }

            if (this.isProtected(path)) {
                throw new Error("Protected system directory");
            }

            const node = this.find(path);

            if (!node) throw new Error("File not found");

            newName = String(newName || "").trim();

            if (!this.validName(newName)) {
                throw new Error("Invalid name");
            }

            const parent = this.find(this.parent(path));

            if (
                parent.children.some(
                    (child) =>
                        child !== node && child.name === newName
                )
            ) {
                throw new Error("A file with that name already exists");
            }

            node.name = newName;
            node.modifiedAt = Date.now();

            this.save();

            return node;
        },

        remove(path) {
            path = this.normalize(path);

            if (this.isProtected(path)) {
                throw new Error("Protected system directory");
            }

            const node = this.find(path);

            if (!node) throw new Error("File not found");

            const parent = this.find(this.parent(path));
            const index = parent.children.indexOf(node);

            if (index === -1) throw new Error("File not found");

            parent.children.splice(index, 1);
            parent.modifiedAt = Date.now();

            trash.push({
                id: node.id,
                name: node.name,
                type: node.type,
                originalPath: path,
                deletedAt: Date.now(),
                node
            });

            this.save();

            return node;
        },

        /* ---------- trash ---------- */

        getTrash() {
            return trash;
        },

        /* Accepts a full id, a unique id prefix, or an item name. */
        findTrashIndex(query) {
            query = String(query || "");

            let index = trash.findIndex((item) => item.id === query);

            if (index !== -1) return index;

            if (query.length >= 4) {
                const matches = trash
                    .map((item, i) => ({ item, i }))
                    .filter(({ item }) => item.id.startsWith(query));

                if (matches.length === 1) return matches[0].i;
            }

            for (let i = trash.length - 1; i >= 0; i--) {
                if (trash[i].name === query) return i;
            }

            return -1;
        },

        restore(query) {
            const index = this.findTrashIndex(query);

            if (index === -1) {
                throw new Error("Trash item not found");
            }

            const item = trash[index];

            let dirPath = this.parent(item.originalPath) || "/";
            const dir = this.find(dirPath);

            if (!dir || dir.type !== "directory") {
                dirPath = HOME + "/Desktop";
            }

            /* The old code worked out a free name but never used it. */
            item.node.name = this.uniqueName(dirPath, item.name);
            item.node.modifiedAt = Date.now();

            this.find(dirPath).children.push(item.node);

            trash.splice(index, 1);

            this.save();

            return item.node;
        },

        permanent(query) {
            const index = this.findTrashIndex(query);

            if (index === -1) {
                throw new Error("Trash item not found");
            }

            trash.splice(index, 1);

            this.save();
        },

        clearTrash() {
            trash = [];
            this.save();
        },

        /* ---------- move / copy ---------- */

        move(source, destination) {
            source = this.normalize(source);
            destination = this.normalize(destination);

            if (this.isProtected(source)) {
                throw new Error("Protected system directory");
            }

            const node = this.find(source);

            if (!node) throw new Error("Source not found");

            const sourceParent = this.find(this.parent(source));
            const target = this.find(destination);

            let targetDir;
            let targetDirPath;
            let newName;

            if (target) {
                if (target.type !== "directory") {
                    throw new Error("Destination already exists");
                }

                targetDir = target;
                targetDirPath = destination;
                newName = node.name;
            } else {
                targetDirPath = this.parent(destination);
                targetDir = this.find(targetDirPath);

                if (!targetDir || targetDir.type !== "directory") {
                    throw new Error("Destination not found");
                }

                newName = this.name(destination);

                if (!this.validName(newName)) {
                    throw new Error("Invalid name");
                }
            }

            if (
                node.type === "directory" &&
                (
                    targetDirPath === source ||
                    targetDirPath.startsWith(source + "/")
                )
            ) {
                throw new Error("Cannot move directory into itself");
            }

            if (targetDir === sourceParent && newName === node.name) {
                return node;
            }

            if (
                targetDir.children.some(
                    (child) => child !== node && child.name === newName
                )
            ) {
                throw new Error("Destination already exists");
            }

            sourceParent.children.splice(
                sourceParent.children.indexOf(node),
                1
            );

            node.name = newName;
            node.modifiedAt = Date.now();

            targetDir.children.push(node);

            this.save();

            return node;
        },

        copy(source, destination) {
            source = this.normalize(source);
            destination = this.normalize(destination);

            const sourceNode = this.find(source);

            if (!sourceNode) throw new Error("Source not found");

            const destinationNode = this.find(destination);

            let parent;
            let name;

            if (destinationNode) {
                if (destinationNode.type !== "directory") {
                    throw new Error("Destination already exists");
                }

                parent = destinationNode;
                name = sourceNode.name;
            } else {
                parent = this.find(this.parent(destination));
                name = this.name(destination);
            }

            if (!parent || parent.type !== "directory") {
                throw new Error("Destination is not a directory");
            }

            if (!this.validName(name)) {
                throw new Error("Invalid name");
            }

            if (parent.children.some((child) => child.name === name)) {
                throw new Error("Destination already exists");
            }

            const clone = cloneNode(sourceNode);

            clone.name = name;

            parent.children.push(clone);

            this.save();

            return clone;
        },

        /* ---------- display ---------- */

        tree(path = "/") {
            const node = this.find(path);

            if (!node) throw new Error("Path not found");

            const lines = [
                node.type === "directory"
                    ? (node.name === "/" ? "/" : node.name + "/")
                    : node.name
            ];

            const walk = (dir, prefix) => {
                const kids = sortNodes(dir.children);

                kids.forEach((child, index) => {
                    const last = index === kids.length - 1;

                    lines.push(
                        prefix +
                        (last ? "└── " : "├── ") +
                        child.name +
                        (child.type === "directory" ? "/" : "")
                    );

                    if (child.type === "directory") {
                        walk(child, prefix + (last ? "    " : "│   "));
                    }
                });
            };

            if (node.type === "directory") walk(node, "");

            return lines;
        },

        /* ---------- desktop zone placement (keyed by node id) ---------- */

        boxOf(id) {
            return desktopBoxes[id];
        },

        setBox(id, zone) {
            desktopBoxes[id] = zone;
            this.save();
        }
    };

    window.FS = FS;

})();
