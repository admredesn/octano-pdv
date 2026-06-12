// ============================================================
// octano-pdv  -  Roteador de telas
// ============================================================
// Cada "tela" e uma funcao registrada que renderiza dentro de #pdv-root.
// Telas registram-se com registrarTela(nome, fn). Navega com irPara(nome).

const _telas = {};
let _telaAtual = null;

function registrarTela(nome, fn) { _telas[nome] = fn; }

function irPara(nome, params) {
  const root = document.getElementById("pdv-root");
  if (!root) { console.error("#pdv-root nao encontrado"); return; }
  const tela = _telas[nome];
  if (!tela) { console.error("Tela nao registrada:", nome); return; }
  _telaAtual = nome;
  root.innerHTML = "";
  try {
    tela(root, params || {});
  } catch (e) {
    console.error("Erro ao renderizar tela", nome, e);
    root.innerHTML = `<div style="padding:40px;color:#f87171">Erro ao abrir a tela "${nome}": ${e.message}</div>`;
  }
}

function telaAtual() { return _telaAtual; }

// modal generico (overlay) - usado pelos menus operador/gerente e dialogos
function abrirModal(htmlConteudo, opts) {
  opts = opts || {};
  fecharModal();
  const ov = document.createElement("div");
  ov.id = "pdv-modal-overlay";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000";
  const box = document.createElement("div");
  box.style.cssText = "background:#fff;border-radius:10px;max-width:" + (opts.maxWidth || "560px") + ";width:92%;max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)";
  box.innerHTML = htmlConteudo;
  ov.appendChild(box);
  if (opts.fecharAoClicarFora !== false) {
    ov.addEventListener("click", (e) => { if (e.target === ov) fecharModal(); });
  }
  document.body.appendChild(ov);
  return box;
}
function fecharModal() {
  // trava: se houver captura obrigatória em andamento, não permite fechar
  if (typeof PDV !== "undefined" && PDV._capturaObrigatoria) return;
  const ov = document.getElementById("pdv-modal-overlay");
  if (ov) ov.remove();
}
// fecha o modal ignorando a trava (uso interno, só após concluir a captura)
function fecharModalForcado() {
  const ov = document.getElementById("pdv-modal-overlay");
  if (ov) ov.remove();
}

// toast de mensagens (sucesso/erro/info)
function pdvToast(msg, tipo) {
  const cores = { sucesso: "#16a34a", erro: "#dc2626", info: "#2563eb", alerta: "#d97706" };
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:" +
    (cores[tipo] || cores.info) + ";color:#fff;padding:12px 22px;border-radius:8px;font-size:0.95rem;z-index:2000;box-shadow:0 8px 24px rgba(0,0,0,.3)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), tipo === "erro" ? 5000 : 3000);
}
