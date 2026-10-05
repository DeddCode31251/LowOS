(function () {
    "use strict";

    var STORAGE_KEY = "2bytesos_filesystem";

    var defaultFileSystem = {
        type: "directory",
        name: "/",
        children: [
            {
                type: "directory",
                name: "home",
                children: [
                    {
                        type: "directory",
                        name: "dead",
                        children: [
                            {
                                type: "directory",
                                name: "Desktop",
                                children: []
                            },
                            {
                                type: "directory",
                                name: "Documents",
                                children: []
                            },
                            {
                                type: "directory",
                                name: "Downloads",
                                children: []
                            }
                        ]
                    }
                ]
            },
            {
                type: "directory",
                name: "system",
                children: [
                    {
                        type: "file",
                        name: "version.txt",
                        content: "2BytesOS 1.0"
                    }
                ]
            },
            {
                type: "directory",
                name: "tmp",
                children: []
            }
        ]
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function save() {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(fileSystem)
        );
    }

    function load() {
        var saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            var fresh = clone(defaultFileSystem);

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(fresh)
            );

            return fresh;
        }

        try {
            return JSON.parse(saved);
        } catch (error) {
            var fresh = clone(defaultFileSystem);

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(fresh)
            );

            return fresh;
        }
    }

    var fileSystem = load();

    function splitPath(path) {
        return String(path || "")
            .replace(/\\/g, "/")
            .split("/")
            .filter(Boolean);
    }

    function normalizePath(path) {
        if (!path) {
            return "/";
        }

        var parts = splitPath(path);
        var result = [];

        parts.forEach(function (part) {
            if (part === ".") {
                return;
            }

            if (part === "..") {
                result.pop();
                return;
            }

            result.push(part);
        });

        return "/" + result.join("/");
    }

    function findNode(path) {
        path = normalizePath(path);

        if (path === "/") {
            return fileSystem;
        }

        var parts = splitPath(path);
        var current = fileSystem;

        for (var i = 0; i < parts.length; i++) {
            if (
                !current.children ||
                current.type !== "directory"
            ) {
                return null;
            }

            current = current.children.find(
                function (child) {
                    return child.name === parts[i];
                }
            );

            if (!current) {
                return null;
            }
        }

        return current;
    }

    function parentPath(path) {
        path = normalizePath(path);

        if (path === "/") {
            return null;
        }

        var parts = splitPath(path);

        parts.pop();

        return "/" + parts.join("/");
    }

    function nameFromPath(path) {
        var parts = splitPath(path);

        return parts[parts.length - 1] || "/";
    }

    function exists(path) {
        return findNode(path) !== null;
    }

    function createDirectory(path) {
        path = normalizePath(path);

        if (exists(path)) {
            throw new Error("already exists");
        }

        var parent = findNode(
            parentPath(path)
        );

        if (
            !parent ||
            parent.type !== "directory"
        ) {
            throw new Error(
                "parent directory does not exist"
            );
        }

        parent.children.push({
            type: "directory",
            name: nameFromPath(path),
            children: []
        });

        save();
    }

    function createFile(path, content) {
        path = normalizePath(path);

        if (exists(path)) {
            throw new Error("already exists");
        }

        var parent = findNode(
            parentPath(path)
        );

        if (
            !parent ||
            parent.type !== "directory"
        ) {
            throw new Error(
                "parent directory does not exist"
            );
        }

        parent.children.push({
            type: "file",
            name: nameFromPath(path),
            content: content || ""
        });

        save();
    }

    function readFile(path) {
        var file = findNode(path);

        if (!file) {
            throw new Error("file does not exist");
        }

        if (file.type !== "file") {
            throw new Error("not a file");
        }

        return file.content;
    }

    function writeFile(path, content) {
        var file = findNode(path);

        if (!file) {
            throw new Error("file does not exist");
        }

        if (file.type !== "file") {
            throw new Error("not a file");
        }

        file.content = content;

        save();
    }

    function deletePath(path) {
        path = normalizePath(path);

        if (path === "/") {
            throw new Error(
                "cannot delete root directory"
            );
        }

        var parent = findNode(
            parentPath(path)
        );

        if (
            !parent ||
            parent.type !== "directory"
        ) {
            throw new Error(
                "parent directory does not exist"
            );
        }

        var index =
            parent.children.findIndex(
                function (child) {
                    return (
                        child.name ===
                        nameFromPath(path)
                    );
                }
            );

        if (index === -1) {
            throw new Error(
                "file or directory does not exist"
            );
        }

        parent.children.splice(index, 1);

        save();
    }

    function renamePath(path, newName) {
        if (
            !newName ||
            newName.includes("/")
        ) {
            throw new Error("invalid name");
        }

        var node = findNode(path);

        if (!node) {
            throw new Error(
                "file or directory does not exist"
            );
        }

        if (path === "/") {
            throw new Error(
                "cannot rename root"
            );
        }

        var parent = findNode(
            parentPath(path)
        );

        if (
            parent.children.some(
                function (child) {
                    return child.name === newName;
                }
            )
        ) {
            throw new Error("name already exists");
        }

        node.name = newName;

        save();
    }

    function listDirectory(path) {
        var directory =
            findNode(path || "/");

        if (!directory) {
            throw new Error(
                "directory does not exist"
            );
        }

        if (directory.type !== "directory") {
            throw new Error(
                "not a directory"
            );
        }

        return directory.children;
    }

    function reset() {
        fileSystem =
            clone(defaultFileSystem);

        save();
    }

    window.LowOSFileSystem = {
        exists: exists,
        createFile: createFile,
        createDirectory: createDirectory,
        readFile: readFile,
        writeFile: writeFile,
        deletePath: deletePath,
        renamePath: renamePath,
        listDirectory: listDirectory,
        normalizePath: normalizePath,
        findNode: findNode,
        reset: reset
    };
})();
