(function () {
    "use strict";

    const REGISTERS = ["AX", "BX", "CX", "DX"];

    const DEFAULT_SOURCE =
`; sum 1..5 into AX

MOV AX, 0
MOV CX, 5

loop:
ADD AX, CX
DEC CX
JNZ loop

OUT AX
HLT
`;

    /* operand counts */
    const OPS = {
        MOV: 2, ADD: 2, SUB: 2, MUL: 2, DIV: 2,
        INC: 1, DEC: 1, CMP: 2,
        JMP: 1, JZ: 1, JNZ: 1, JL: 1, JG: 1,
        OUT: 1, HLT: 0, NOP: 0
    };

    /* first operand must be a register */
    const DEST_REG = new Set(
        ["MOV", "ADD", "SUB", "MUL", "DIV", "INC", "DEC"]
    );

    const JUMPS = new Set(["JMP", "JZ", "JNZ", "JL", "JG"]);

    const isRegister = (text) =>
        REGISTERS.includes(String(text).toUpperCase());

    const isNumber = (text) =>
        /^-?(\d+|0x[0-9a-f]+)$/i.test(String(text));

    const parseNumber = (text) => {
        text = String(text);

        const negative = text.startsWith("-");
        const body = negative ? text.slice(1) : text;

        const value = /^0x/i.test(body)
            ? parseInt(body, 16)
            : parseInt(body, 10);

        return (negative ? -value : value) | 0;
    };

    function assemble(source) {
        const program = [];
        const labels = {};
        const errors = [];

        String(source).split(/\r?\n/).forEach((raw, index) => {
            const lineNo = index + 1;

            let line = raw.replace(/;.*$/, "").trim();

            if (!line) return;

            let match;

            while ((match = line.match(/^([A-Za-z_]\w*):\s*(.*)$/))) {
                const label = match[1].toLowerCase();

                if (label in labels) {
                    errors.push(
                        `line ${lineNo}: duplicate label '${match[1]}'`
                    );
                }

                labels[label] = program.length;
                line = match[2].trim();
            }

            if (!line) return;

            const split = line.match(/^(\S+)\s*(.*)$/);
            const op = split[1].toUpperCase();

            const args = split[2]
                ? split[2].split(",").map((part) => part.trim())
                : [];

            if (!(op in OPS)) {
                errors.push(`line ${lineNo}: unknown instruction '${split[1]}'`);
                return;
            }

            if (args.length !== OPS[op]) {
                errors.push(
                    `line ${lineNo}: ${op} expects ${OPS[op]} operand(s), got ${args.length}`
                );
                return;
            }

            program.push({ op, args, line: lineNo });
        });

        /* second pass: operand validation (labels are known now) */
        program.forEach((ins) => {
            const where = `line ${ins.line}: ${ins.op}`;

            if (DEST_REG.has(ins.op) && !isRegister(ins.args[0])) {
                errors.push(
                    `${where} needs a register (AX, BX, CX, DX) as first operand`
                );
            }

            const valueArgs =
                ins.op === "MOV" || ins.op === "ADD" ||
                ins.op === "SUB" || ins.op === "MUL" ||
                ins.op === "DIV"
                    ? [ins.args[1]]
                    : ins.op === "CMP"
                        ? ins.args
                        : ins.op === "OUT"
                            ? [ins.args[0]]
                            : [];

            valueArgs.forEach((arg) => {
                if (!isRegister(arg) && !isNumber(arg)) {
                    errors.push(
                        `${where}: bad operand '${arg}' (use a register or a number)`
                    );
                }
            });

            if (JUMPS.has(ins.op)) {
                if (!(ins.args[0].toLowerCase() in labels)) {
                    errors.push(
                        `${where}: unknown label '${ins.args[0]}'`
                    );
                }
            }
        });

        return { program, labels, errors };
    }

    function run(source, options) {
        const maxSteps = (options && options.maxSteps) || 10000;

        const { program, labels, errors } = assemble(source);

        const state = {
            regs: { AX: 0, BX: 0, CX: 0, DX: 0 },
            pc: 0,
            zf: 0,
            sf: 0,
            output: [],
            steps: 0,
            halted: false,
            error: null
        };

        if (errors.length) {
            state.error = errors.join("\n");
            return state;
        }

        const value = (arg) =>
            isRegister(arg)
                ? state.regs[arg.toUpperCase()]
                : parseNumber(arg);

        const setFlags = (result) => {
            state.zf = result === 0 ? 1 : 0;
            state.sf = result < 0 ? 1 : 0;
        };

        while (state.pc < program.length) {
            if (state.steps >= maxSteps) {
                state.error =
                    `step limit (${maxSteps}) exceeded at line ` +
                    `${program[state.pc].line} - infinite loop?`;
                break;
            }

            const ins = program[state.pc];
            let next = state.pc + 1;

            state.steps++;

            const reg = ins.args[0] && ins.args[0].toUpperCase();

            switch (ins.op) {
                case "MOV":
                    state.regs[reg] = value(ins.args[1]);
                    break;

                case "ADD":
                    state.regs[reg] =
                        (state.regs[reg] + value(ins.args[1])) | 0;
                    setFlags(state.regs[reg]);
                    break;

                case "SUB":
                    state.regs[reg] =
                        (state.regs[reg] - value(ins.args[1])) | 0;
                    setFlags(state.regs[reg]);
                    break;

                case "MUL":
                    state.regs[reg] =
                        Math.imul(state.regs[reg], value(ins.args[1]));
                    setFlags(state.regs[reg]);
                    break;

                case "DIV": {
                    const divisor = value(ins.args[1]);

                    if (divisor === 0) {
                        state.error =
                            `line ${ins.line}: division by zero`;
                        return state;
                    }

                    state.regs[reg] =
                        Math.trunc(state.regs[reg] / divisor) | 0;
                    setFlags(state.regs[reg]);
                    break;
                }

                case "INC":
                    state.regs[reg] = (state.regs[reg] + 1) | 0;
                    setFlags(state.regs[reg]);
                    break;

                case "DEC":
                    state.regs[reg] = (state.regs[reg] - 1) | 0;
                    setFlags(state.regs[reg]);
                    break;

                case "CMP": {
                    const a = value(ins.args[0]);
                    const b = value(ins.args[1]);

                    state.zf = a === b ? 1 : 0;
                    state.sf = a < b ? 1 : 0;
                    break;
                }

                case "JMP":
                    next = labels[ins.args[0].toLowerCase()];
                    break;

                case "JZ":
                    if (state.zf === 1) {
                        next = labels[ins.args[0].toLowerCase()];
                    }
                    break;

                case "JNZ":
                    if (state.zf === 0) {
                        next = labels[ins.args[0].toLowerCase()];
                    }
                    break;

                case "JL":
                    if (state.sf === 1) {
                        next = labels[ins.args[0].toLowerCase()];
                    }
                    break;

                case "JG":
                    if (state.zf === 0 && state.sf === 0) {
                        next = labels[ins.args[0].toLowerCase()];
                    }
                    break;

                case "OUT":
                    state.output.push(value(ins.args[0]));
                    break;

                case "HLT":
                    state.halted = true;
                    break;

                case "NOP":
                default:
                    break;
            }

            state.pc = next;

            if (state.halted) break;
        }

        return state;
    }

    function format(state) {
        const lines = [];

        if (state.error) {
            lines.push("ERROR: " + state.error);
        }

        state.output.forEach((value) => lines.push("OUT: " + value));

        if (!state.error) {
            lines.push(
                (state.halted ? "HLT" : "END") +
                ` after ${state.steps} step(s)`
            );
        }

        lines.push(
            `AX=${state.regs.AX} BX=${state.regs.BX} ` +
            `CX=${state.regs.CX} DX=${state.regs.DX} ` +
            `PC=${state.pc} ZF=${state.zf}`
        );

        return lines;
    }

    function registerLine(state) {
        return (
            `AX=${state.regs.AX} BX=${state.regs.BX} ` +
            `CX=${state.regs.CX} DX=${state.regs.DX} ` +
            `PC=${state.pc} ZF=${state.zf}`
        );
    }

    window.CPU = {
        DEFAULT_SOURCE,
        REGISTERS,
        assemble,
        run,
        format,
        registerLine
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = window.CPU;
    }

})();
