// ============================================================
// octano-pdv  -  Modulo VENDA (tela principal)
// ============================================================

registrarTela("venda", function (root) {
  root.innerHTML = `
    <div style="display:flex;gap:0;height:calc(100vh - 110px)">
      <!-- esquerda: abastecimentos/itens disponiveis -->
      <div style="flex:1.4;padding:14px;border-right:1px solid #2a2d3e;overflow:auto">
        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-end">
          <div style="flex:1">
            <label style="color:#888;font-size:0.74rem">Produto (nome, código ou cód. barras)</label>
            <input id="v-busca" placeholder="Digite ou bipe o código..." style="width:100%;padding:9px;border-radius:6px;border:1px solid #2a2d3e;background:#0b0d14;color:#fff">
          </div>
          <div style="width:80px">
            <label style="color:#888;font-size:0.74rem">Qtd</label>
            <input id="v-qtd" type="number" step="0.001" value="1" style="width:100%;padding:9px;border-radius:6px;border:1px solid #2a2d3e;background:#0b0d14;color:#fff">
          </div>
          <button onclick="vendaAddPorBusca()" style="padding:9px 16px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">+ Add</button>
        </div>
        <div id="v-sugestoes"></div>
      </div>
      <!-- direita: cupom em montagem -->
      <div style="flex:1;padding:14px;background:#0d0f17;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;color:#888;font-size:0.74rem;border-bottom:1px solid #2a2d3e;padding-bottom:6px">
          <span>Produto</span><span>Qtd</span><span>Unit.</span><span>Total</span>
        </div>
        <div id="v-itens" style="flex:1;overflow:auto;padding:6px 0"></div>
        <div style="border-top:2px solid #2a2d3e;padding-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="color:#888">TOTAL</span>
            <span id="v-total" style="color:#4ade80;font-size:1.8rem;font-weight:700">R$ 0,00</span>
          </div>
          <button onclick="pdvFecharVenda()" style="width:100%;margin-top:10px;padding:13px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-weight:700;font-size:1rem;cursor:pointer">F1 · Fechar Venda</button>
        </div>
      </div>
    </div>`;

  // busca incremental
  const busca = document.getElementById("v-busca");
  busca.addEventListener("input", () => vendaRenderSugestoes(busca.value));
  busca.addEventListener("keydown", (e) => { if (e.key === "Enter") vendaAddPorBusca(); });
  busca.focus();
  vendaRenderSugestoes("");
  vendaRenderItens();
});

function vendaRenderSugestoes(termo) {
  const el = document.getElementById("v-sugestoes");
  if (!el) return;
  termo = (termo || "").toLowerCase().trim();
  let lista = PDV.produtos;
  if (termo) {
    lista = PDV.produtos.filter(p =>
      (p.nome || "").toLowerCase().includes(termo) ||
      (p.codigo || "").toLowerCase().includes(termo) ||
      (p.ean || "").toLowerCase().includes(termo));
  }
  lista = lista.slice(0, 30);
  if (!lista.length) { el.innerHTML = '<p style="color:#555;padding:14px">Nenhum produto encontrado.</p>'; return; }
  el.innerHTML = lista.map(p => {
    const preco = Number(p.preco_venda_a || 0);
    return `<div onclick='vendaAddProduto(${JSON.stringify(p.id)})' style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #1a1d2e;cursor:pointer;color:#ddd" onmouseover="this.style.background='#1a1d2e'" onmouseout="this.style.background='transparent'">
      <span>${p.nome}</span>
      <span style="color:${preco > 0 ? '#4ade80' : '#f87171'}">R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
    </div>`;
  }).join("");
}

function vendaAddPorBusca() {
  const termo = (document.getElementById("v-busca").value || "").toLowerCase().trim();
  if (!termo) return;
  // exato por codigo/ean, senao primeiro que casa
  let p = PDV.produtos.find(x => (x.codigo || "").toLowerCase() === termo || (x.ean || "").toLowerCase() === termo);
  if (!p) p = PDV.produtos.find(x => (x.nome || "").toLowerCase().includes(termo));
  if (!p) { pdvToast("Produto não encontrado.", "alerta"); return; }
  vendaAddProduto(p.id);
}

function vendaAddProduto(id) {
  const p = PDV.produtos.find(x => x.id === id);
  if (!p) return;
  const preco = Number(p.preco_venda_a || 0);
  if (preco <= 0) { pdvToast(`"${p.nome}" está sem preço de venda.`, "alerta"); return; }
  const qtd = parseFloat(document.getElementById("v-qtd")?.value) || 1;
  PDV.venda.itens.push({
    tipo: "produto",
    produto_id: p.id,
    cod: p.codigo || "",
    desc: p.nome,
    qtd: qtd,
    unit: preco,
    total: +(qtd * preco).toFixed(2),
    fiscal: p, // guarda dados fiscais p/ NFC-e
  });
  document.getElementById("v-busca").value = "";
  document.getElementById("v-qtd").value = "1";
  vendaRenderSugestoes("");
  vendaRenderItens();
  document.getElementById("v-busca").focus();
}

function vendaRenderItens() {
  const el = document.getElementById("v-itens");
  if (!el) return;
  const itens = PDV.venda.itens;
  if (!itens.length) {
    el.innerHTML = '<p style="color:#555;text-align:center;padding:30px;font-size:0.85rem">Nenhum item. Busque um produto ao lado.</p>';
  } else {
    el.innerHTML = itens.map((it, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #1a1d2e;font-size:0.82rem;color:#ddd">
        <span style="flex:1">${it.desc}</span>
        <span style="width:60px;text-align:right">${Number(it.qtd).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</span>
        <span style="width:70px;text-align:right">${Number(it.unit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        <span style="width:70px;text-align:right;color:#4ade80">${Number(it.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        <span onclick="vendaRemoverItem(${i})" style="width:24px;text-align:center;color:#f87171;cursor:pointer">✕</span>
      </div>`).join("");
  }
  const tot = document.getElementById("v-total");
  if (tot) tot.textContent = "R$ " + PDV.totalVenda().toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function vendaRemoverItem(i) {
  PDV.venda.itens.splice(i, 1);
  vendaRenderItens();
}

function vendaCancelarItem() {
  if (!PDV.venda.itens.length) { pdvToast("Nenhum item para cancelar.", "info"); return; }
  vendaRemoverItem(PDV.venda.itens.length - 1);
  pdvToast("Último item removido.", "info");
}
