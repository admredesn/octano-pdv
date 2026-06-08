// ============================================================
// octano-pdv  -  FUNCOES GERENCIAIS (Menu Gerente)
// ============================================================

// ---- ALTERAR PRECO (produto / combustivel) ----
function gerAlterarPreco() {
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#a855f7;margin-bottom:12px">Alterar Preço</h2>
      <input id="gp-busca" placeholder="Buscar produto/combustível..." style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div id="gp-lista" style="max-height:340px;overflow:auto"></div>
      <button onclick="abrirMenuGerente()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #2a2d3e;background:transparent;color:#a855f7;cursor:pointer">← Menu Gerente</button>
    </div>`, { maxWidth: "480px" });
  const busca = box.querySelector("#gp-busca");
  busca.focus();
  busca.addEventListener("input", () => gpRender(busca.value));
  gpRender("");
}

function gpRender(termo) {
  const el = document.getElementById("gp-lista");
  if (!el) return;
  termo = (termo || "").toLowerCase().trim();
  let lista = PDV.produtos;
  if (termo) lista = PDV.produtos.filter(p => (p.nome || "").toLowerCase().includes(termo) || (p.codigo || "").toLowerCase().includes(termo));
  lista = lista.slice(0, 40);
  if (!lista.length) { el.innerHTML = '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhum produto.</p>'; return; }
  el.innerHTML = lista.map(p => {
    const preco = Number(p.preco_venda_a || 0);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #eee;gap:10px">
      <span style="color:#111;font-size:0.86rem;flex:1">${p.nome}</span>
      <span style="color:${preco > 0 ? '#16a34a' : '#dc2626'};font-size:0.82rem;min-width:70px;text-align:right">R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      <button onclick='gpEditar("${p.id}")' style="padding:5px 10px;border-radius:5px;border:none;background:#a855f7;color:#fff;cursor:pointer;font-size:0.76rem">editar</button>
    </div>`;
  }).join("");
}

function gpEditar(produtoId) {
  const p = PDV.produtos.find(x => x.id === produtoId);
  if (!p) return;
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#a855f7;margin-bottom:4px">Alterar Preço</h2>
      <p style="color:#555;font-size:0.86rem;margin-bottom:14px">${p.nome}</p>
      <label style="color:#555;font-size:0.78rem">Preço atual: R$ ${Number(p.preco_venda_a || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</label>
      <input id="gp-novo" type="number" step="0.001" value="${Number(p.preco_venda_a || 0)}" style="width:100%;padding:11px;margin:8px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111;font-size:1.2rem">
      <div style="display:flex;gap:10px">
        <button onclick="gerAlterarPreco()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="gp-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#a855f7;color:#fff;font-weight:600;cursor:pointer">Salvar novo preço</button>
      </div>
      <div id="gp-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "420px" });
  const inp = box.querySelector("#gp-novo");
  inp.focus(); inp.select();
  box.querySelector("#gp-salvar").addEventListener("click", async () => {
    const novo = parseFloat(inp.value);
    const msg = box.querySelector("#gp-msg");
    if (isNaN(novo) || novo < 0) { msg.style.color = "#dc2626"; msg.textContent = "Preço inválido."; return; }
    const antigo = Number(p.preco_venda_a || 0);
    msg.style.color = "#888"; msg.textContent = "Salvando...";
    const { error } = await sb.from("oct_produtos").update({ preco_venda_a: novo }).eq("id", produtoId);
    if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
    // log de auditoria
    await sb.from("oct_pdv_preco_log").insert({
      empresa_id: PDV.empresaId, produto_id: produtoId, produto_nome: p.nome,
      preco_antigo: antigo, preco_novo: novo, operador: PDV.operador?.nome || PDV.turno?.operador || null,
    });
    // atualiza o cache local
    p.preco_venda_a = novo;
    fecharModal();
    pdvToast(`Preço de ${p.nome} atualizado para R$ ${novo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`, "sucesso");
  });
}

// ---- AJUSTE DE TANQUE (medicao / correcao de estoque) ----
async function gerAjusteTanque() {
  const { data: tanques } = await sb.from("oct_tanques").select("id,numero,combustivel,estoque_atual,capacidade").eq("empresa_id", PDV.empresaId).eq("ativo", true).order("numero");
  if (!tanques || !tanques.length) { pdvToast("Nenhum tanque cadastrado.", "alerta"); return; }
  const linhas = tanques.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee;gap:10px">
      <div>
        <div style="color:#111;font-weight:600;font-size:0.88rem">Tanque ${t.numero} - ${t.combustivel}</div>
        <div style="color:#888;font-size:0.74rem">Estoque: ${Number(t.estoque_atual).toLocaleString("pt-BR")} L${t.capacidade ? " / cap. " + Number(t.capacidade).toLocaleString("pt-BR") + " L" : ""}</div>
      </div>
      <button onclick='gerAjusteTanqueEditar("${t.id}")' style="padding:6px 12px;border-radius:5px;border:none;background:#a855f7;color:#fff;cursor:pointer;font-size:0.78rem">ajustar</button>
    </div>`).join("");
  window.__tanquesGer = tanques;
  abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#a855f7;margin-bottom:12px">Ajuste de Tanque (Medição)</h2>
      <p style="color:#888;font-size:0.78rem;margin-bottom:12px">Corrige o estoque após medição física do tanque.</p>
      <div style="max-height:340px;overflow:auto">${linhas}</div>
      <button onclick="abrirMenuGerente()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #2a2d3e;background:transparent;color:#a855f7;cursor:pointer">← Menu Gerente</button>
    </div>`, { maxWidth: "480px" });
}

function gerAjusteTanqueEditar(tanqueId) {
  const t = (window.__tanquesGer || []).find(x => x.id === tanqueId);
  if (!t) return;
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#a855f7;margin-bottom:4px">Ajuste de Estoque</h2>
      <p style="color:#555;font-size:0.86rem;margin-bottom:14px">Tanque ${t.numero} - ${t.combustivel}</p>
      <label style="color:#555;font-size:0.78rem">Estoque atual: ${Number(t.estoque_atual).toLocaleString("pt-BR")} L</label>
      <input id="gt-novo" type="number" step="0.001" value="${Number(t.estoque_atual)}" style="width:100%;padding:11px;margin:8px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111;font-size:1.2rem">
      <label style="color:#555;font-size:0.78rem">Motivo do ajuste</label>
      <input id="gt-motivo" placeholder="ex: medição física, correção" style="width:100%;padding:10px;margin:6px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div style="display:flex;gap:10px">
        <button onclick="gerAjusteTanque()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="gt-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#a855f7;color:#fff;font-weight:600;cursor:pointer">Salvar ajuste</button>
      </div>
      <div id="gt-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "420px" });
  box.querySelector("#gt-novo").focus();
  box.querySelector("#gt-salvar").addEventListener("click", async () => {
    const novo = parseFloat(box.querySelector("#gt-novo").value);
    const motivo = box.querySelector("#gt-motivo").value.trim();
    const msg = box.querySelector("#gt-msg");
    if (isNaN(novo) || novo < 0) { msg.style.color = "#dc2626"; msg.textContent = "Estoque inválido."; return; }
    const antigo = Number(t.estoque_atual);
    msg.style.color = "#888"; msg.textContent = "Salvando...";
    const { error } = await sb.from("oct_tanques").update({ estoque_atual: novo }).eq("id", tanqueId);
    if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
    await sb.from("oct_pdv_tanque_log").insert({
      empresa_id: PDV.empresaId, tanque_id: tanqueId, tanque_numero: t.numero,
      estoque_antigo: antigo, estoque_novo: novo, motivo: motivo || null,
      operador: PDV.operador?.nome || PDV.turno?.operador || null,
    });
    fecharModal();
    pdvToast(`Estoque do tanque ${t.numero} ajustado para ${novo.toLocaleString("pt-BR")} L.`, "sucesso");
  });
}

// ---- CADASTRO DE VENDEDORES ----
async function gerVendedores() {
  const box = abrirModal(`<div style="padding:24px;text-align:center;color:#888">Carregando vendedores...</div>`, { maxWidth: "460px" });
  const { data } = await sb.from("oct_pdv_vendedores").select("*").eq("empresa_id", PDV.empresaId).eq("ativo", true).order("nome");
  const linhas = (data || []).length
    ? data.map(v => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px;border-bottom:1px solid #eee">
        <div>
          <div style="color:#111;font-weight:600;font-size:0.88rem">${v.nome}</div>
          <div style="color:#888;font-size:0.74rem">${v.documento || ""}${v.comissao_pct ? " · comissão " + v.comissao_pct + "%" : ""}</div>
        </div>
        <span onclick='gerVendedorRemover("${v.id}","${v.nome.replace(/'/g,"")}")' style="color:#dc2626;font-size:0.74rem;cursor:pointer">remover</span>
      </div>`).join("")
    : '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhum vendedor cadastrado.</p>';
  box.innerHTML = `
    <div style="padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="color:#a855f7">Vendedores / Frentistas</h2>
        <button onclick="gerVendedorNovo()" style="padding:6px 12px;border-radius:6px;border:none;background:#16a34a;color:#fff;cursor:pointer;font-size:0.82rem">+ Novo</button>
      </div>
      <div style="max-height:320px;overflow:auto">${linhas}</div>
      <button onclick="abrirMenuGerente()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #2a2d3e;background:transparent;color:#a855f7;cursor:pointer">← Menu Gerente</button>
    </div>`;
}

function gerVendedorNovo() {
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#a855f7;margin-bottom:14px">Novo Vendedor</h2>
      <label style="color:#555;font-size:0.78rem">Nome *</label>
      <input id="gv-nome" style="width:100%;padding:9px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <label style="color:#555;font-size:0.78rem">CPF</label>
      <input id="gv-doc" placeholder="só números" style="width:100%;padding:9px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div style="display:flex;gap:10px">
        <div style="flex:2">
          <label style="color:#555;font-size:0.78rem">Telefone</label>
          <input id="gv-tel" style="width:100%;padding:9px;margin:5px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
        <div style="flex:1">
          <label style="color:#555;font-size:0.78rem">Comissão %</label>
          <input id="gv-com" type="number" step="0.1" value="0" style="width:100%;padding:9px;margin:5px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="gerVendedores()" style="flex:1;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="gv-salvar" style="flex:2;padding:10px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-weight:600;cursor:pointer">Salvar</button>
      </div>
      <div id="gv-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "420px" });
  box.querySelector("#gv-nome").focus();
  box.querySelector("#gv-salvar").addEventListener("click", async () => {
    const nome = box.querySelector("#gv-nome").value.trim();
    const doc = box.querySelector("#gv-doc").value.replace(/\D/g, "");
    const tel = box.querySelector("#gv-tel").value.trim();
    const com = parseFloat(box.querySelector("#gv-com").value) || 0;
    const msg = box.querySelector("#gv-msg");
    if (!nome) { msg.style.color = "#dc2626"; msg.textContent = "Informe o nome."; return; }
    msg.style.color = "#888"; msg.textContent = "Salvando...";
    const { error } = await sb.from("oct_pdv_vendedores").insert({
      empresa_id: PDV.empresaId, nome, documento: doc || null, telefone: tel || null, comissao_pct: com, ativo: true,
    });
    if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
    pdvToast(`Vendedor ${nome} cadastrado.`, "sucesso");
    gerVendedores();
  });
}

async function gerVendedorRemover(id, nome) {
  if (!confirm(`Remover o vendedor ${nome}?`)) return;
  await sb.from("oct_pdv_vendedores").update({ ativo: false }).eq("id", id);
  pdvToast(`Vendedor ${nome} removido.`, "info");
  gerVendedores();
}

// ---- RELATORIO DO DIA ----
async function gerRelatorioDia() {
  const box = abrirModal(`<div style="padding:24px;text-align:center;color:#888">Gerando relatório do dia...</div>`, { maxWidth: "500px" });
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const iso = hoje.toISOString();

  const [vendasR, caixaR, abastR, prazoR] = await Promise.all([
    sb.from("oct_pdv_vendas").select("valor_total,status,pagamentos").eq("empresa_id", PDV.empresaId).gte("data_venda", iso),
    sb.from("oct_pdv_caixa").select("tipo,valor").eq("empresa_id", PDV.empresaId).gte("data_mov", iso),
    sb.from("oct_pdv_abastecimentos").select("tipo,litros,valor,combustivel").eq("empresa_id", PDV.empresaId).gte("data_mov", iso),
    sb.from("oct_pdv_prazo").select("valor,status").eq("empresa_id", PDV.empresaId).gte("data_mov", iso),
  ]);

  const vendas = (vendasR.data || []).filter(v => v.status !== "cancelada");
  const totalVendas = vendas.reduce((s, v) => s + Number(v.valor_total || 0), 0);
  const porForma = {};
  vendas.forEach(v => (v.pagamentos || []).forEach(p => { const n = FORMA_NOME(p.forma); porForma[n] = (porForma[n] || 0) + Number(p.valor || 0); }));

  const caixa = caixaR.data || [];
  const somaC = (t) => caixa.filter(c => c.tipo === t).reduce((s, c) => s + Number(c.valor || 0), 0);

  const abast = (abastR.data || []);
  const litrosVendidos = abast.filter(a => a.tipo === "abastecimento").reduce((s, a) => s + Number(a.litros || 0), 0);
  const valorAbast = abast.filter(a => a.tipo === "abastecimento").reduce((s, a) => s + Number(a.valor || 0), 0);
  const qtdAfericoes = abast.filter(a => a.tipo === "afericao").length;

  const prazoAberto = (prazoR.data || []).filter(p => p.status === "aberto").reduce((s, p) => s + Number(p.valor || 0), 0);

  const ln = (l, v, c) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.86rem"><span style="color:#aaa">${l}</span><span style="color:${c || '#ddd'};font-weight:600">${v}</span></div>`;
  const rs = (n) => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const formasHtml = Object.keys(porForma).length ? Object.entries(porForma).map(([k, v]) => ln(k, rs(v))).join("") : '<div style="color:#666;font-size:0.8rem">Sem vendas</div>';

  box.innerHTML = `
    <div style="padding:22px">
      <h2 style="color:#a855f7;margin-bottom:2px">Relatório do Dia</h2>
      <p style="color:#888;font-size:0.74rem;margin-bottom:14px">${new Date().toLocaleDateString("pt-BR")} · gerado ${new Date().toLocaleTimeString("pt-BR")}</p>

      <div style="background:#0d0f17;border-radius:8px;padding:12px 14px;margin-bottom:10px">
        <div style="color:#a855f7;font-size:0.72rem;text-transform:uppercase;margin-bottom:4px">Vendas (${vendas.length})</div>
        ${ln("Total vendido", rs(totalVendas), "#4ade80")}
        <div style="border-top:1px solid #1a1d2e;margin:6px 0"></div>
        ${formasHtml}
      </div>

      <div style="background:#0d0f17;border-radius:8px;padding:12px 14px;margin-bottom:10px">
        <div style="color:#a855f7;font-size:0.72rem;text-transform:uppercase;margin-bottom:4px">Combustível</div>
        ${ln("Litros abastecidos", litrosVendidos.toLocaleString("pt-BR") + " L")}
        ${ln("Valor em abastecimentos", rs(valorAbast))}
        ${ln("Aferições realizadas", qtdAfericoes)}
      </div>

      <div style="background:#0d0f17;border-radius:8px;padding:12px 14px;margin-bottom:14px">
        <div style="color:#a855f7;font-size:0.72rem;text-transform:uppercase;margin-bottom:4px">Caixa & Prazo</div>
        ${ln("Suprimentos", rs(somaC("suprimento")), "#4ade80")}
        ${ln("Sangrias", rs(somaC("sangria")), "#f87171")}
        ${ln("Despesas", rs(somaC("despesa")), "#f87171")}
        ${ln("Receitas", rs(somaC("receita")), "#4ade80")}
        ${ln("A prazo (em aberto hoje)", rs(prazoAberto), "#d97706")}
      </div>

      <button onclick="abrirMenuGerente()" style="width:100%;padding:10px;border-radius:6px;border:1px solid #2a2d3e;background:transparent;color:#a855f7;cursor:pointer">← Menu Gerente</button>
    </div>`;
}
