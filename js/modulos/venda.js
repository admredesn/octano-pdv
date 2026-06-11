// ============================================================
// octano-pdv  -  Modulo VENDA (tela principal) - estilo PISTA
// ============================================================
// Lista os abastecimentos PENDENTES (gravados pelo agente) a esquerda.
// O caixa marca um ou varios -> viram itens da venda -> F1 fecha a venda.
// Atualiza em tempo real (Supabase realtime) quando o agente joga um novo.
//
// Fluxo: agente grava status='pendente' -> aparece aqui -> recebimento
// (F1) emite NFC-e, grava venda, marca abastecimentos como 'vendido' e
// baixa o estoque dos tanques (feito em nfce_pdv.js apos criar a venda).

let _abastPendentes = [];   // [{id, bico, combustivel, litros, preco_litro, valor, vendedor, data_mov, tanque_id}]
let _marcados = new Set();  // ids marcados
let _abastCanal = null;     // canal realtime
let _tanquesIdx = {};       // { tanque_id: numero } para resolver nTanque do encerrante

// carrega os tanques uma vez e indexa por id -> numero
async function vendaCarregarTanques() {
  if (Object.keys(_tanquesIdx).length) return _tanquesIdx;
  try {
    const { data } = await sb.from("oct_tanques")
      .select("id,numero").eq("empresa_id", PDV.empresaId);
    (data || []).forEach(t => { _tanquesIdx[t.id] = t.numero; });
  } catch (e) { console.error("nao carregou tanques:", e); }
  return _tanquesIdx;
}

registrarTela("venda", function (root) {
  root.innerHTML = `
    <div style="display:flex;gap:0;height:calc(100vh - 110px)">
      <!-- ESQUERDA: lista de abastecimentos pendentes -->
      <div style="flex:1.7;display:flex;flex-direction:column;border-right:1px solid #2a2d3e">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #2a2d3e">
          <strong style="color:#f97316;font-size:0.95rem">⛽ Abastecimentos pendentes</strong>
          <span id="v-rt" style="font-size:0.7rem;color:#555">●</span>
          <div style="flex:1"></div>
          <button onclick="vendaMarcarTodos()" style="padding:6px 10px;border-radius:6px;border:1px solid #2a2d3e;background:#13151f;color:#ddd;cursor:pointer;font-size:0.76rem">Marcar todos</button>
          <button onclick="vendaDesmarcarTodos()" style="padding:6px 10px;border-radius:6px;border:1px solid #2a2d3e;background:#13151f;color:#ddd;cursor:pointer;font-size:0.76rem">Desmarcar</button>
          <button onclick="vendaCarregarPendentes()" style="padding:6px 10px;border-radius:6px;border:1px solid #2a2d3e;background:#13151f;color:#ddd;cursor:pointer;font-size:0.76rem">↻ Atualizar</button>
        </div>
        <div style="overflow:auto;flex:1">
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
            <thead>
              <tr style="position:sticky;top:0;background:#1a1d2b;color:#9aa;text-align:left">
                <th style="padding:7px 8px;width:34px"></th>
                <th style="padding:7px 8px;width:42px">Bico</th>
                <th style="padding:7px 8px">Produto</th>
                <th style="padding:7px 8px;width:84px">Data/Hr</th>
                <th style="padding:7px 8px;width:74px;text-align:right">Litros</th>
                <th style="padding:7px 8px;width:64px;text-align:right">Preço</th>
                <th style="padding:7px 8px;width:80px;text-align:right">Total</th>
                <th style="padding:7px 8px">Vendedor</th>
                <th style="padding:7px 8px;width:54px;text-align:center">Receber</th>
              </tr>
            </thead>
            <tbody id="v-abast"></tbody>
          </table>
          <div id="v-abast-vazio" style="display:none;text-align:center;color:#555;padding:50px;font-size:0.9rem">
            Nenhum abastecimento pendente. Aguardando o agente...
          </div>
        </div>
        <!-- totalizadores -->
        <div style="display:flex;gap:20px;padding:8px 14px;border-top:1px solid #2a2d3e;background:#0d0f17;font-size:0.78rem;color:#9aa">
          <span>Na tela: <strong id="v-tot-qtd" style="color:#ddd">0</strong></span>
          <span>Litros: <strong id="v-tot-litros" style="color:#ddd">0,000</strong></span>
          <span>Total: <strong id="v-tot-valor" style="color:#ddd">R$ 0,00</strong></span>
          <div style="flex:1"></div>
          <span>Marcados: <strong id="v-mrk-qtd" style="color:#f97316">0</strong></span>
          <span>R$ <strong id="v-mrk-valor" style="color:#f97316">0,00</strong></span>
        </div>
      </div>

      <!-- DIREITA: cupom em montagem (itens marcados) -->
      <div style="flex:1;padding:14px;background:#0d0f17;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;color:#888;font-size:0.74rem;border-bottom:1px solid #2a2d3e;padding-bottom:6px">
          <span style="flex:1">Produto</span><span style="width:60px;text-align:right">Litros</span><span style="width:70px;text-align:right">Unit.</span><span style="width:70px;text-align:right">Total</span><span style="width:24px"></span>
        </div>
        <div id="v-itens" style="flex:1;overflow:auto;padding:6px 0"></div>
        <div style="border-top:2px solid #2a2d3e;padding-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="color:#888">TOTAL</span>
            <span id="v-total" style="color:#4ade80;font-size:1.8rem;font-weight:700">R$ 0,00</span>
          </div>
          <button onclick="vendaReceberMarcados()" style="width:100%;margin-top:10px;padding:13px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-weight:700;font-size:1rem;cursor:pointer">F1 · Fechar Venda</button>
        </div>
      </div>
    </div>`;

  vendaCarregarTanques();
  vendaCarregarPendentes();
  vendaAtivarRealtime();
});

// ---- carga dos pendentes ----
async function vendaCarregarPendentes() {
  if (!PDV.empresaId) return;
  const { data, error } = await sb
    .from("oct_pdv_abastecimentos")
    .select("id,bico,combustivel,produto_nome,litros,preco_litro,valor,valor_total,vendedor,data_mov,data_abast,tanque_id,tanque,venc_ini,venc_fin,tipo")
    .eq("empresa_id", PDV.empresaId)
    .eq("status", "pendente")
    .order("data_mov", { ascending: true });
  if (error) { pdvToast("Erro ao carregar abastecimentos: " + error.message, "erro"); return; }
  // considera apenas abastecimentos (nao afericao)
  _abastPendentes = (data || []).filter(a => (a.tipo || "abastecimento") === "abastecimento");
  // limpa marcados que nao existem mais
  const ids = new Set(_abastPendentes.map(a => a.id));
  _marcados = new Set([..._marcados].filter(id => ids.has(id)));
  vendaRenderAbast();
}

// normaliza campos (agente usa valor/combustivel; legado usa valor_total/produto_nome)
function _abValor(a) { return Number(a.valor != null ? a.valor : a.valor_total || 0); }
function _abComb(a)  { return a.combustivel || a.produto_nome || "—"; }
function _abData(a)  { return a.data_mov || a.data_abast || null; }

function vendaRenderAbast() {
  const tb = document.getElementById("v-abast");
  const vazio = document.getElementById("v-abast-vazio");
  if (!tb) return;
  if (!_abastPendentes.length) {
    tb.innerHTML = "";
    if (vazio) vazio.style.display = "block";
  } else {
    if (vazio) vazio.style.display = "none";
    tb.innerHTML = _abastPendentes.map(a => {
      const dt = _abData(a);
      const d = dt ? new Date(dt) : null;
      const dataStr = d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
      const hrStr = d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
      const marcado = _marcados.has(a.id);
      return `<tr style="border-bottom:1px solid #1a1d2e;background:${marcado ? '#1e2a1e' : 'transparent'};cursor:pointer"
                 onclick="vendaToggle('${a.id}')">
        <td style="padding:6px 8px;text-align:center">
          <input type="checkbox" ${marcado ? "checked" : ""} onclick="event.stopPropagation();vendaToggle('${a.id}')" style="cursor:pointer">
        </td>
        <td style="padding:6px 8px;color:#ddd">${a.bico ?? "—"}</td>
        <td style="padding:6px 8px;color:#7dd3fc">${_abComb(a)}</td>
        <td style="padding:6px 8px;color:#9aa">${dataStr} ${hrStr}</td>
        <td style="padding:6px 8px;text-align:right;color:#ddd">${Number(a.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</td>
        <td style="padding:6px 8px;text-align:right;color:#9aa">${Number(a.preco_litro || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</td>
        <td style="padding:6px 8px;text-align:right;color:#4ade80;font-weight:600">${_abValor(a).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        <td style="padding:6px 8px;color:#9aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${a.vendedor || "—"}</td>
        <td style="padding:6px 8px;text-align:center;white-space:nowrap">
          <button onclick="event.stopPropagation();vendaReceberUm('${a.id}')" title="Receber só este"
            style="padding:3px 8px;border-radius:5px;border:none;background:#16a34a;color:#fff;cursor:pointer;font-size:0.74rem">▸</button>
          <button onclick="event.stopPropagation();vendaAferir('${a.id}')" title="Marcar como aferição (volta ao tanque)"
            style="padding:3px 8px;border-radius:5px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-size:0.74rem;margin-left:4px">🧪</button>
        </td>
      </tr>`;
    }).join("");
  }
  vendaAtualizarTotais();
  vendaSyncItensComMarcados();
}

function vendaAtualizarTotais() {
  const qtd = _abastPendentes.length;
  const litros = _abastPendentes.reduce((s, a) => s + Number(a.litros || 0), 0);
  const valor = _abastPendentes.reduce((s, a) => s + _abValor(a), 0);
  const marc = _abastPendentes.filter(a => _marcados.has(a.id));
  const mQtd = marc.length;
  const mValor = marc.reduce((s, a) => s + _abValor(a), 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("v-tot-qtd", qtd);
  set("v-tot-litros", litros.toLocaleString("pt-BR", { minimumFractionDigits: 3 }));
  set("v-tot-valor", "R$ " + valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  set("v-mrk-qtd", mQtd);
  set("v-mrk-valor", mValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
}

// ---- marcacao ----
function vendaToggle(id) {
  if (_marcados.has(id)) _marcados.delete(id); else _marcados.add(id);
  vendaRenderAbast();
}

// marca um abastecimento pendente como AFERICAO: o combustivel volta ao tanque,
// nao vira venda e nao mexe no estoque. O registro some da lista de pendentes.
async function vendaAferir(id) {
  const a = _abastPendentes.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Marcar este abastecimento (bico ${a.bico ?? "—"}, ${Number(a.litros || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 })} L) como AFERIÇÃO? O combustível retorna ao tanque e não será cobrado.`)) return;
  const { error } = await sb.from("oct_pdv_abastecimentos")
    .update({ tipo: "afericao", status: "concluido", preco_litro: 0, valor: 0,
              observacao: "Aferição - combustível retornado ao tanque" })
    .eq("id", id);
  if (error) { pdvToast("Erro ao registrar aferição: " + error.message, "erro"); return; }
  _marcados.delete(id);
  _abastPendentes = _abastPendentes.filter(x => x.id !== id);
  vendaRenderAbast();
  pdvToast(`Aferição registrada (bico ${a.bico ?? "—"}). Combustível retornado ao tanque.`, "sucesso");
}
function vendaMarcarTodos() {
  _abastPendentes.forEach(a => _marcados.add(a.id));
  vendaRenderAbast();
}
function vendaDesmarcarTodos() {
  _marcados.clear();
  vendaRenderAbast();
}

// acha o produto cadastrado correspondente ao abastecimento (via tanque vinculado).
// retorna o produto (com ncm/cfop/cst/anp) ou null.
function _produtoDoAbast(a) {
  if (!Array.isArray(PDV.produtos)) return null;
  // 1) pelo tanque vinculado (vinculo mais confiavel)
  if (a.tanque_id) {
    const p = PDV.produtos.find(x => x.tanque_id === a.tanque_id);
    if (p) return p;
  }
  // 2) fallback: pelo nome do combustivel
  const comb = (_abComb(a) || "").toUpperCase().trim();
  if (comb && comb !== "—") {
    const p = PDV.produtos.find(x => (x.nome || "").toUpperCase().includes(comb) ||
                                     comb.includes((x.nome || "").toUpperCase()));
    if (p) return p;
  }
  return null;
}

// ---- busca de produtos (loja de conveniencia, SEM tanque vinculado) ----
// Abre um modal com campo de busca. Combustiveis (com tanque vinculado/cod_anp)
// nao aparecem aqui — eles vem dos abastecimentos do agente.
function vendaAbrirBuscaProduto() {
  const box = abrirModal(`
    <div style="padding:20px">
      <h2 style="color:#f97316;margin-bottom:4px">Adicionar produto</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Produtos da loja (combustível vem dos abastecimentos).</p>
      <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px">
        <div style="flex:1">
          <label style="color:#555;font-size:0.74rem">Produto (nome, código ou cód. barras)</label>
          <input id="bp-busca" placeholder="Digite ou bipe o código..." autocomplete="off"
            style="width:100%;padding:9px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
        <div style="width:80px">
          <label style="color:#555;font-size:0.74rem">Qtd</label>
          <input id="bp-qtd" type="number" step="0.001" value="1"
            style="width:100%;padding:9px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
      </div>
      <div id="bp-lista" style="max-height:50vh;overflow:auto;border-top:1px solid #eee"></div>
    </div>`, { maxWidth: "560px" });

  const busca = box.querySelector("#bp-busca");
  busca.addEventListener("input", () => vendaRenderBuscaProduto(busca.value));
  busca.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const termo = (busca.value || "").toLowerCase().trim();
      const lista = vendaFiltrarProdutos(termo);
      let p = lista.find(x => (x.codigo || "").toLowerCase() === termo || (x.ean || "").toLowerCase() === termo);
      if (!p) p = lista[0];
      if (p) vendaAddProduto(p.id);
    }
  });
  busca.focus();
  vendaRenderBuscaProduto("");
}

// produtos elegiveis: SEM tanque vinculado e SEM codigo ANP (exclui combustivel)
function vendaFiltrarProdutos(termo) {
  let lista = (PDV.produtos || []).filter(p => !p.tanque_id && !p.cod_anp);
  termo = (termo || "").toLowerCase().trim();
  if (termo) {
    lista = lista.filter(p =>
      (p.nome || "").toLowerCase().includes(termo) ||
      (p.codigo || "").toLowerCase().includes(termo) ||
      (p.ean || "").toLowerCase().includes(termo));
  }
  return lista.slice(0, 40);
}

function vendaRenderBuscaProduto(termo) {
  const el = document.getElementById("bp-lista");
  if (!el) return;
  const lista = vendaFiltrarProdutos(termo);
  if (!lista.length) {
    el.innerHTML = '<p style="color:#999;padding:18px;text-align:center;font-size:0.85rem">Nenhum produto encontrado.</p>';
    return;
  }
  el.innerHTML = lista.map(p => {
    const preco = Number(p.preco_venda_a || 0);
    const semPreco = preco <= 0;
    return `<div onclick="vendaAddProduto('${p.id}')"
      style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee;cursor:pointer;color:#222"
      onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='#fff'">
      <span>${p.nome}${p.codigo ? ` <small style="color:#999">${p.codigo}</small>` : ""}</span>
      <span style="color:${semPreco ? '#dc2626' : '#16a34a'};font-weight:600">${semPreco ? "sem preço" : "R$ " + preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
    </div>`;
  }).join("");
}

function vendaAddProduto(id) {
  const p = (PDV.produtos || []).find(x => x.id === id);
  if (!p) return;
  const preco = Number(p.preco_venda_a || 0);
  if (preco <= 0) { pdvToast(`"${p.nome}" está sem preço de venda.`, "alerta"); return; }
  const qtd = parseFloat(document.getElementById("bp-qtd")?.value) || 1;
  PDV.venda.itens.push({
    tipo: "produto",
    produto_id: p.id,
    cod: p.codigo || "",
    desc: p.nome,
    qtd: qtd,
    unit: preco,
    total: +(qtd * preco).toFixed(2),
    fiscal: p,   // dados fiscais p/ NFC-e
  });
  pdvToast(`${p.nome} adicionado.`, "sucesso");
  fecharModal();
  vendaRenderItens();
}

// espelha os marcados em PDV.venda.itens (tipo abastecimento) para o fechamento
function vendaSyncItensComMarcados() {
  // remove os abastecimentos antigos da venda e reinsere os marcados
  PDV.venda.itens = PDV.venda.itens.filter(it => it.tipo !== "abastecimento");
  _abastPendentes.filter(a => _marcados.has(a.id)).forEach(a => {
    const prod = _produtoDoAbast(a);   // produto cadastrado p/ dados fiscais
    PDV.venda.itens.push({
      tipo: "abastecimento",
      abastecimento_id: a.id,
      tanque_id: a.tanque_id || null,
      produto_id: prod ? prod.id : null,
      cod: prod ? (prod.codigo || String(a.bico ?? "")) : String(a.bico ?? ""),
      desc: prod ? prod.nome : _abComb(a),
      qtd: Number(a.litros || 0),
      unit: Number(a.preco_litro || 0),
      total: _abValor(a),
      fiscal: prod || null,   // NCM/CFOP/CST/ANP para a NFC-e
      // encerrante + bico/tanque para o grupo <comb> da NFC-e (combustivel MG)
      enc_ini: a.venc_ini != null ? Number(a.venc_ini) : null,
      enc_fin: a.venc_fin != null ? Number(a.venc_fin) : null,
      n_bico: a.bico != null ? Number(a.bico) : null,
      n_tanque: (a.tanque != null ? Number(a.tanque) : (_tanquesIdx[a.tanque_id] != null ? Number(_tanquesIdx[a.tanque_id]) : null)),
      dados: a,
    });
  });
  vendaRenderItens();
}

function vendaRenderItens() {
  const el = document.getElementById("v-itens");
  if (!el) return;
  const itens = PDV.venda.itens;
  if (!itens.length) {
    el.innerHTML = '<p style="color:#555;text-align:center;padding:30px;font-size:0.85rem">Marque abastecimentos ao lado para receber.</p>';
  } else {
    el.innerHTML = itens.map((it, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #1a1d2e;font-size:0.82rem;color:#ddd">
        <span style="flex:1">${it.desc}${it.tipo === "abastecimento" ? ` <small style="color:#666">B${it.cod}</small>` : ""}</span>
        <span style="width:60px;text-align:right">${Number(it.qtd).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</span>
        <span style="width:70px;text-align:right">${Number(it.unit).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</span>
        <span style="width:70px;text-align:right;color:#4ade80">${Number(it.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        <span onclick="vendaDesmarcarItem(${i})" style="width:24px;text-align:center;color:#f87171;cursor:pointer">✕</span>
      </div>`).join("");
  }
  const tot = document.getElementById("v-total");
  if (tot) tot.textContent = "R$ " + PDV.totalVenda().toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

// remover um item do cupom tambem desmarca o abastecimento na lista
function vendaDesmarcarItem(i) {
  const it = PDV.venda.itens[i];
  if (!it) return;
  if (it.abastecimento_id) {
    // abastecimento: desmarca na lista (o sync remove o item)
    _marcados.delete(it.abastecimento_id);
    vendaRenderAbast();
  } else {
    // produto: remove direto
    PDV.venda.itens.splice(i, 1);
    vendaRenderItens();
  }
}

// F5 - cancela o ultimo item adicionado (produto ou abastecimento)
function vendaCancelarItem() {
  const itens = PDV.venda.itens;
  if (!itens.length) { pdvToast("Nenhum item para cancelar.", "info"); return; }
  vendaDesmarcarItem(itens.length - 1);
  pdvToast("Último item removido.", "info");
}

// ---- recebimento ----
function vendaReceberMarcados() {
  if (!PDV.turno) { pdvToast("Abra um turno antes.", "alerta"); return; }
  // permite fechar com abastecimentos marcados OU produtos adicionados
  const temProduto = PDV.venda.itens.some(it => it.tipo === "produto");
  if (!_marcados.size && !temProduto) { pdvToast("Marque um abastecimento ou adicione um produto.", "alerta"); return; }
  vendaSyncItensComMarcados();
  if (typeof telaPagamento === "function") telaPagamento();
  else pdvToast("Fluxo de pagamento indisponível.", "erro");
}

// receber um unico abastecimento direto
function vendaReceberUm(id) {
  if (!PDV.turno) { pdvToast("Abra um turno antes.", "alerta"); return; }
  _marcados = new Set([id]);
  vendaSyncItensComMarcados();
  if (typeof telaPagamento === "function") telaPagamento();
  else pdvToast("Fluxo de pagamento indisponível.", "erro");
}

// ---- realtime (com reconexao automatica + polling de seguranca) ----
let _abastPollTimer = null;
let _abastReconnTimer = null;

function vendaAtivarRealtime() {
  try {
    if (_abastCanal) { try { sb.removeChannel(_abastCanal); } catch (e) {} _abastCanal = null; }
    _abastCanal = sb
      .channel("abast-pendentes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "oct_pdv_abastecimentos", filter: `empresa_id=eq.${PDV.empresaId}` },
        () => {
          // qualquer mudanca (insert do agente, update de recebimento) -> recarrega
          if (telaAtual() === "venda") vendaCarregarPendentes();
        })
      .subscribe((status) => {
        const el = document.getElementById("v-rt");
        const ok = status === "SUBSCRIBED";
        if (el) {
          el.style.color = ok ? "#16a34a" : "#d97706";
          el.title = ok ? "tempo real ativo" : "reconectando...";
        }
        // se o canal caiu (fechou/erro/timeout), agenda reconexao automatica.
        if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          _agendarReconexao();
        } else if (ok) {
          // reconectou: ao voltar, recarrega para pegar o que perdeu enquanto caido
          if (telaAtual() === "venda") vendaCarregarPendentes();
        }
      });
  } catch (e) {
    console.error("realtime indisponivel:", e);
    _agendarReconexao();
  }
  _iniciarPollingSeguranca();
}

// recria o canal apos uma pausa (evita loop agressivo de reconexao)
function _agendarReconexao() {
  if (_abastReconnTimer) return;            // ja agendado
  _abastReconnTimer = setTimeout(() => {
    _abastReconnTimer = null;
    if (telaAtual() === "venda") {
      console.log("[realtime] reconectando canal de abastecimentos...");
      vendaAtivarRealtime();
    }
  }, 5000);
}

// rede de seguranca: mesmo que o realtime falhe de vez, recarrega a lista
// periodicamente para a tela nunca ficar congelada. Leve (a cada 30s).
function _iniciarPollingSeguranca() {
  if (_abastPollTimer) return;
  _abastPollTimer = setInterval(() => {
    if (telaAtual() === "venda") {
      vendaCarregarPendentes();
    }
  }, 30000);
}
