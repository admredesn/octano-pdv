// ============================================================
// octano-pdv  -  Layout principal + inicializacao
// ============================================================

function montarLayoutPrincipal() {
  const app = document.getElementById("pdv-app");
  if (!app) return;
  const emp = PDV.empresa || {};
  app.innerHTML = `
    <div id="pdv-header" style="background:#1a1f3a;color:#fff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #f97316">
      <div style="display:flex;align-items:center;gap:14px">
        <strong style="color:#f97316;font-size:1.1rem">OCTANO PDV</strong>
        <span style="font-size:0.92rem">${emp.nome || "—"}</span>
      </div>
      <div style="display:flex;align-items:center;gap:18px;font-size:0.82rem">
        <span id="pdv-h-cliente" onclick="pdvSelecionarCliente()" title="F3 - trocar cliente"
          style="display:flex;align-items:center;gap:6px;background:#2a2d3e;padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid #3a3f5a">
          <span style="color:#9aa">👤 Cliente:</span>
          <strong id="pdv-h-cliente-nome" style="color:#4ade80">Consumidor Final</strong>
        </span>
        <span>Operador: <strong id="pdv-h-operador">${PDV.operador?.nome || "—"}</strong></span>
        <span>Turno: <strong id="pdv-h-turno" style="color:${PDV.turno ? '#4ade80' : '#f87171'}">${PDV.turno ? "ABERTO #" + PDV.turno.numero : "FECHADO"}</strong></span>
        <span id="pdv-h-relogio"></span>
        <button onclick="pdvLogout()" style="background:#2a2d3e;color:#fff;border:none;padding:5px 12px;border-radius:5px;cursor:pointer">Sair</button>
      </div>
    </div>
    <div id="pdv-root" style="min-height:calc(100vh - 110px)"></div>
    <div id="pdv-barra-acoes" style="background:#13151f;border-top:1px solid #2a2d3e;padding:8px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center"></div>
  `;
  iniciarRelogio();
  montarBarraAcoes();
}

function iniciarRelogio() {
  const el = document.getElementById("pdv-h-relogio");
  if (!el) return;
  const tick = () => {
    const d = new Date();
    el.textContent = d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
  };
  tick();
  clearInterval(window.__pdvRelogio);
  window.__pdvRelogio = setInterval(tick, 1000);
}

// barra de acoes (rodape) - estilo legado com teclas de funcao
function montarBarraAcoes() {
  const barra = document.getElementById("pdv-barra-acoes");
  if (!barra) return;
  const acoes = [
    { tecla: "F1", label: "Fechar Venda", fn: "pdvFecharVenda()" },
    { tecla: "F2", label: "Add Item", fn: "pdvAddItem()" },
    { tecla: "F3", label: "Cliente", fn: "pdvSelecionarCliente()" },
    { tecla: "F4", label: "Dados Cliente", fn: "pdvDadosClienteManual()" },
    { tecla: "F5", label: "Cancelar Item", fn: "pdvCancelarItem()" },
    { tecla: "F6", label: "Cancelar Cupom", fn: "pdvCancelarCupom()" },
    { tecla: "F7", label: "Menu Operador", fn: "abrirMenuOperador()" },
    { tecla: "F8", label: "Menu Gerente", fn: "abrirMenuGerente()" },
    { tecla: "F10", label: "Cupons Fiscais", fn: "irPara('cupons')" },
  ];
  barra.innerHTML = acoes.map(a => `
    <button onclick="${a.fn}" style="background:#1a1f3a;color:#fff;border:1px solid #2a2d3e;border-radius:6px;padding:6px 10px;cursor:pointer;min-width:88px;text-align:center">
      <div style="font-size:0.7rem;color:#f97316;font-weight:700">${a.tecla}</div>
      <div style="font-size:0.74rem">${a.label}</div>
    </button>`).join("");
}

// atalhos de teclado (F1..F12)
document.addEventListener("keydown", (e) => {
  if (!PDV.empresa) return; // so depois de logado
  // trava: durante captura obrigatória, ignora todas as teclas (ESC, F1-F8, etc.)
  if (PDV._capturaObrigatoria) { e.preventDefault(); e.stopPropagation(); return; }
  const map = {
    F1: "pdvFecharVenda", F2: "pdvAddItem", F3: "pdvSelecionarCliente", F4: "pdvDadosClienteManual",
    F5: "pdvCancelarItem", F6: "pdvCancelarCupom", F7: "abrirMenuOperador",
    F8: "abrirMenuGerente",
  };
  if (map[e.key] && typeof window[map[e.key]] === "function") {
    e.preventDefault();
    window[map[e.key]]();
    return;
  }
  if (e.key === "Escape") {
    pdvTratarEsc();
  }
});

// ---- "voltar para casa" (tela de abastecimentos pendentes = 'venda') ----
const PDV_TELA_PADRAO = "venda";
let _escTimer = null;       // janela de tempo para contar o 2o ESC
let _inatividadeTimer = null;

function _temModalAberto() {
  return !!document.getElementById("pdv-modal-overlay");
}

// ESC: 1o fecha modal (se houver); 2 ESCs seguidos (sem modal) voltam pra casa.
function pdvTratarEsc() {
  if (!PDV.empresa) return;
  if (_temModalAberto()) {
    fecharModal();
    _armarSegundoEsc();
    return;
  }
  if (_escTimer) {
    clearTimeout(_escTimer); _escTimer = null;
    pdvVoltarParaCasa();
  } else {
    _armarSegundoEsc();
  }
}

function _armarSegundoEsc() {
  if (_escTimer) clearTimeout(_escTimer);
  _escTimer = setTimeout(() => { _escTimer = null; }, 1500);
}

function pdvVoltarParaCasa() {
  if (typeof telaAtual === "function" && telaAtual() !== PDV_TELA_PADRAO) {
    irPara(PDV_TELA_PADRAO);
  }
}

function _resetarInatividade() {
  if (_inatividadeTimer) clearTimeout(_inatividadeTimer);
  _inatividadeTimer = setTimeout(() => {
    if (!PDV.empresa) return;
    if (_temModalAberto()) { _resetarInatividade(); return; }
    if (typeof telaAtual === "function" && telaAtual() !== PDV_TELA_PADRAO) {
      pdvVoltarParaCasa();
    }
  }, 60000);
}

["mousedown", "keydown", "mousemove", "touchstart", "wheel"].forEach(ev => {
  document.addEventListener(ev, _resetarInatividade, { passive: true });
});
_resetarInatividade();

function pdvFecharVenda() { if (typeof telaPagamento === "function") telaPagamento(); else pdvToast("Pagamento: proxima fase", "info"); }
function pdvCancelarItem() { if (typeof vendaCancelarItem === "function") vendaCancelarItem(); }
function pdvAddItem() { if (typeof vendaAbrirBuscaProduto === "function") vendaAbrirBuscaProduto(); else pdvToast("Abra a tela de venda primeiro.", "info"); }

function pdvAtualizarIndicadorCliente() {
  const el = document.getElementById("pdv-h-cliente-nome");
  if (!el) return;
  const v = PDV.venda || {};
  if (v.cliente && v.cliente.nome) {
    el.textContent = v.cliente.nome;
    el.style.color = "#fbbf24";
  } else if (v.clienteManual && (v.clienteManual.nome || v.clienteManual.cpf)) {
    el.textContent = v.clienteManual.nome || ("CPF " + v.clienteManual.cpf);
    el.style.color = "#fbbf24";
  } else {
    el.textContent = "Consumidor Final";
    el.style.color = "#4ade80";
  }
}
function pdvCancelarCupom() { pdvToast("Cancelar cupom: use Cupons Fiscais (F10)", "info"); }

window.addEventListener("DOMContentLoaded", pdvInit);
