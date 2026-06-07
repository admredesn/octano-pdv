// ============================================================
// octano-pdv  -  CONSULTA DE PRODUTOS
// ============================================================
// Busca detalhada no catalogo (preco, estoque fiscal, status).

function produtosConsultar() {
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:12px">Consulta de Produtos</h2>
      <input id="pr-busca" placeholder="Buscar por nome, código ou cód. barras..." style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div id="pr-lista" style="max-height:340px;overflow:auto"></div>
      <button onclick="fecharModal()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Fechar</button>
    </div>`, { maxWidth: "520px" });
  const busca = box.querySelector("#pr-busca");
  busca.focus();
  busca.addEventListener("input", () => produtosRender(busca.value));
  produtosRender("");
}

function produtosRender(termo) {
  const el = document.getElementById("pr-lista");
  if (!el) return;
  termo = (termo || "").toLowerCase().trim();
  let lista = PDV.produtos;
  if (termo) lista = PDV.produtos.filter(p =>
    (p.nome || "").toLowerCase().includes(termo) ||
    (p.codigo || "").toLowerCase().includes(termo) ||
    (p.ean || "").toLowerCase().includes(termo));
  lista = lista.slice(0, 50);
  if (!lista.length) { el.innerHTML = '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhum produto encontrado.</p>'; return; }
  el.innerHTML = lista.map(p => {
    const preco = Number(p.preco_venda_a || 0);
    const fiscalOk = p.ncm && p.cfop && p.cst_icms;
    const precoOk = preco > 0;
    return `<div style="padding:10px;border-bottom:1px solid #eee">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="color:#111;font-weight:600;font-size:0.9rem">${p.nome}</span>
        <span style="color:${precoOk ? '#16a34a' : '#dc2626'};font-weight:700">R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px;font-size:0.72rem;color:#888">
        <span>Cód: ${p.codigo || "—"}</span>
        ${p.ncm ? `<span>NCM: ${p.ncm}</span>` : ""}
        ${p.cfop ? `<span>CFOP: ${p.cfop}</span>` : ""}
        <span style="color:${fiscalOk ? '#16a34a' : '#d97706'}">${fiscalOk ? "✓ fiscal OK" : "⚠ fiscal incompleto"}</span>
      </div>
    </div>`;
  }).join("");
}
