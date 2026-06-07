// ============================================================
// octano-pdv  -  NOTA A PRAZO (fiado) + TRANSFORMAR CUPOM EM NF-e
// ============================================================

// ---- NOTA A PRAZO (fiado) ----
function prazoAbrir() {
  if (!PDV.turno) { pdvToast("Abra um turno antes.", "alerta"); return; }
  const cli = PDV.venda.cliente;
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#d97706;margin-bottom:2px">Venda a Prazo (Fiado)</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Registra um valor a receber. ${cli ? "Cliente da venda: <strong>" + cli.nome + "</strong>" : "Selecione um cliente (F3) ou informe abaixo."}</p>

      ${!cli ? `
      <label style="color:#555;font-size:0.78rem">Cliente (nome)</label>
      <input id="pz-nome" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <label style="color:#555;font-size:0.78rem">CPF/CNPJ</label>
      <input id="pz-doc" placeholder="só números" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      ` : ""}

      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="color:#555;font-size:0.78rem">Valor (R$)</label>
          <input id="pz-valor" type="number" step="0.01" value="${PDV.totalVenda() > 0 ? PDV.totalVenda().toFixed(2) : ''}" placeholder="0,00" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
        <div style="flex:1">
          <label style="color:#555;font-size:0.78rem">Vencimento</label>
          <input id="pz-venc" type="date" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
      </div>

      <label style="color:#555;font-size:0.78rem">Descrição (opcional)</label>
      <input id="pz-desc" placeholder="ex: abastecimento gasolina" style="width:100%;padding:10px;margin:5px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">

      <div style="display:flex;gap:10px">
        <button onclick="fecharModal()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Cancelar</button>
        <button id="pz-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#d97706;color:#fff;font-weight:600;cursor:pointer">Registrar a prazo</button>
      </div>
      <div id="pz-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "460px" });
  box.querySelector("#pz-valor").focus();
  box.querySelector("#pz-salvar").addEventListener("click", () => prazoSalvar(box));
}

async function prazoSalvar(box) {
  const cli = PDV.venda.cliente;
  const valor = parseFloat(box.querySelector("#pz-valor").value) || 0;
  const venc = box.querySelector("#pz-venc").value || null;
  const desc = box.querySelector("#pz-desc").value.trim();
  const msg = box.querySelector("#pz-msg");
  const nome = cli ? cli.nome : (box.querySelector("#pz-nome")?.value.trim() || "");
  const doc = cli ? cli.documento : (box.querySelector("#pz-doc")?.value.replace(/\D/g, "") || "");
  if (!nome) { msg.style.color = "#dc2626"; msg.textContent = "Informe o cliente."; return; }
  if (valor <= 0) { msg.style.color = "#dc2626"; msg.textContent = "Informe o valor."; return; }
  msg.style.color = "#888"; msg.textContent = "Registrando...";
  const { error } = await sb.from("oct_pdv_prazo").insert({
    empresa_id: PDV.empresaId, turno_id: PDV.turno.id,
    cliente_id: cli?.id || null, cliente_nome: nome, cliente_doc: doc || null,
    valor, descricao: desc || null, vencimento: venc, status: "aberto",
    operador: PDV.operador?.nome || PDV.turno?.operador || null,
  });
  if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
  fecharModal();
  pdvToast(`Venda a prazo de R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} registrada para ${nome}.`, "sucesso");
}

// lista contas a prazo em aberto + baixa (marcar pago)
async function prazoListar() {
  const box = abrirModal(`<div style="padding:24px;text-align:center;color:#888">Carregando contas a prazo...</div>`, { maxWidth: "520px" });
  const { data } = await sb.from("oct_pdv_prazo").select("*").eq("empresa_id", PDV.empresaId).eq("status", "aberto").order("data_mov", { ascending: false }).limit(50);
  const total = (data || []).reduce((s, p) => s + Number(p.valor || 0), 0);
  const linhas = (data || []).length
    ? data.map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee">
        <div>
          <div style="color:#111;font-weight:600;font-size:0.88rem">${p.cliente_nome}</div>
          <div style="color:#888;font-size:0.74rem">${p.descricao || ""}${p.vencimento ? " · vence " + new Date(p.vencimento + "T00:00").toLocaleDateString("pt-BR") : ""}</div>
        </div>
        <div style="text-align:right">
          <div style="color:#d97706;font-weight:700">R$ ${Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <span onclick="prazoBaixar('${p.id}')" style="color:#16a34a;font-size:0.74rem;cursor:pointer">marcar pago</span>
        </div>
      </div>`).join("")
    : '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhuma conta a prazo em aberto.</p>';
  box.innerHTML = `
    <div style="padding:22px">
      <h2 style="color:#d97706;margin-bottom:4px">Contas a Prazo (em aberto)</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Total a receber: <strong style="color:#d97706">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
      <div style="max-height:340px;overflow:auto">${linhas}</div>
      <button onclick="fecharModal()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Fechar</button>
    </div>`;
}

async function prazoBaixar(id) {
  await sb.from("oct_pdv_prazo").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", id);
  pdvToast("Conta marcada como paga.", "sucesso");
  prazoListar();
}

// ---- TRANSFORMAR CUPOM (NFC-e) EM NF-e mod 55 ----
// Lista NFC-e autorizadas e permite gerar uma NF-e modelo 55 a partir dela.
async function cupomParaNfe() {
  const box = abrirModal(`<div style="padding:24px;text-align:center;color:#888">Carregando cupons...</div>`, { maxWidth: "520px" });
  const { data } = await sb.from("oct_nfce").select("id,numero,chave_nfe,valor_total,status,data_emissao").eq("empresa_id", PDV.empresaId).eq("modelo", "65").eq("status", "autorizada").order("numero", { ascending: false }).limit(30);
  const linhas = (data || []).length
    ? data.map(n => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee">
        <div>
          <div style="color:#111;font-weight:600;font-size:0.88rem">NFC-e nº ${n.numero}</div>
          <div style="color:#888;font-size:0.7rem">${n.chave_nfe || ""}</div>
        </div>
        <div style="text-align:right">
          <div style="color:#16a34a;font-weight:700">R$ ${Number(n.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <span style="color:#999;font-size:0.72rem">gerar NF-e (em breve)</span>
        </div>
      </div>`).join("")
    : '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhum cupom autorizado.</p>';
  box.innerHTML = `
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:4px">Transformar Cupom em NF-e</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Selecione um cupom (NFC-e) para gerar uma NF-e modelo 55 equivalente.</p>
      <div style="background:#fef3c7;border-radius:6px;padding:10px;margin-bottom:12px;color:#92400e;font-size:0.78rem">⚠ A geração de NF-e a partir do cupom será habilitada quando confirmarmos a regra fiscal (CFOP de saída e destinatário identificado). Por ora, lista os cupons disponíveis.</p>
      <div style="max-height:300px;overflow:auto">${linhas}</div>
      <button onclick="fecharModal()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Fechar</button>
    </div>`;
}
