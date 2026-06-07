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
    { tecla: "F2", label: "Add Item", fn: "irPara('venda')" },
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
  const map = {
    F1: "pdvFecharVenda", F3: "pdvSelecionarCliente", F4: "pdvDadosClienteManual",
    F5: "pdvCancelarItem", F6: "pdvCancelarCupom", F7: "abrirMenuOperador",
    F8: "abrirMenuGerente",
  };
  if (map[e.key] && typeof window[map[e.key]] === "function") {
    e.preventDefault();
    window[map[e.key]]();
  }
});

// stubs (serao implementados nas proximas fases) - evitam erro ao clicar
function pdvFecharVenda() { if (typeof telaPagamento === "function") telaPagamento(); else pdvToast("Pagamento: proxima fase", "info"); }
function pdvSelecionarCliente() { pdvToast("Consulta de cliente: proxima fase", "info"); }
function pdvDadosClienteManual() { pdvToast("Dados do cliente: proxima fase", "info"); }
function pdvCancelarItem() { if (typeof vendaCancelarItem === "function") vendaCancelarItem(); }
function pdvCancelarCupom() { pdvToast("Cancelar cupom: use Cupons Fiscais (F10)", "info"); }
function abrirMenuOperador() { pdvToast("Menu Operador: proxima fase", "info"); }
function abrirMenuGerente() { pdvToast("Menu Gerente: proxima fase", "info"); }

// inicializa quando a pagina carrega
window.addEventListener("DOMContentLoaded", pdvInit);
