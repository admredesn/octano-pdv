// ============================================================
// octano-pdv  -  REGISTRO DE PONTO (com foto via webcam)
// ============================================================
// Fluxo: escolhe funcionario (oct_pessoas com classificacao 'funcionario'),
// captura a foto pela webcam, envia ao Storage (bucket 'pontos') e grava
// o registro em oct_pdv_ponto com data/hora. Tipo entrada|saida.
//
// Uso:
//   pontoAbrir()                       -> abre o modal padrao (entrada por default)
//   pontoAbrir({ tipo:'saida' })       -> pre-seleciona saida
//   pontoRegistrarObrigatorio({tipo})  -> retorna Promise<registro|null>
//        resolve com o registro salvo, ou null se o usuario cancelar.
//        Usado pelo turno para exigir o ponto antes de abrir/fechar.

// --- carrega funcionarios da empresa (classificacao 'funcionario') ---
async function pontoCarregarFuncionarios() {
  const { data, error } = await sb.from("oct_pessoas")
    .select("id,nome,classificacoes,tipo,ativo")
    .eq("empresa_id", PDV.empresaId).eq("ativo", true).order("nome");
  if (error) { console.error("ponto: erro ao carregar funcionarios", error); return []; }
  return (data || []).filter(p => {
    const lista = Array.isArray(p.classificacoes) ? p.classificacoes : (p.tipo ? [p.tipo] : []);
    return lista.includes("funcionario");
  });
}

// --- modal principal de registro de ponto ---
// onSalvo(registro) opcional: callback chamado apos salvar com sucesso.
// onCancelar() opcional: callback chamado se o usuario fechar sem salvar.
async function pontoAbrir(opts) {
  opts = opts || {};
  const tipoInicial = opts.tipo === "saida" ? "saida" : "entrada";

  const funcionarios = await pontoCarregarFuncionarios();
  const optsFunc = funcionarios.length
    ? funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join("")
    : `<option value="">— nenhum funcionário cadastrado —</option>`;

  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:2px">Registrar Ponto</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:16px">Foto + data/hora do funcionário</p>

      <label style="color:#555;font-size:0.8rem">Funcionário</label>
      <select id="pt-func" style="width:100%;padding:10px;margin:6px 0 14px;border-radius:6px;border:1px solid #ddd;color:#111;background:#fff">
        ${optsFunc}
      </select>

      <label style="color:#555;font-size:0.8rem">Tipo</label>
      <div id="pt-tipo" style="display:flex;gap:8px;margin:8px 0 14px">
        <button data-tipo="entrada" class="pt-opt" style="flex:1;padding:10px;border-radius:6px;border:2px solid #ddd;background:#fff;color:#555;cursor:pointer;font-weight:600">▶ Entrada</button>
        <button data-tipo="saida" class="pt-opt" style="flex:1;padding:10px;border-radius:6px;border:2px solid #ddd;background:#fff;color:#555;cursor:pointer;font-weight:600">◀ Saída</button>
      </div>

      <label style="color:#555;font-size:0.8rem">Foto (webcam)</label>
      <div style="margin:6px 0 14px;background:#0b0d14;border-radius:8px;overflow:hidden;position:relative;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center">
        <video id="pt-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none"></video>
        <canvas id="pt-canvas" style="width:100%;height:100%;object-fit:cover;display:none"></canvas>
        <div id="pt-cam-msg" style="color:#888;font-size:0.82rem;padding:20px;text-align:center">Iniciando câmera...</div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button id="pt-capturar" style="flex:1;padding:10px;border-radius:6px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;font-weight:600" disabled>📷 Capturar</button>
        <button id="pt-tentar" style="flex:1;padding:10px;border-radius:6px;border:1px solid #d97706;background:#fff;color:#d97706;cursor:pointer;font-weight:600;display:none">↻ Tentar câmera novamente</button>
        <button id="pt-refazer" style="flex:1;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer;font-weight:600;display:none">↻ Refazer</button>
      </div>

      <label style="color:#555;font-size:0.8rem">Observação (opcional)</label>
      <input id="pt-obs" placeholder="ex: início do turno" style="width:100%;padding:10px;margin:6px 0 18px;border-radius:6px;border:1px solid #ddd;color:#111">

      <div style="display:flex;gap:10px">
        <button id="pt-voltar" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Cancelar</button>
        <button id="pt-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer" disabled>Registrar Ponto</button>
      </div>
      <div id="pt-msg" style="margin-top:12px;font-size:0.84rem;text-align:center"></div>
    </div>`, { maxWidth: "440px", fecharAoClicarFora: false });

  const video = box.querySelector("#pt-video");
  const canvas = box.querySelector("#pt-canvas");
  const camMsg = box.querySelector("#pt-cam-msg");
  const btnCap = box.querySelector("#pt-capturar");
  const btnTentar = box.querySelector("#pt-tentar");
  const btnRefazer = box.querySelector("#pt-refazer");
  const btnSalvar = box.querySelector("#pt-salvar");
  const btnVoltar = box.querySelector("#pt-voltar");
  const msg = box.querySelector("#pt-msg");

  let stream = null;
  let fotoBlob = null;
  let tipoSel = tipoInicial;

  // pinta o seletor de tipo
  function pintarTipo() {
    box.querySelectorAll(".pt-opt").forEach(x => {
      const ativo = x.dataset.tipo === tipoSel;
      const cor = x.dataset.tipo === "entrada" ? "#16a34a" : "#dc2626";
      x.style.border = "2px solid " + (ativo ? cor : "#ddd");
      x.style.background = ativo ? cor : "#fff";
      x.style.color = ativo ? "#fff" : "#555";
    });
  }
  box.querySelectorAll(".pt-opt").forEach(b => b.addEventListener("click", () => {
    tipoSel = b.dataset.tipo; pintarTipo();
  }));
  pintarTipo();

  // inicia a webcam (com mensagem de erro real e botão de retry)
  async function iniciarCamera() {
    btnTentar.style.display = "none";
    camMsg.style.display = "block";
    camMsg.style.color = "#888";
    camMsg.textContent = "Iniciando câmera...";
    // tenta config ideal; se der erro de fonte ocupada, tenta config mínima
    const tentativas = [
      { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: true, audio: false },
    ];
    let ultimoErro = null;
    for (const constraints of tentativas) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.style.display = "block";
        camMsg.style.display = "none";
        btnCap.disabled = false;
        btnCap.style.display = "block";
        btnTentar.style.display = "none";
        return; // sucesso
      } catch (e) {
        ultimoErro = e;
        // se foi permissão negada, não adianta tentar de novo automaticamente
        if (e.name === "NotAllowedError" || e.name === "SecurityError") break;
      }
    }
    // falhou: mostra o motivo real e o botão de tentar de novo
    console.error("ponto: getUserMedia", ultimoErro);
    const nome = ultimoErro?.name || "Erro";
    let dica;
    if (nome === "NotAllowedError" || nome === "SecurityError")
      dica = "Permissão de câmera negada. Libere a câmera para este site nas configurações do navegador.";
    else if (nome === "NotReadableError" || nome === "AbortError")
      dica = "A câmera está sendo usada por outro programa ou aba (ex.: outra janela de vídeo, Teams, Zoom, ou o preview de permissão do navegador). Feche os outros usos e tente novamente.";
    else if (nome === "NotFoundError" || nome === "OverconstrainedError")
      dica = "Nenhuma câmera compatível encontrada neste computador.";
    else
      dica = "Não foi possível acessar a câmera.";
    camMsg.style.display = "block";
    camMsg.style.color = "#dc2626";
    camMsg.innerHTML = `${dica}<br><span style="color:#888;font-size:0.74rem">(${nome})</span>`;
    btnCap.disabled = true;
    btnCap.style.display = "none";
    btnTentar.style.display = "block";
  }

  // botão "tentar câmera novamente"
  btnTentar.addEventListener("click", () => iniciarCamera());

  function pararCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  // captura o frame atual
  btnCap.addEventListener("click", () => {
    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      fotoBlob = blob;
      video.style.display = "none";
      canvas.style.display = "block";
      btnCap.style.display = "none";
      btnRefazer.style.display = "block";
      btnSalvar.disabled = false;
      pararCamera();
    }, "image/jpeg", 0.85);
  });

  // refazer: volta a camera
  btnRefazer.addEventListener("click", async () => {
    fotoBlob = null;
    canvas.style.display = "none";
    btnRefazer.style.display = "none";
    btnCap.style.display = "block";
    btnSalvar.disabled = true;
    camMsg.style.display = "block";
    camMsg.textContent = "Iniciando câmera...";
    camMsg.style.color = "#888";
    await iniciarCamera();
  });

  // cancelar
  btnVoltar.addEventListener("click", () => {
    pararCamera();
    fecharModal();
    if (typeof opts.onCancelar === "function") opts.onCancelar();
    else if (!opts.semMenu) abrirMenuOperador();
  });

  // salvar: upload da foto + insert do registro
  btnSalvar.addEventListener("click", async () => {
    const sel = box.querySelector("#pt-func");
    const pessoaId = sel.value;
    const funcNome = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
    const obs = box.querySelector("#pt-obs").value.trim();
    if (!pessoaId) { msg.style.color = "#dc2626"; msg.textContent = "Selecione o funcionário."; return; }
    if (!fotoBlob) { msg.style.color = "#dc2626"; msg.textContent = "Capture a foto antes de registrar."; return; }

    btnSalvar.disabled = true;
    msg.style.color = "#888"; msg.textContent = "Enviando foto...";

    // 1) upload no Storage
    const agora = new Date();
    const stamp = agora.toISOString().replace(/[:.]/g, "-");
    const path = `${PDV.empresaId}/${pessoaId}/${stamp}_${tipoSel}.jpg`;
    const up = await sb.storage.from("pontos").upload(path, fotoBlob, { contentType: "image/jpeg", upsert: false });
    if (up.error) { btnSalvar.disabled = false; msg.style.color = "#dc2626"; msg.textContent = "Erro ao enviar foto: " + up.error.message; return; }

    const pub = sb.storage.from("pontos").getPublicUrl(path);
    const fotoUrl = pub?.data?.publicUrl || null;

    // 2) insert do registro
    msg.textContent = "Registrando...";
    const { data, error } = await sb.from("oct_pdv_ponto").insert({
      empresa_id: PDV.empresaId,
      turno_id: PDV.turno?.id || null,
      pessoa_id: pessoaId,
      funcionario: funcNome,
      tipo: tipoSel,
      foto_url: fotoUrl,
      foto_path: path,
      observacao: obs || null,
      registrado_em: agora.toISOString(),
    }).select().single();

    if (error) { btnSalvar.disabled = false; msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }

    pararCamera();
    fecharModal();
    pdvToast(`Ponto de ${tipoSel} registrado para ${funcNome}.`, "sucesso");
    if (typeof opts.onSalvo === "function") opts.onSalvo(data);
  });

  // se o modal for fechado por outro caminho, garante parar a camera
  const overlay = document.getElementById("pdv-modal-overlay");
  if (overlay) {
    const obsMut = new MutationObserver(() => { if (!document.body.contains(overlay)) { pararCamera(); obsMut.disconnect(); } });
    obsMut.observe(document.body, { childList: true });
  }

  await iniciarCamera();
  return box;
}

// --- versao "obrigatoria": usada pelo turno (Promise) ---
// Resolve com o registro salvo, ou null se cancelado.
function pontoRegistrarObrigatorio(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    pontoAbrir({
      tipo: opts.tipo || "entrada",
      semMenu: true,
      onSalvo: (reg) => resolve(reg),
      onCancelar: () => resolve(null),
    });
  });
}
