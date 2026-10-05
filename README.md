# LowOS

LowOS is a browser-based operating system simulator built with HTML, CSS and JavaScript.

## Features

- Virtual filesystem stored in browser `localStorage` (with a safe in-memory fallback)
- Desktop divided into four zones; drag desktop files between zones, or onto a folder to move them into it
- Right-click menu on the desktop and on icons (Open, Rename, Move to Trash, New File/Folder)
- Keyboard: `Delete` trashes the selected icon, `F2` renames it, `Enter` opens it
- File Manager with sizes/dates, sorting, Copy / Cut / Paste (auto-renames on conflicts)
- Text Editor with unsaved-changes marker, `Ctrl+S`, Tab indentation, New, Save As, and **Run ASM**
- Calculator with a safe expression parser (no `eval`), keyboard input and backspace
- Browser with back/forward history and External mode (loads lazily, so startup never waits on the network)
- Trash Can with restore and permanent deletion (restoring never overwrites an existing file)
- **CPU Lab**: a real assembler/interpreter for a 4-register toy CPU with labels, comments and error messages with line numbers
- Shell with history, Tab completion, output redirection (`>`, `>>`) and many commands
- Backup / restore the whole filesystem as a JSON file (`export` / `import`)
- Draggable windows (mouse and touch), click-to-raise, double-click title bar to maximise
- Start menu (click **LowOS** in the top bar), toast notifications, responsive layout
- Fast boot: the desktop is ready before the boot animation finishes; click or press any key to skip it. Repeat visits boot in a fraction of a second.

## Project layout

```text
index.html
style.css
script.js            window manager, desktop, menus, trash, terminal UI, boot
scripts/
├── filesystem.js    virtual filesystem + trash + backup
├── cpu.js           assembler and interpreter for the CPU lab
├── filemanager.js
├── texteditor.js
├── calculator.js
├── browser.js
└── terminal.js      shell commands, parsing and tab completion
```

## Run

Use a local web server because browser security is stricter when opening files directly.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Terminal commands

```text
help                       list commands
pwd | cd [path|-] | ls [-l] [path] | tree [path]
touch <file...> | mkdir [-p] <folder...>
cat <file...> | head/tail [-n N] <file> | wc <file> | stat <path>
write <file> <text>        overwrite (use \n for a newline)
append <file> <text>       append as a new line
rm <path...>               move to Trash
trash [list|empty] | empty | restore <trash-id-or-name>
rename <path> <new-name> | mv <src> <dst> | cp <src> <dst>
find [path] <name> | grep [-i] <text> <path...>
open <path> | edit <file>  (edit creates the file if it is missing)
files | calc | browser | lab | about
run <file.asm>             assemble and run a program
export | import | reset --yes
history | clear | date | echo <text> | whoami | uname | uptime | neofetch | reboot
```

Redirection works too: `echo hello > a.txt`, `echo more >> a.txt`.
`~` means `/home/dead`.

Keys: `Tab` completes commands and paths, `Up`/`Down` browse history, `Ctrl+L` clears.

## CPU Lab instructions

```text
MOV r, x    ADD r, x    SUB r, x    MUL r, x    DIV r, x
INC r       DEC r       CMP a, b
JMP label   JZ label    JNZ label   JL label    JG label
OUT x       HLT         NOP
```

Registers are `AX BX CX DX` (32-bit signed). Operands are registers or numbers (`10`, `-3`, `0xFF`).
Arithmetic and `CMP` set the zero flag (`ZF`), so `DEC CX` / `JNZ loop` works as expected.
Labels end with `:`, comments start with `;`. Programs stop after 10 000 steps to catch infinite loops.
`Ctrl+Enter` runs the program.

## Filesystem

The filesystem is virtual. LowOS does not directly modify the real filesystem. Data is persisted with `localStorage`.

Default directories (these are protected and cannot be deleted, renamed or moved):

```text
/
├── home/
│   └── dead/
│       ├── Desktop/
│       ├── Documents/
│       ├── Downloads/
│       ├── Pictures/
│       └── Projects/
├── system/
└── tmp/
```

If saved data is ever corrupted, LowOS starts from a fresh filesystem instead of failing to boot.

## Browser limitation

A normal web application cannot force every website to render inside an iframe. Sites can block iframe embedding with security headers. LowOS therefore provides an **External** button that opens the address in the user's normal browser.

## Reset LowOS

Run `reset --yes` in the shell, or open browser developer tools and run:

```js
localStorage.clear(); location.reload();
```

This resets the virtual filesystem and desktop state.
