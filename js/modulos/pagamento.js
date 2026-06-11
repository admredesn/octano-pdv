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
      .select("id,nome,cod_sefaz,a_prazo,ordem,ativo")
      .eq("empresa_id", PDV.empresaId).eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw error;
    if (data && data.length) {
      _formasPag = data.map(f => ({ id: f.id, cod: f.cod_sefaz, nome: f.nome, a_prazo: f.a_prazo }));
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

// Aplica a tabela de preço quando há cliente vinculado E a forma escolhida
// está entre as formas da tabela. Ajusta o preço/litro (volume intacto).
// Guarda o preço original em it._unitOriginal para poder reverter.
async function pdvAplicarTabelaPreco(codForma, formas, box) {
  const elAjuste = box.querySelector("#pg-ajuste");
  const elTotalLbl = box.querySelector("#pg-total-lbl");
  const cliente = PDV.venda.cliente;

  // garante o preço original guardado em cada item
  PDV.venda.itens.forEach(it => { if (it._unitOriginal == null) it._unitOriginal = Number(it.unit || 0); });

  // função para reverter ao preço original
  const reverter = () => {
    PDV.venda.itens.forEach(it => {
      it.unit = it._unitOriginal;
      it.total = Number(it.qtd || 0) * Number(it.unit || 0);
    });
  };

  if (!cliente || !cliente.id) { reverter(); if (elAjuste) elAjuste.innerHTML = ""; atualizaTotalPg(elTotalLbl); return; }

  // id da forma escolhida (codForma é o cod_sefaz; precisamos do id da forma)
  const forma = (formas || []).find(f => f.cod === codForma);
  // buscamos as formas com id para casar — recarrega com id
  let formaId = forma?.id;
  if (!formaId) {
    const { data: fdata } = await sb.from("oct_formas_pagamento")
      .select("id,cod_sefaz,nome").eq("empresa_id", PDV.empresaId).eq("cod_sefaz", codForma).limit(5);
    // se houver mais de uma forma com mesmo cod_sefaz, tenta casar pelo nome exibido
    if (fdata && fdata.length) {
      const nomeSel = (formas.find(f => f.cod === codForma) || {}).nome;
      formaId = (fdata.find(f => f.nome === nomeSel) || fdata[0]).id;
    }
  }
  if (!formaId) { reverter(); if (elAjuste) elAjuste.innerHTML = ""; atualizaTotalPg(elTotalLbl); return; }

  // tabelas vinculadas a este cliente
  const { data: tabsCli } = await sb.from("oct_tabela_preco_clientes")
    .select("tabela_id").eq("cliente_id", cliente.id);
  const tabelaIds = (tabsCli || []).map(t => t.tabela_id);
  if (!tabelaIds.length) { reverter(); if (elAjuste) elAjuste.innerHTML = ""; atualizaTotalPg(elTotalLbl); return; }

  // entre essas, qual está vinculada à forma escolhida
  const { data: tabsForma } = await sb.from("oct_tabela_preco_formas")
    .select("tabela_id").in("tabela_id", tabelaIds).eq("forma_id", formaId);
  const tabelaIdAplicavel = (tabsForma || [])[0]?.tabela_id;
  if (!tabelaIdAplicavel) { reverter(); if (elAjuste) elAjuste.innerHTML = ""; atualizaTotalPg(elTotalLbl); return; }

  // carrega a condição e suas exceções por produto
  const [{ data: tabela }, { data: excecoes }] = await Promise.all([
    sb.from("oct_tabelas_preco").select("*").eq("id", tabelaIdAplicavel).single(),
    sb.from("oct_tabela_preco_itens").select("*").eq("tabela_id", tabelaIdAplicavel),
  ]);
  if (!tabela || tabela.ativo === false) { reverter(); if (elAjuste) elAjuste.innerHTML = ""; atualizaTotalPg(elTotalLbl); return; }
  const excPorProduto = {};
  (excecoes || []).forEach(e => { excPorProduto[e.produto_id] = e; });

  // aplica o ajuste em cada item (sobre o preço original), mantendo o volume
  PDV.venda.itens.forEach(it => {
    const base = Number(it._unitOriginal || 0);
    const exc = it.produto_id ? excPorProduto[it.produto_id] : null;
    let novoUnit;
    if (exc) {
      if (exc.preco_fixo != null) novoUnit = Number(exc.preco_fixo);
      else novoUnit = pdvCalcAjuste(base, exc.tipo_ajuste, exc.modo_ajuste, Number(exc.valor_ajuste || 0));
    } else {
      novoUnit = pdvCalcAjuste(base, tabela.tipo_ajuste, tabela.modo_ajuste, Number(tabela.valor_ajuste || 0));
    }
    it.unit = novoUnit;
    it.total = Number(it.qtd || 0) * novoUnit;
  });

  // feedback visual
  const totalOrig = PDV.venda.itens.reduce((s, it) => s + Number(it.qtd || 0) * Number(it._unitOriginal || 0), 0);
  const totalNovo = PDV.venda.itens.reduce((s, it) => s + Number(it.total || 0), 0);
  const dif = totalNovo - totalOrig;
  const cor = tabela.tipo_ajuste === "desconto" ? "#16a34a" : "#d97706";
  const sinal = dif >= 0 ? "+" : "−";
  if (elAjuste) {
    elAjuste.innerHTML = `<div style="background:${tabela.tipo_ajuste === 'desconto' ? '#ecfdf5' : '#fffbeb'};border:1px solid ${cor};border-radius:8px;padding:10px;margin-bottom:14px;font-size:0.82rem;color:#111">
      <strong style="color:${cor}">Tabela "${tabela.nome}"</strong> aplicada para ${cliente.nome}.<br>
      ${tabela.tipo_ajuste === 'desconto' ? 'Desconto' : 'Acréscimo'} de ${tabela.modo_ajuste === 'percentual' ? Number(tabela.valor_ajuste) + '%' : 'R$ ' + Number(tabela.valor_ajuste).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      — preço/litro ajustado (volume mantido).
      <span style="color:${cor}">${sinal} R$ ${Math.abs(dif).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>`;
  }
  atualizaTotalPg(elTotalLbl);
}

function pdvCalcAjuste(base, tipo, modo, valor) {
  if (tipo === "nenhum" || !valor) return base;
  const ajuste = modo === "percentual" ? base * (valor / 100) : valor;
  return tipo === "desconto" ? Math.max(0, base - ajuste) : base + ajuste;
}

function atualizaTotalPg(elTotalLbl) {
  if (elTotalLbl) elTotalLbl.textContent = "R$ " + PDV.totalVenda().toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

// chamado pelo botao "Fechar Venda" (F1)
async function telaPagamento() {
  if (!PDV.venda.itens.length) { pdvToast("Adicione itens antes de fechar a venda.", "alerta"); return; }
  const formas = await pdvCarregarFormasPag();
  const total = PDV.totalVenda();
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:4px">Pagamento</h2>
      <p style="color:#888;font-size:0.85rem;margin-bottom:16px">Total da venda: <strong id="pg-total-lbl" style="color:#16a34a;font-size:1.1rem">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>

      <div id="pg-ajuste"></div>

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
  // área que mostra o ajuste aplicado pela tabela de preço
  const elAjuste = box.querySelector("#pg-ajuste");
  window.__pgSel = async (cod) => {
    formaSel = cod;
    render();
    await pdvAplicarTabelaPreco(cod, formas, box);
  };
  render();
  // aplica já na forma inicial
  pdvAplicarTabelaPreco(formaSel, formas, box);

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
