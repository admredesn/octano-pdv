// ============================================================
// octano-pdv  -  FIDELIDADE (1 ponto por R$ 1,00 gasto)
// ============================================================

const FIDELIDADE_PONTOS_POR_REAL = 1; // 1 ponto por R$ 1,00

// credita pontos numa venda (chamado apos emitir NFC-e, se houver cliente)
async function fidelidadeCreditar(clienteId, valorVenda, vendaId) {
  if (!clienteId || !valorVenda) return;
  const pontos = Math.floor(Number(valorVenda) * FIDELIDADE_PONTOS_POR_REAL);
  if (pontos <= 0) return;
  try {
    // upsert do saldo
    const { data: atual } = await sb.from("oct_pdv_fidelidade")
      .select("id,saldo_pontos").eq("empresa_id", PDV.empresaId).eq("cliente_id", clienteId).maybeSingle();
    if (atual) {
      await sb.from("oct_pdv_fidelidade").update({
        saldo_pontos: Number(atual.saldo_pontos) + pontos, atualizado_em: new Date().toISOString(),
      }).eq("id", atual.id);
    } else {
      await sb.from("oct_pdv_fidelidade").insert({
        empresa_id: PDV.empresaId, cliente_id: clienteId, saldo_pontos: pontos,
      });
    }
    await sb.from("oct_pdv_fidelidade_mov").insert({
      empresa_id: PDV.empresaId, cliente_id: clienteId, tipo: "ganho",
      pontos, origem: vendaId ? "venda" : "venda", venda_id: vendaId || null,
    });
    return pontos;
  } catch (e) { console.error("Erro fidelidade:", e); }
}

// consulta saldo + resgate (acessivel pelo menu)
async function fidelidadeConsultar() {
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:12px">Programa de Fidelidade</h2>
      <input id="fd-busca" placeholder="Buscar cliente por nome ou documento..." style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div id="fd-lista" style="max-height:320px;overflow:auto"></div>
      <button onclick="fecharModal()" style="width:100%;margin-top:12px;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Fechar</button>
    </div>`, { maxWidth: "460px" });
  const busca = box.querySelector("#fd-busca");
  busca.focus();
  let timer;
  busca.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => fidelidadeBuscar(busca.value), 250); });
  fidelidadeBuscar("");
}

async function fidelidadeBuscar(termo) {
  const el = document.getElementById("fd-lista");
  if (!el) return;
  termo = (termo || "").trim();
  let q = sb.from("oct_clientes").select("id,nome,documento").eq("ativo", true).order("nome").limit(30);
  if (termo) q = q.or(`nome.ilike.%${termo}%,documento.ilike.%${termo}%`);
  const { data: clientes } = await q;
  if (!clientes || !clientes.length) { el.innerHTML = '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhum cliente.</p>'; return; }

  // busca saldos desses clientes
  const ids = clientes.map(c => c.id);
  const { data: saldos } = await sb.from("oct_pdv_fidelidade").select("cliente_id,saldo_pontos").eq("empresa_id", PDV.empresaId).in("cliente_id", ids);
  const mapa = {}; (saldos || []).forEach(s => mapa[s.cliente_id] = Number(s.saldo_pontos));

  el.innerHTML = clientes.map(c => {
    const pts = mapa[c.id] || 0;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee">
      <div>
        <div style="color:#111;font-weight:600;font-size:0.9rem">${c.nome}</div>
        <div style="color:#888;font-size:0.76rem">${c.documento || "sem documento"}</div>
      </div>
      <div style="text-align:right">
        <div style="color:#16a34a;font-weight:700;font-size:1.05rem">${pts.toLocaleString("pt-BR")} pts</div>
        ${pts > 0 ? `<span onclick='fidelidadeResgatar("${c.id}","${c.nome.replace(/'/g,"")}",${pts})' style="color:#f97316;font-size:0.74rem;cursor:pointer">resgatar</span>` : ""}
      </div>
    </div>`;
  }).join("");
}

async function fidelidadeResgatar(clienteId, nome, saldo) {
  const qtd = prompt(`Resgatar pontos de ${nome} (saldo: ${saldo} pts)\nQuantos pontos resgatar?`, "");
  if (qtd === null) return;
  const pontos = parseInt(qtd, 10);
  if (!pontos || pontos <= 0) { pdvToast("Quantidade inválida.", "alerta"); return; }
  if (pontos > saldo) { pdvToast("Saldo insuficiente.", "erro"); return; }
  try {
    const { data: atual } = await sb.from("oct_pdv_fidelidade").select("id,saldo_pontos").eq("empresa_id", PDV.empresaId).eq("cliente_id", clienteId).single();
    await sb.from("oct_pdv_fidelidade").update({ saldo_pontos: Number(atual.saldo_pontos) - pontos, atualizado_em: new Date().toISOString() }).eq("id", atual.id);
    await sb.from("oct_pdv_fidelidade_mov").insert({
      empresa_id: PDV.empresaId, cliente_id: clienteId, tipo: "resgate", pontos: -pontos, origem: "resgate manual",
    });
    pdvToast(`${pontos} pontos resgatados de ${nome}.`, "sucesso");
    fidelidadeBuscar(document.getElementById("fd-busca")?.value || "");
  } catch (e) { pdvToast("Erro ao resgatar: " + e.message, "erro"); }
}
