// ============================================================
// octano-pdv  -  Sincronizacao automatica de cadastros
// ============================================================
// Escuta, via realtime do Supabase, mudancas feitas no RETAGUARDA nas tabelas
// de cadastro (oct_produtos, oct_bicos, oct_tanques) e recarrega o cache do PDV
// SEM precisar atualizar a pagina. Assim, alterar um preco, cadastrar um bico
// ou mudar dados fiscais no retaguarda reflete no PDV em segundos.
//
// Depende de: pdvCarregarProdutos() (auth.js), sb (config.js), PDV (state.js).
// As tabelas precisam estar habilitadas para realtime (ver sync_realtime.sql).

let _syncCanais = [];
let _syncTimers = {};

// recarrega um cache com debounce (evita varias recargas em edicoes em lote)
function _syncDebounce(chave, fn, ms) {
  if (_syncTimers[chave]) clearTimeout(_syncTimers[chave]);
  _syncTimers[chave] = setTimeout(() => { _syncTimers[chave] = null; fn(); }, ms || 800);
}

async function _syncRecarregarProdutos() {
  if (typeof pdvCarregarProdutos === "function") {
    await pdvCarregarProdutos();
    // se a tela de venda estiver aberta, atualiza a lista (precos/itens)
    if (typeof telaAtual === "function" && telaAtual() === "venda" && typeof vendaRenderAbast === "function") {
      vendaRenderAbast();
    }
    _syncAviso("Catálogo atualizado");
  }
}

async function _syncRecarregarTanques() {
  try {
    const { data } = await sb.from("oct_tanques")
      .select("id,numero,combustivel,estoque_atual,capacidade,ativo")
      .eq("empresa_id", PDV.empresaId).order("numero");
    PDV.tanques = data || [];
    _syncAviso("Tanques atualizados");
  } catch (e) { console.error("sync tanques:", e); }
}

async function _syncRecarregarBicos() {
  try {
    const { data } = await sb.from("oct_bicos")
      .select("id,numero,codigo_hex,bomba,tanque_id,ativo")
      .eq("empresa_id", PDV.empresaId);
    PDV.bicos = data || [];
    _syncAviso("Bicos atualizados");
  } catch (e) { console.error("sync bicos:", e); }
}

// aviso discreto (toast curto) - so se a funcao existir
function _syncAviso(msg) {
  if (typeof pdvToast === "function") pdvToast(msg, "info");
}

// inicia a escuta realtime das tres tabelas de cadastro
function pdvIniciarSync() {
  if (!PDV.empresaId) return;
  pdvPararSync(); // evita canais duplicados

  const filtro = `empresa_id=eq.${PDV.empresaId}`;

  const cProd = sb.channel("sync-produtos")
    .on("postgres_changes", { event: "*", schema: "public", table: "oct_produtos", filter: filtro },
        () => _syncDebounce("produtos", _syncRecarregarProdutos))
    .subscribe();

  const cTanq = sb.channel("sync-tanques")
    .on("postgres_changes", { event: "*", schema: "public", table: "oct_tanques", filter: filtro },
        () => _syncDebounce("tanques", _syncRecarregarTanques))
    .subscribe();

  const cBico = sb.channel("sync-bicos")
    .on("postgres_changes", { event: "*", schema: "public", table: "oct_bicos", filter: filtro },
        () => _syncDebounce("bicos", _syncRecarregarBicos))
    .subscribe();

  _syncCanais = [cProd, cTanq, cBico];

  // carga inicial dos caches que ainda nao existem
  _syncRecarregarTanques();
  _syncRecarregarBicos();
}

function pdvPararSync() {
  _syncCanais.forEach(c => { try { sb.removeChannel(c); } catch (e) {} });
  _syncCanais = [];
}
