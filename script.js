// ---------- windows ----------
var topZ = 10;
function raise(w){ topZ++; w.style.zIndex = topZ; }
function openWin(id){ var w = document.getElementById(id); w.style.display = "flex"; raise(w); }
function closeWin(w){ w.style.display = "none"; }
function drag(w){
  var h = w.querySelector(".wh"), x = 0, y = 0, on = false;
  h.addEventListener("pointerdown", function(e){
    if (e.target.matches("[data-close]") || innerWidth <= 640) return;
    on = true; x = e.clientX; y = e.clientY; h.setPointerCapture(e.pointerId); h.style.cursor = "grabbing";
  });
  h.addEventListener("pointermove", function(e){
    if (!on) return;
    var nx = Math.max(0, Math.min(innerWidth - 80, w.offsetLeft + e.clientX - x));
    var ny = Math.max(40, Math.min(innerHeight - 40, w.offsetTop + e.clientY - y));
    w.style.left = nx + "px"; w.style.top = ny + "px"; x = e.clientX; y = e.clientY;
  });
  h.addEventListener("pointerup", function(){ on = false; h.style.cursor = ""; });
}
document.querySelectorAll(".win").forEach(function(w){
  drag(w);
  w.addEventListener("pointerdown", function(){ raise(w); });
  w.querySelector("[data-close]").addEventListener("click", function(){ closeWin(w); });
});
document.querySelectorAll("[data-open]").forEach(function(b){
  b.addEventListener("click", function(){ openWin(b.dataset.open); });
});
document.getElementById("menu").addEventListener("click", function(){ openWin("welcome"); });

// ---------- clock ----------
function tick(){ document.getElementById("clock").textContent = new Date().toLocaleString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
tick(); setInterval(tick, 1000);

// ---------- toy CPU ----------
var R = {AX:0,BX:0,CX:0,DX:0}, PC = 0, ZF = 0;
function showRegs(){ document.getElementById("regs").textContent = "AX="+R.AX+" BX="+R.BX+" CX="+R.CX+" DX="+R.DX+" PC="+PC+" ZF="+ZF; }
function val(t){ t = t.trim().toUpperCase(); return t in R ? R[t] : parseInt(t, 10) || 0; }
function runAsm(src){
  R = {AX:0,BX:0,CX:0,DX:0}; ZF = 0; var out = [], labels = {}, prog = [];
  src.split("\n").forEach(function(l){
    l = l.split(";")[0].trim(); if (!l) return;
    if (l.slice(-1) === ":") labels[l.slice(0,-1).toLowerCase()] = prog.length; else prog.push(l);
  });
  var steps = 0;
  for (PC = 0; PC < prog.length; PC++){
    if (++steps > 5000) { out.push("error: stopped after 5000 steps (infinite loop?)"); break; }
    var p = prog[PC].split(/[\s,]+/), op = p[0].toUpperCase(), a = (p[1]||"").toUpperCase(), b = p[2];
    if (op === "MOV") R[a] = val(b);
    else if (op === "ADD") R[a] += val(b);
    else if (op === "SUB") R[a] -= val(b);
    else if (op === "MUL") R[a] *= val(b);
    else if (op === "INC") { R[a]++; ZF = +(R[a] === 0); }
    else if (op === "DEC") { R[a]--; ZF = +(R[a] === 0); }
    else if (op === "CMP") ZF = +(val(a) === val(b));
    else if (op === "JNZ") { if (!ZF) { var t = labels[(p[1]||"").toLowerCase()]; if (t === undefined) { out.push("error: unknown label '"+p[1]+"'"); break; } PC = t - 1; } }
    else if (op === "OUT") out.push("OUT " + a + " = " + val(a));
    else if (op === "HLT") break;
    else { out.push("error line "+(PC+1)+": unknown op '"+op+"'"); break; }
    if (op === "ADD" || op === "SUB" || op === "MUL") ZF = +(R[a] === 0);
  }
  showRegs(); return out.join("\n");
}
document.getElementById("run").addEventListener("click", function(){
  document.getElementById("cpuOut").textContent = runAsm(document.getElementById("src").value) || "(no output)";
});
document.getElementById("reset").addEventListener("click", function(){
  R = {AX:0,BX:0,CX:0,DX:0}; PC = 0; ZF = 0; showRegs(); document.getElementById("cpuOut").textContent = "";
});

// ---------- shell ----------
var out = document.getElementById("termOut"), inp = document.getElementById("termIn");
function say(t){ var d = document.createElement("div"); d.textContent = t; out.appendChild(d); out.scrollTop = out.scrollHeight; }
var cmds = {
  help: function(){ return "commands: help whoami ls cat <file> date echo <text> theme reboot clear"; },
  whoami: function(){ return "Mark Richard - builder, tinkerer, learner"; },
  ls: function(){ return "readme.asm  projects.c  cpu.lab"; },
  cat: function(a){ return a === "readme.asm" ? "see the readme window" : a ? "cat: "+a+": no such file" : "usage: cat <file>"; },
  date: function(){ return new Date().toString(); },
  echo: function(a){ return a; },
  theme: function(){ var r = document.documentElement.style; var on = r.getPropertyValue("--amber") === "#7ee787"; r.setProperty("--amber", on ? "#ffb000" : "#7ee787"); return "accent: " + (on ? "amber" : "green"); },
  reboot: function(){ location.reload(); return "rebooting..."; },
  clear: function(){ out.innerHTML = ""; return ""; }
};
say("LowOS shell v1.0 - type 'help'");
inp.addEventListener("keydown", function(e){
  if (e.key !== "Enter") return;
  var line = inp.value.trim(); inp.value = ""; if (!line) return;
  say("$ " + line);
  var parts = line.split(" "), c = parts.shift(), f = cmds[c];
  var r = f ? f(parts.join(" ")) : "command not found: " + c + " (try 'help')";
  if (r) say(r);
});

// ---------- loading screen ----------
var lines = ["LowOS BIOS v1.0","memory test ........ 640K OK","cpu: 4 registers ... OK","mounting /home/mark ... done","loading desktop","","Welcome, Mark Richard."],
    bi = 0, pct = 0, bt = document.getElementById("bootText"), boot = document.getElementById("boot"),
    fill = document.getElementById("fill"), pctEl = document.getElementById("pct");
function endBoot(){ clearInterval(bootTimer); boot.style.display = "none"; openWin("welcome"); showRegs(); }
var bootTimer = setInterval(function(){
  pct = Math.min(100, pct + 3);
  fill.style.width = pct + "%"; pctEl.textContent = pct + "%";
  if (pct % 15 === 0 && bi < lines.length) bt.textContent += lines[bi++] + "\n";
  if (pct >= 100) { clearInterval(bootTimer); setTimeout(endBoot, 500); }
}, 90);
boot.addEventListener("click", endBoot);
