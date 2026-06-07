// ============================================================
// octano-pdv  -  CAIXA (sangria/suprimento/despesa/receita) + LEITURA X
// ============================================================

const CAIXA_INFO = {
  suprimento: { titulo: "Suprimento (entrada de troco)", cor: "#16a34a", sinal: "+", desc: "Reforço de caixa / fundo de troco" },
  sangria:    { titulo: "Sangria (retirada)",            cor: "#dc2626", sinal: "−", desc: "Retirada de dinheiro do caixa" },
  despesa:    { titulo: "Despesa",                       cor: "#d97706", sinal: "−", desc: "Pagamento / saída de valor" },
  receita:    { titulo: "Receita",                       cor: "#2563eb", sinal: "+", desc: "Entrada avulsa de valor" },
};

function caixaAbrir(tipo) {
  if (!PDV.turno) { pdvToast("Abra um turno antes de movimentar o caixa.", "alerta"); return; }
  const info = CAIXA_INFO[tipo];
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:${info.cor};margin-bottom:2px">${info.titulo}</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:16px">${info.desc}</p>

      <label style="color:#555;font-size:0.8rem">Valor (R$)</label>
      <input id="cx-valor" type="number" step="0.01" placeholder="0,00" style="width:100%;padding:10px;margin:6px 0 14px;border-radius:6px;border:1px solid #ddd;color:#111;font-size:1.1rem">

      <label style="color:#555;font-size:0.8rem">Descrição / motivo</label>
      <input id="cx-desc" placeholder="ex: ${tipo === 'despesa' ? 'pagamento de água mineral' : tipo === 'sangria' ? 'envio ao cofre' : 'reforço de troco'}" style="width:100%;padding:10px;margin:6px 0 14px;border-radius:6px;border:1px solid #ddd;color:#111">

      <label style="color:#555;font-size:0.8rem">Forma</label>
      <select id="cx-forma" style="width:100%;padding:10px;margin:6px 0 18px;border-radius:6px;border:1px solid #ddd;color:#111">
        <option value="dinheiro">Dinheiro</option>
        <option value="pix">PIX</option>
        <option value="cartao">Cartão</option>
        <option value="outros">Outros</option>
      </select>

      <div style="display:flex;gap:10px">
        <button onclick="abrirMenuOperador()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="cx-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:${info.cor};color:#fff;font-weight:600;cursor:pointer">Registrar ${info.sinal}</button>
      </div>
      <div id="cx-msg" style="margin-top:12px;font-size:0.84rem;text-align:center"></div>
    </div>`, { maxWidth: "420px" });

  box.querySelector("#cx-valor").focus();
  box.querySelector("#cx-salvar").addEventListener("click", () => caixaSalvar(tipo, box));
  box.querySelector("#cx-valor").addEventListener("keydown", (e) => { if (e.key === "Enter") box.querySelector("#cx-desc").focus(); });
}

async function caixaSalvar(tipo, box) {
  const valor = parseFloat(box.querySelector("#cx-valor").value) || 0;
  const desc = box.querySelector("#cx-desc").value.trim();
  const forma = box.querySelector("#cx-forma").value;
  const msg = box.querySelector("#cx-msg");
  if (valor <= 0) { msg.style.color = "#dc2626"; msg.textContent = "Informe um valor maior que zero."; return; }
  msg.style.color = "#888"; msg.textContent = "Registrando...";
  const { error } = await sb.from("oct_pdv_caixa").insert({
    empresa_id: PDV.empresaId, turno_id: PDV.turno.id,
    tipo, valor, descricao: desc || null, forma,
    operador: PDV.operador?.nome || PDV.turno?.operador || null,
  });
  if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
  fecharModal();
  pdvToast(`${CAIXA_INFO[tipo].titulo.split(" ")[0]} de R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} registrada.`, "sucesso");
}

// ---- LEITURA X: resumo do turno (sem fechar) ----
async function leituraX() {
  if (!PDV.turno) { pdvToast("Nenhum turno aberto.", "alerta"); return; }
  const box = abrirModal(`<div style="padding:24px;text-align:center;color:#888">Calculando Leitura X...</div>`, { maxWidth: "460px" });

  const turnoId = PDV.turno.id;
  const [vendasR, caixaR] = await Promise.all([
    sb.from("oct_pdv_vendas").select("valor_total,status,pagamentos").eq("turno_id", turnoId),
    sb.from("oct_pdv_caixa").select("tipo,valor").eq("turno_id", turnoId),
  ]);
  const vendas = (vendasR.data || []).filter(v => v.status !== "cancelada");
  const caixa = caixaR.data || [];

  const totalVendas = vendas.reduce((s, v) => s + Number(v.valor_total || 0), 0);
  const qtdVendas = vendas.length;

  // soma por forma de pagamento
  const porForma = {};
  vendas.forEach(v => (v.pagamentos || []).forEach(p => {
    const nome = FORMA_NOME(p.forma);
    porForma[nome] = (porForma[nome] || 0) + Number(p.valor || 0);
  }));

  const soma = (tipo) => caixa.filter(c => c.tipo === tipo).reduce((s, c) => s + Number(c.valor || 0), 0);
  const suprimento = soma("suprimento"), sangria = soma("sangria"), despesa = soma("despesa"), receita = soma("receita");
  const abertura = Number(PDV.turno.valor_abertura || 0);

  // saldo em dinheiro estimado: abertura + vendas em dinheiro + suprimento + receita - sangria - despesa
  const vendasDinheiro = porForma["Dinheiro"] || 0;
  const saldoDinheiro = abertura + vendasDinheiro + suprimento + receita - sangria - despesa;

  const linha = (lbl, val, cor) => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.88rem"><span style="color:#aaa">${lbl}</span><span style="color:${cor || '#ddd'};font-weight:600">R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>`;
  const formasHtml = Object.keys(porForma).length
    ? Object.entries(porForma).map(([k, v]) => linha(k, v)).join("")
    : '<div style="color:#666;font-size:0.82rem;padding:4px 0">Nenhuma venda ainda</div>';

  box.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 style="color:#f97316">Leitura X</h2>
        <span style="color:#888;font-size:0.8rem">Turno #${PDV.turno.numero}</span>
      </div>
      <p style="color:#888;font-size:0.74rem;margin-bottom:16px">Resumo parcial (não fecha o turno) · ${new Date().toLocaleString("pt-BR")}</p>

      <div style="background:#0d0f17;border-radius:8px;padding:12px 14px;margin-bottom:12px">
        <div style="color:#f97316;font-size:0.74rem;text-transform:uppercase;margin-bottom:4px">Vendas</div>
        ${linha("Total vendido (" + qtdVendas + " vendas)", totalVendas, "#4ade80")}
        <div style="border-top:1px solid #1a1d2e;margin:8px 0"></div>
        ${formasHtml}
      </div>

      <div style="background:#0d0f17;border-radius:8px;padding:12px 14px;margin-bottom:12px">
        <div style="color:#f97316;font-size:0.74rem;text-transform:uppercase;margin-bottom:4px">Caixa</div>
        ${linha("Abertura (fundo de troco)", abertura)}
        ${linha("Suprimentos", suprimento, "#4ade80")}
        ${linha("Receitas", receita, "#4ade80")}
        ${linha("Sangrias", sangria, "#f87171")}
        ${linha("Despesas", despesa, "#f87171")}
        <div style="border-top:1px solid #1a1d2e;margin:8px 0"></div>
        ${linha("Saldo em dinheiro (estimado)", saldoDinheiro, "#4ade80")}
      </div>

      <div style="display:flex;gap:10px">
        <button onclick="abrirMenuOperador()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #2a2d3e;background:transparent;color:#60a5fa;cursor:pointer">← Menu</button>
        <button onclick="fecharModal()" style="flex:1;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">OK</button>
      </div>
    </div>`;
}

// mapeia codigo de forma de pagamento -> nome legivel (usa FORMAS_PAG do pagamento.js se existir)
function FORMA_NOME(cod) {
  const map = { "01": "Dinheiro", "17": "PIX", "03": "Cartão Crédito", "04": "Cartão Débito", "99": "Prazo / Outros" };
  return map[cod] || cod || "Outros";
}
