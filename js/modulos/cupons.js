// ============================================================
// octano-pdv  -  Modulo CUPONS FISCAIS (NFC-e)
// ============================================================
// Lista NFC-e emitidas, reimprime (DANFCE) e cancela (evento 110111).

registrarTela("cupons", function (root) {
  root.innerHTML = `
    <div style="max-width:1000px;margin:24px auto;padding:0 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="color:#f97316">Cupons Fiscais (NFC-e)</h2>
        <button onclick="irPara('venda')" style="padding:7px 14px;border-radius:6px;border:1px solid #2a2d3e;background:#13151f;color:#60a5fa;cursor:pointer">← Voltar à venda</button>
      </div>
      <div id="cp-lista" style="background:#13151f;border:1px solid #2a2d3e;border-radius:10px;overflow:auto">
        <p style="padding:24px;color:#888;text-align:center">Carregando...</p>
      </div>
      <div id="cp-msg" style="margin-top:10px;font-size:0.84rem;text-align:center"></div>
    </div>`;
  cpCarregarLista();
});

async function cpCarregarLista() {
  const el = document.getElementById("cp-lista");
  if (!el) return;
  const { data: notas } = await sb.from("oct_nfce")
    .select("id,numero,serie,chave_nfe,protocolo,valor_total,status,ambiente,data_emissao,xml_autorizado")
    .eq("empresa_id", PDV.empresaId).eq("modelo", "65")
    .order("data_emissao", { ascending: false }).limit(80);
  window.__cpNotas = notas || [];
  if (!notas || !notas.length) {
    el.innerHTML = '<p style="padding:30px;color:#555;text-align:center">Nenhuma NFC-e emitida ainda.</p>';
    return;
  }
  const linhas = notas.map((n, i) => {
    const dt = n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—";
    const cor = n.status === "autorizada" ? "#4ade80" : n.status === "cancelada" ? "#f87171" : "#888";
    const podeCancelar = n.status === "autorizada" && n.chave_nfe && n.protocolo;
    return `<tr style="border-bottom:1px solid #1a1d2e">
      <td style="padding:8px">${n.numero || "—"}</td>
      <td style="padding:8px">${dt}</td>
      <td style="padding:8px;text-align:right">R$ ${Number(n.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
      <td style="padding:8px"><span style="color:${cor};font-weight:600">${n.status}</span></td>
      <td style="padding:8px;font-size:0.7rem;color:#888">${n.ambiente || ""}</td>
      <td style="padding:8px;text-align:center;white-space:nowrap">
        <button onclick="cpImprimir(${i})" title="Reimprimir" style="padding:4px 9px;border-radius:4px;border:none;background:#2563eb;color:#fff;cursor:pointer">🖨️</button>
        ${podeCancelar ? `<button onclick="cpCancelar(${i})" title="Cancelar" style="padding:4px 9px;border-radius:4px;border:1px solid #5a2a2a;background:transparent;color:#f87171;cursor:pointer;margin-left:4px">✕</button>` : ""}
      </td>
    </tr>`;
  }).join("");
  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.84rem;color:#ddd">
      <thead><tr style="color:#888;text-align:left;background:#1a1d2e">
        <th style="padding:8px">Nº</th><th style="padding:8px">Emissão</th>
        <th style="padding:8px;text-align:right">Total</th><th style="padding:8px">Status</th>
        <th style="padding:8px">Amb.</th><th style="padding:8px;text-align:center">Ações</th>
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

async function cpImprimir(i) {
  const n = (window.__cpNotas || [])[i];
  const msg = document.getElementById("cp-msg");
  if (!n || !n.xml_autorizado) { if (msg) { msg.style.color = "#f87171"; msg.textContent = "Esta nota não tem XML salvo."; } return; }
  if (msg) { msg.style.color = "#888"; msg.textContent = "🖨️ Gerando cupom..."; }
  try {
    const resp = await fetch(`${SEFAZ_URL}/danfce`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml: n.xml_autorizado }),
    });
    if (!resp.ok) { let d = ""; try { d = (await resp.json()).erro || ""; } catch (e) {} throw new Error(d || ("HTTP " + resp.status)); }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    if (msg) { msg.style.color = "#4ade80"; msg.textContent = "✓ Cupom gerado."; }
  } catch (e) {
    if (msg) { msg.style.color = "#f87171"; msg.textContent = "Erro: " + e.message; }
  }
}

async function cpCancelar(i) {
  const n = (window.__cpNotas || [])[i];
  const msg = document.getElementById("cp-msg");
  const set = (t, c) => { if (msg) { msg.style.color = c; msg.textContent = t; } };
  if (!n) return;
  const just = prompt("Justificativa do cancelamento (mínimo 15 caracteres):", "");
  if (just === null) return;
  if (just.trim().length < 15) { set("Justificativa deve ter ao menos 15 caracteres.", "#f87171"); return; }
  set("📡 Cancelando...", "#888");
  try {
    const resp = await fetch(`${SEFAZ_URL}/cancelar-nfce-empresa`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa_id: PDV.empresaId,
        chave: n.chave_nfe, protocolo: n.protocolo,
        justificativa: just.trim(), ambiente: n.ambiente || "homologacao",
      }),
    });
    const r = await resp.json();
    if (r.ok) {
      set("✓ NFC-e cancelada! Protocolo " + (r.protocolo_cancelamento || ""), "#4ade80");
      await sb.from("oct_nfce").update({ status: "cancelada", motivo_rejeicao: just.trim() }).eq("id", n.id);
      await sb.from("oct_pdv_vendas").update({ nfce_status: "cancelada", status: "cancelada" }).eq("nfce_chave", n.chave_nfe);
      setTimeout(() => cpCarregarLista(), 1200);
    } else {
      set("❌ " + (r.cstat_evento || r.cstat_lote || "") + " " + (r.xmotivo || r.erro || "falha"), "#f87171");
    }
  } catch (e) {
    set("Erro ao cancelar: " + e.message, "#f87171");
  }
}
