// ============================================================
// octano-pdv  -  Modulo TURNO
// ============================================================
// Turno = periodo de operacao do caixa. Abre com valor inicial,
// fecha com resumo. Grava em oct_pdv_turnos.

async function verificarTurnoAberto() {
  const { data } = await sb.from("oct_pdv_turnos")
    .select("*").eq("empresa_id", PDV.empresaId).eq("status", "aberto")
    .order("aberto_em", { ascending: false }).limit(1);
  PDV.turno = (data && data.length) ? data[0] : null;
  return PDV.turno;
}

registrarTela("turno", function (root) {
  if (PDV.turno) { renderFecharTurno(root); }
  else { renderAbrirTurno(root); }
});

function renderAbrirTurno(root) {
  root.innerHTML = `
    <div style="max-width:420px;margin:60px auto;background:#13151f;border:1px solid #2a2d3e;border-radius:12px;padding:28px">
      <h2 style="color:#f97316;margin-bottom:6px">Abrir Turno</h2>
      <p style="color:#888;font-size:0.84rem;margin-bottom:20px">Nenhum turno aberto. Informe o valor de abertura do caixa (fundo de troco).</p>
      <label style="color:#aaa;font-size:0.8rem">Operador</label>
      <input id="t-operador" placeholder="Nome do operador" value="${PDV.operador?.nome || ''}" style="width:100%;padding:10px;margin:6px 0 14px;border-radius:6px;border:1px solid #2a2d3e;background:#0b0d14;color:#fff">
      <label style="color:#aaa;font-size:0.8rem">Valor de abertura (R$)</label>
      <input id="t-valor" type="number" step="0.01" value="0,00" style="width:100%;padding:10px;margin:6px 0 18px;border-radius:6px;border:1px solid #2a2d3e;background:#0b0d14;color:#fff">
      <button onclick="abrirTurno()" style="width:100%;padding:12px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-weight:600;cursor:pointer">Abrir Turno</button>
      <div id="t-msg" style="margin-top:12px;font-size:0.82rem;text-align:center"></div>
    </div>`;
}

async function abrirTurno() {
  const operador = document.getElementById("t-operador").value.trim();
  const valor = parseFloat(document.getElementById("t-valor").value) || 0;
  const msg = document.getElementById("t-msg");
  if (!operador) { msg.style.color = "#f87171"; msg.textContent = "Informe o operador."; return; }
  msg.style.color = "#888"; msg.textContent = "Abrindo turno...";

  // proximo numero de turno
  const { data: ult } = await sb.from("oct_pdv_turnos")
    .select("numero").eq("empresa_id", PDV.empresaId)
    .order("numero", { ascending: false }).limit(1);
  const numero = (ult && ult.length ? ult[0].numero : 0) + 1;

  const { data, error } = await sb.from("oct_pdv_turnos").insert({
    empresa_id: PDV.empresaId,
    numero,
    operador,
    valor_abertura: valor,
    status: "aberto",
    aberto_em: new Date().toISOString(),
  }).select().single();

  if (error) { msg.style.color = "#f87171"; msg.textContent = "Erro: " + error.message; return; }
  PDV.turno = data;
  PDV.operador = { nome: operador };
  montarLayoutPrincipal();
  irPara("venda");
  pdvToast("Turno #" + numero + " aberto.", "sucesso");
}

function renderFecharTurno(root) {
  const t = PDV.turno;
  root.innerHTML = `
    <div style="max-width:480px;margin:50px auto;background:#13151f;border:1px solid #2a2d3e;border-radius:12px;padding:28px">
      <h2 style="color:#f97316;margin-bottom:6px">Turno #${t.numero} aberto</h2>
      <p style="color:#888;font-size:0.84rem;margin-bottom:18px">Aberto em ${new Date(t.aberto_em).toLocaleString("pt-BR")} por ${t.operador}</p>
      <div id="t-resumo" style="color:#ccc;font-size:0.86rem;line-height:1.9;margin-bottom:18px">Carregando resumo...</div>
      <div style="display:flex;gap:10px">
        <button onclick="irPara('venda')" style="flex:1;padding:11px;border-radius:6px;border:1px solid #2a2d3e;background:transparent;color:#60a5fa;cursor:pointer">← Voltar à venda</button>
        <button onclick="fecharTurno()" style="flex:1;padding:11px;border-radius:6px;border:none;background:#dc2626;color:#fff;font-weight:600;cursor:pointer">Fechar Turno</button>
      </div>
      <div id="t-msg" style="margin-top:12px;font-size:0.82rem;text-align:center"></div>
    </div>`;
  carregarResumoTurno();
}

async function carregarResumoTurno() {
  const el = document.getElementById("t-resumo");
  if (!el) return;
  const { data: vendas } = await sb.from("oct_pdv_vendas")
    .select("valor_total,status").eq("turno_id", PDV.turno.id);
  const v = vendas || [];
  const total = v.filter(x => x.status !== "cancelada").reduce((s, x) => s + Number(x.valor_total || 0), 0);
  const qtd = v.filter(x => x.status !== "cancelada").length;
  el.innerHTML = `
    <div>Vendas: <strong>${qtd}</strong></div>
    <div>Total vendido: <strong>R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
    <div>Valor de abertura: R$ ${Number(PDV.turno.valor_abertura || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>`;
}

async function fecharTurno() {
  const msg = document.getElementById("t-msg");
  msg.style.color = "#888"; msg.textContent = "Fechando turno...";
  const { error } = await sb.from("oct_pdv_turnos").update({
    status: "fechado", fechado_em: new Date().toISOString(),
  }).eq("id", PDV.turno.id);
  if (error) { msg.style.color = "#f87171"; msg.textContent = "Erro: " + error.message; return; }
  PDV.turno = null;
  montarLayoutPrincipal();
  irPara("turno");
  pdvToast("Turno fechado.", "sucesso");
}
