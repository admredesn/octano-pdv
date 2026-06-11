// ============================================================
// octano-pdv  -  Modulo PAGAMENTO + PRE-TRANSMISSAO
// ============================================================

// fallback caso o banco nao tenha formas cadastradas
const FORMAS_PAG_FALLBACK = [
  { cod: "01", nome: "Dinheiro" },
  { cod: "17", nome: "PIX" },
  { cod: "03", nome: "Cartão Crédito" },
  { cod: "04", nome: "Cartão Débito" },
  { cod: "99", nome: "Prazo / Outros" },
];
// cache das formas vindas do retaguarda (oct_formas_pagamento)
let _formasPag = null;

// carrega as formas de pagamento configuradas no retaguarda (cacheado).
async function pdvCarregarFormasPag() {
  if (_formasPag) return _formasPag;
  try {
    const { data, error } = await sb.from("oct_formas_pagamento")
      .select("nome,cod_sefaz,a_prazo,ordem,ativo")
      .eq("empresa_id", PDV.empresaId).eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw error;
    if (data && data.length) {
      _formasPag = data.map(f => ({ cod: f.cod_sefaz, nome: f.nome, a_prazo: f.a_prazo }));
    } else {
      _formasPag = FORMAS_PAG_FALLBACK;
    }
  } catch (e) {
    console.error("formas de pagamento: usando fallback", e);
    _formasPag = FORMAS_PAG_FALLBACK;
  }
  return _formasPag;
}
// usada para resolver o nome a partir do codigo
function pdvFormaNome(cod) {
  const lista = _formasPag || FORMAS_PAG_FALLBACK;
  return (lista.find(f => f.cod === cod) || {}).nome || cod;
}

// chamado pelo botao "Fechar Venda" (F1)
async function telaPagamento() {
  if (!PDV.venda.itens.length) { pdvToast("Adicione itens antes de fechar a venda.", "alerta"); return; }
  const formas = await pdvCarregarFormasPag();
  const total = PDV.totalVenda();
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:4px">Pagamento</h2>
      <p style="color:#888;font-size:0.85rem;margin-bottom:16px">Total da venda: <strong style="color:#16a34a;font-size:1.1rem">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>

      <label style="color:#555;font-size:0.8rem">Forma de pagamento</label>
      <div id="pg-formas" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px"></div>

      <label style="color:#555;font-size:0.8rem">CPF/CNPJ no cupom (opcional)</label>
      <input id="pg-cpf" value="${PDV.venda.clienteManual?.cpf || PDV.venda.cliente?.documento || ''}" placeholder="só números (opcional)" style="width:100%;padding:9px;margin:6px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">
      ${PDV.venda.cliente ? `<p style="color:#16a34a;font-size:0.76rem;margin:-10px 0 14px">★ Cliente: ${PDV.venda.cliente.nome} (acumula pontos)</p>` : ""}

      <label style="color:#555;font-size:0.8rem">Ambiente</label>
      <select id="pg-ambiente" style="width:100%;padding:9px;margin:6px 0 18px;border-radius:6px;border:1px solid #ddd;color:#111">
        <option value="homologacao">Homologação (teste)</option>
        <option value="producao">Produção</option>
      </select>

      <div style="display:flex;gap:10px">
        <button onclick="fecharModal()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Cancelar</button>
        <button id="pg-continuar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">Conferir e transmitir →</button>
      </div>
    </div>`, { maxWidth: "440px" });

  // estado local da forma escolhida (inicia na primeira disponivel)
  let formaSel = formas[0]?.cod || "01";
  const elFormas = box.querySelector("#pg-formas");
  const render = () => {
    elFormas.innerHTML = formas.map(f => `
      <button onclick="window.__pgSel('${f.cod}')" style="padding:8px 12px;border-radius:6px;border:2px solid ${formaSel === f.cod ? '#f97316' : '#ddd'};background:${formaSel === f.cod ? '#fff7ed' : '#fff'};color:#111;cursor:pointer;font-size:0.85rem">${f.nome}</button>`).join("");
  };
  window.__pgSel = (cod) => { formaSel = cod; render(); };
  render();

  box.querySelector("#pg-continuar").addEventListener("click", () => {
    let cpf = (box.querySelector("#pg-cpf").value || "").replace(/\D/g, "");
    // fallback: se nao digitou, usa o doc manual (F4) ou o documento do cliente selecionado
    if (!cpf) cpf = (PDV.venda.clienteManual?.cpf || PDV.venda.cliente?.documento || "").replace(/\D/g, "");
    const ambiente = box.querySelector("#pg-ambiente").value;
    telaPreTransmissao({ tpag: formaSel, cpf, ambiente, total });
  });
}

// tela de pre-transmissao: confere os itens antes de emitir
function telaPreTransmissao(opts) {
  const itensHtml = PDV.venda.itens.map((it, i) => {
    const f = it.fiscal || {};
    const alerta = (!f.ncm || !f.cfop || !f.cst_icms) ? ' <span style="color:#dc2626">⚠ dados fiscais incompletos</span>' : '';
    return `<tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 4px">${i + 1}</td>
      <td style="padding:6px 4px">${it.desc}${alerta}</td>
      <td style="padding:6px 4px;text-align:right">${Number(it.qtd).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</td>
      <td style="padding:6px 4px;text-align:right">${Number(it.unit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
      <td style="padding:6px 4px;text-align:right">${Number(it.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
    </tr>`;
  }).join("");
  const formaNome = pdvFormaNome(opts.tpag);

  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:4px">Conferência (pré-transmissão)</h2>
      <p style="color:#888;font-size:0.82rem;margin-bottom:14px">Confira os itens antes de transmitir a NFC-e à SEFAZ.</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem;color:#111">
        <thead><tr style="color:#888;text-align:left;border-bottom:2px solid #eee">
          <th style="padding:6px 4px">#</th><th style="padding:6px 4px">Produto</th>
          <th style="padding:6px 4px;text-align:right">Qtd</th><th style="padding:6px 4px;text-align:right">Unit.</th><th style="padding:6px 4px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${itensHtml}</tbody>
      </table>
      <div style="margin-top:14px;font-size:0.86rem;color:#111;line-height:1.8">
        <div>Pagamento: <strong>${formaNome}</strong></div>
        <div>CPF/CNPJ: <strong>${opts.cpf || "não informado"}</strong></div>
        <div>Ambiente: <strong>${opts.ambiente === "producao" ? "PRODUÇÃO" : "Homologação"}</strong></div>
        <div style="margin-top:6px;font-size:1.05rem">Total: <strong style="color:#16a34a">R$ ${opts.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button onclick="telaPagamento()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="pt-transmitir" style="flex:2;padding:11px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-weight:700;cursor:pointer">✓ Transmitir NFC-e</button>
      </div>
      <div id="pt-msg" style="margin-top:12px;font-size:0.84rem;text-align:center"></div>
    </div>`, { maxWidth: "560px" });

  box.querySelector("#pt-transmitir").addEventListener("click", async () => {
    const btn = box.querySelector("#pt-transmitir");
    const msg = box.querySelector("#pt-msg");
    btn.disabled = true; btn.style.opacity = "0.6";
    msg.style.color = "#888"; msg.textContent = "📡 Transmitindo à SEFAZ...";
    const r = await pdvEmitirNfce({ cpf: opts.cpf, tpag: opts.tpag, ambiente: opts.ambiente, pagamentos: [{ forma: opts.tpag, valor: opts.total }] });
    if (r.ok) {
      fecharModal();
      pdvToast("✓ NFC-e autorizada! Protocolo " + r.protocolo, "sucesso");
      PDV.limparVenda();
      mostrarResultadoVenda(r);
    } else {
      btn.disabled = false; btn.style.opacity = "1";
      msg.style.color = "#dc2626"; msg.textContent = "❌ " + r.erro;
      console.error("Falha emissao NFC-e:", r.raw);
    }
  });
}

// apos emitir: mostra resultado com opcoes de imprimir / nova venda
function mostrarResultadoVenda(r) {
  // guarda o xml ANTES de montar o modal (botao usa o global, sem embutir XML no HTML)
  window.__ultimoCupom = { xml: r.xml, chave: r.chave };
  const qr = r.qrcode
    ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(r.qrcode)}" style="background:#fff;padding:6px;border-radius:8px;margin:0 auto 14px;display:block"/>`
    : "";
  abrirModal(`
    <div style="padding:20px 22px;text-align:center">
      <div style="font-size:2rem;margin-bottom:2px">✅</div>
      <h2 style="color:#16a34a;margin-bottom:2px;font-size:1.2rem">NFC-e Autorizada</h2>
      <p style="color:#555;font-size:0.8rem;margin-bottom:2px">Nº ${r.numero} · Protocolo ${r.protocolo}</p>
      <p style="color:#aaa;font-size:0.66rem;word-break:break-all;margin-bottom:12px">${r.chave}</p>
      ${r.pontosGanhos > 0 ? `<p style="color:#16a34a;font-size:0.84rem;margin-bottom:10px">★ +${r.pontosGanhos} pontos de fidelidade</p>` : ""}
      ${qr}
      <div style="display:flex;gap:10px">
        <button onclick="pdvImprimirCupom()" style="flex:1;padding:11px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer">🖨️ Imprimir</button>
        <button onclick="fecharModal();irPara('venda')" style="flex:1;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">Nova venda →</button>
      </div>
    </div>`, { maxWidth: "340px", fecharAoClicarFora: false });
}

// imprime o cupom (DANFCE) via servidor SEFAZ
async function pdvImprimirCupom() {
  const dados = window.__ultimoCupom || {};
  const xml = dados.xml;
  if (!xml) { pdvToast("XML do cupom não disponível.", "erro"); return; }
  pdvToast("🖨️ Gerando cupom...", "info");
  try {
    const resp = await fetch(`${SEFAZ_URL}/danfce`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml }),
    });
    if (!resp.ok) { let d = ""; try { d = (await resp.json()).erro || ""; } catch (e) {} throw new Error(d || ("HTTP " + resp.status)); }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) {
    pdvToast("Erro ao gerar cupom: " + e.message, "erro");
  }
}
