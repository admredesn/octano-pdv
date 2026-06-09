// ============================================================
// octano-pdv  -  Estado central (single source of truth)
// ============================================================
// Toda tela le e escreve aqui. Evita variaveis globais espalhadas.

const PDV = {
  // --- sessao / empresa / operador ---
  empresaId: null,
  empresa: null,
  operador: null,        // { id, nome } do funcionario logado no PDV
  sessao: null,          // sessao supabase (auth)

  // --- turno ---
  turno: null,           // { id, numero, aberto_em, status, valor_abertura }

  // --- venda em andamento ---
  venda: {
    itens: [],           // [{ tipo:'produto'|'abastecimento', cod, desc, qtd, unit, total, dados... }]
    cliente: null,       // cliente selecionado (consulta) ou null
    clienteManual: null, // { cpf, nome, ... } digitado quando exigido no cupom
    pagamentos: [],      // [{ forma, valor }]
    obs: "",
  },

  // --- cache ---
  produtos: [],          // catalogo carregado uma vez
  tanques: [],           // tanques (cache, sincronizado com o retaguarda)
  bicos: [],             // bicos (cache, sincronizado com o retaguarda)
  abastecimentos: [],    // abastecimentos disponiveis (da tabela / futuramente bomba)

  // --- helpers de venda ---
  totalVenda() {
    return this.venda.itens.reduce((s, i) => s + Number(i.total || 0), 0);
  },
  totalPago() {
    return this.venda.pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  },
  limparVenda() {
    this.venda = { itens: [], cliente: null, clienteManual: null, pagamentos: [], obs: "" };
  },
};

// notifica telas quando o estado muda (observer simples)
const _pdvListeners = [];
function onPdvChange(fn) { _pdvListeners.push(fn); }
function emitPdvChange() { _pdvListeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
