// ============================================================
// octano-pdv  -  Autenticacao e inicializacao
// ============================================================

async function pdvInit() {
  // verifica sessao supabase (mesma conta do retaguarda)
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { renderLogin(); return; }
  PDV.sessao = session;
  await carregarEmpresaEContexto();
}

function renderLogin() {
  const root = document.getElementById("pdv-root");
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0d14">
      <div style="background:#13151f;border:1px solid #2a2d3e;border-radius:12px;padding:32px;width:340px">
        <h1 style="color:#f97316;font-size:1.4rem;margin-bottom:4px">OCTANO PDV</h1>
        <p style="color:#888;font-size:0.82rem;margin-bottom:20px">Frente de caixa</p>
        <input id="pdv-usuario" type="text" placeholder="Usuário" autocapitalize="off" autocomplete="username" style="width:100%;padding:10px;margin-bottom:10px;border-radius:6px;border:1px solid #2a2d3e;background:#0b0d14;color:#fff">
        <input id="pdv-senha" type="password" placeholder="Senha" autocomplete="current-password" style="width:100%;padding:10px;margin-bottom:16px;border-radius:6px;border:1px solid #2a2d3e;background:#0b0d14;color:#fff">
        <button id="pdv-btn-login" style="width:100%;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">Entrar</button>
        <div id="pdv-login-msg" style="margin-top:12px;font-size:0.82rem;color:#f87171;text-align:center"></div>
      </div>
    </div>`;
  const btn = document.getElementById("pdv-btn-login");
  const tentar = async () => {
    const usuario = document.getElementById("pdv-usuario").value.trim().toLowerCase();
    const senha = document.getElementById("pdv-senha").value;
    const msg = document.getElementById("pdv-login-msg");
    if (!usuario || !senha) { msg.textContent = "Informe usuário e senha."; return; }
    msg.style.color = "#888";
    msg.textContent = "Entrando...";

    // 1) converte usuário -> e-mail via view de lookup (leitura pública restrita)
    const { data: lk, error: errLk } = await sb.from("oct_login_lookup")
      .select("email_login").eq("usuario", usuario).limit(1).maybeSingle();
    if (errLk || !lk || !lk.email_login) {
      msg.style.color = "#f87171";
      msg.textContent = "Usuário ou senha inválidos.";
      return;
    }

    // 2) autentica no Supabase com o e-mail vinculado (operador nunca o vê)
    const { error } = await sb.auth.signInWithPassword({ email: lk.email_login, password: senha });
    if (error) { msg.style.color = "#f87171"; msg.textContent = "Usuário ou senha inválidos."; return; }

    const { data: { session } } = await sb.auth.getSession();
    PDV.sessao = session;
    await carregarEmpresaEContexto();
  };
  btn.addEventListener("click", tentar);
  document.getElementById("pdv-usuario").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("pdv-senha").focus(); });
  document.getElementById("pdv-senha").addEventListener("keydown", e => { if (e.key === "Enter") tentar(); });
}

async function carregarEmpresaEContexto() {
  // perfil -> empresa (mesma estrutura do retaguarda)
  const uid = PDV.sessao.user.id;
  const { data: perfil } = await sb.from("oct_perfis")
    .select("empresa_id, oct_empresas(*)").eq("id", uid).single();
  if (!perfil) {
    document.getElementById("pdv-root").innerHTML =
      '<div style="padding:40px;color:#f87171">Perfil sem empresa vinculada. Configure no retaguarda.</div>';
    return;
  }
  PDV.empresaId = perfil.empresa_id;
  PDV.empresa = perfil.oct_empresas;

  // carrega catalogo de produtos (cache)
  await pdvCarregarProdutos();

  // verifica turno aberto
  await verificarTurnoAberto();

  // sincronizacao automatica: escuta mudancas nos cadastros (retaguarda)
  // e recarrega o cache do PDV sem precisar atualizar a pagina.
  if (typeof pdvIniciarSync === "function") pdvIniciarSync();

  // monta o layout principal e vai pra tela de venda (ou abertura de turno)
  montarLayoutPrincipal();
  if (PDV.turno) irPara("venda");
  else irPara("turno");
}

// carrega/recarrega o catalogo de produtos no cache (PDV.produtos).
// Reutilizada no login e pela sincronizacao automatica (realtime).
async function pdvCarregarProdutos() {
  const { data: prods } = await sb.from("oct_produtos")
    .select("id,nome,codigo,ean,unidade,preco_venda_a,ncm,cest,cfop,cod_anp,desc_anp,ind_combustivel,ind_monofasico,origem,cst_icms,aliq_icms,aliq_pis,aliq_cofins,csosn,tanque_id")
    .eq("empresa_id", PDV.empresaId).eq("ativo", true).order("nome");
  PDV.produtos = prods || [];
  return PDV.produtos;
}

async function pdvLogout() {
  await sb.auth.signOut();
  location.reload();
}
