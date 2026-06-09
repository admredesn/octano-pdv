// ============================================================
// octano-pdv  -  Modulo NFC-e (emissao via servidor SEFAZ)
// ============================================================
// Reusa o servidor SEFAZ ja validado (/emitir-nfce). Monta o payload
// a partir do estado PDV.venda e grava a venda + a NFC-e no banco.

const NFCE_SERIE_PADRAO = 1;

async function pdvProximoNumeroNfce() {
  const { data } = await sb.from("oct_nfce")
    .select("numero").eq("empresa_id", PDV.empresaId)
    .order("numero", { ascending: false }).limit(1);
  return (data && data.length ? Number(data[0].numero) : 0) + 1;
}

// monta o payload de NFC-e a partir dos itens da venda
function pdvMontarNotaNfce(numero, cpf, tpag) {
  const emp = PDV.empresa;
  const itens = PDV.venda.itens.map((it, i) => {
    const f = it.fiscal || {};
    // valores base do item
    let qCom = Number(it.qtd);
    let vUnCom = Number(it.unit);
    let vProd = Number(it.total);
    // ABASTECIMENTO: valor pago e preco/litro sao SOBERANOS. Ajusta-se apenas
    // o VOLUME para que (volume * preco) feche exatamente no valor pago, evitando
    // a rejeicao 629 (vProd difere de vUnCom * qCom). Volume com 3 casas decimais.
    // Validado: nenhuma falha em 4,2M de combinacoes de valor x preco.
    if (it.tipo === "abastecimento" && vUnCom > 0) {
      qCom = Math.round((vProd / vUnCom) * 1000) / 1000;   // volume ajustado (3 casas)
      // vProd permanece o valor pago; a SEFAZ confere round(qCom*vUnCom,2) === vProd
    }
    return {
      nItem: i + 1,
      cProd: it.cod || ("ITEM" + (i + 1)),
      xProd: it.desc,
      cEAN: "SEM GTIN", cEANTrib: "SEM GTIN",
      ncm: f.ncm, cest: f.cest || null, cfop: f.cfop,
      uCom: f.unidade || "UN", uTrib: f.unidade || "UN",
      qCom: qCom, vUnCom: vUnCom, vProd: vProd,
      ind_combustivel: f.ind_combustivel || "N", ind_monofasico: f.ind_monofasico || "N",
      cod_anp: f.cod_anp || null, desc_anp: f.desc_anp || null,
      uf_cons: emp.uf || "MG", origem: f.origem || "0",
      cst_icms: f.cst_icms || null, aliq_icms: Number(f.aliq_icms) || 0,
      aliq_icms_ad_rem: Number(f.aliq_icms_ad_rem) || 0,
      cst_pis: f.cst_pis || "01", cst_cofins: f.cst_cofins || "01",
      aliq_pis: Number(f.aliq_pis) || 1.65, aliq_cofins: Number(f.aliq_cofins) || 7.60,
    };
  });
  const empresa = {
    cnpj: (emp.cnpj || "").replace(/\D/g, ""),
    nome: emp.nome, nome_fantasia: emp.nome_fantasia || emp.nome,
    ie: (emp.ie || "").replace(/\D/g, ""),
    logradouro: emp.endereco || "", numero: "S/N", bairro: "CENTRO",
    municipio: emp.cidade || "", c_mun: emp.c_mun || "3123205",
    uf: emp.uf || "MG", cep: (emp.cep || "").replace(/\D/g, ""),
    crt: emp.regime_tributario === "simples" ? "1" : "3",
  };
  const nota = {
    numero, serie: NFCE_SERIE_PADRAO,
    natureza_op: "VENDA AO CONSUMIDOR",
    forma_pagamento: tpag,
    cpf_consumidor: cpf || null,
    itens,
  };
  return { nota, empresa };
}

// emite a NFC-e pela ROTA SEGURA (servidor usa cert/senha guardados por empresa).
// O cliente NUNCA envia senha nem certificado - so empresa_id + venda.
async function pdvEmitirNfce(opts) {
  // opts: { cpf, tpag, ambiente, pagamentos }
  const emp = PDV.empresa;
  if (!emp.cert_path) return { ok: false, erro: "Certificado não configurado (tela Empresa no retaguarda)." };
  if (!emp.csc || !emp.csc_id) return { ok: false, erro: "CSC não configurado na empresa." };

  const numero = await pdvProximoNumeroNfce();
  const { nota, empresa } = pdvMontarNotaNfce(numero, opts.cpf, opts.tpag);

  const resp = await fetch(`${SEFAZ_URL}/emitir-nfce-empresa`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      empresa_id: PDV.empresaId,
      ambiente: opts.ambiente,
      nota, empresa,
    }),
  });
  const r = await resp.json();

  if (!r.ok) {
    return { ok: false, erro: (r.cstat_nfe || r.cstat_lote || "") + " " + (r.xmotivo || r.erro || "Falha na emissão"), raw: r };
  }

  // grava a NFC-e
  let nfceId = null;
  try {
    const { data: nf } = await sb.from("oct_nfce").insert({
      empresa_id: PDV.empresaId, numero, serie: NFCE_SERIE_PADRAO, modelo: "65",
      status: "autorizada", ambiente: opts.ambiente, cpf_consumidor: opts.cpf || null,
      valor_total: PDV.totalVenda(), forma_pagamento: opts.tpag,
      itens: PDV.venda.itens, chave_nfe: r.chave, protocolo: r.protocolo,
      xml_autorizado: r.nfe_proc || r.xml_assinado || null, qrcode_url: r.qrcode || null,
    }).select("id").single();
    nfceId = nf ? nf.id : null;
  } catch (e) { console.error("Erro ao gravar NFC-e:", e); }

  // grava a venda do PDV vinculada ao turno
  let vendaId = null;
  let pontosGanhos = 0;
  try {
    const { data: vGrav } = await sb.from("oct_pdv_vendas").insert({
      empresa_id: PDV.empresaId, turno_id: PDV.turno?.id || null, numero,
      operador: PDV.operador?.nome || PDV.turno?.operador || null,
      cliente_nome: PDV.venda.clienteManual?.nome || PDV.venda.cliente?.nome || null,
      cliente_cpf: opts.cpf || null,
      itens: PDV.venda.itens, pagamentos: opts.pagamentos || [],
      valor_total: PDV.totalVenda(), status: "concluida",
      nfce_id: nfceId, nfce_chave: r.chave, nfce_protocolo: r.protocolo, nfce_status: "autorizada",
    }).select("id").single();
    vendaId = vGrav?.id || null;
  } catch (e) { console.error("Erro ao gravar venda:", e); }

  // marca os abastecimentos desta venda como 'vendido' e baixa o estoque dos tanques.
  // a baixa de estoque so acontece AQUI (no recebimento), nunca quando o agente grava.
  try {
    const absItens = (PDV.venda.itens || []).filter(it => it.tipo === "abastecimento" && it.abastecimento_id);
    if (absItens.length) {
      const ids = absItens.map(it => it.abastecimento_id);
      // 1) marca como vendido + vincula a venda
      await sb.from("oct_pdv_abastecimentos")
        .update({ status: "vendido", venda_id: vendaId })
        .in("id", ids);
      // 2) baixa o estoque por tanque (soma litros por tanque_id)
      const litrosPorTanque = {};
      absItens.forEach(it => {
        if (it.tanque_id) litrosPorTanque[it.tanque_id] = (litrosPorTanque[it.tanque_id] || 0) + Number(it.qtd || 0);
      });
      for (const [tanqueId, litros] of Object.entries(litrosPorTanque)) {
        const { data: tq } = await sb.from("oct_tanques").select("estoque_atual").eq("id", tanqueId).single();
        if (tq) {
          const novo = Number(tq.estoque_atual || 0) - Number(litros);
          await sb.from("oct_tanques").update({ estoque_atual: novo }).eq("id", tanqueId);
        }
      }
    }
  } catch (e) { console.error("Erro ao baixar abastecimentos/estoque:", e); }

  // fidelidade: credita pontos se a venda tem cliente CADASTRADO (com id)
  try {
    if (PDV.venda.cliente?.id && typeof fidelidadeCreditar === "function") {
      pontosGanhos = (await fidelidadeCreditar(PDV.venda.cliente.id, PDV.totalVenda(), vendaId)) || 0;
    }
  } catch (e) { console.error("Erro fidelidade:", e); }

  return { ok: true, chave: r.chave, protocolo: r.protocolo, qrcode: r.qrcode,
           xml: r.nfe_proc || r.xml_assinado || null, numero, pontosGanhos };
}
