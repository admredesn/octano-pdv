// ============================================================
// octano-pdv  -  Configuracao central
// ============================================================
// Conecta no MESMO Supabase do octano-retaguarda (tabelas oct_*).
// O PDV grava vendas/turnos/abastecimentos; o retaguarda gerencia.

const SUPABASE_URL = "https://gnlbkwvoqnncpszmokuv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubGJrd3ZvcW5uY3Bzem1va3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNjQxNDcsImV4cCI6MjA5NTY0MDE0N30.gAPt0FJ1Msk2Jl_pYGEVrGcmlZzwyMJeQE_eanuFSmc";

// Servidor SEFAZ (mesmo do retaguarda) - emite/cancela NFC-e.
const SEFAZ_URL = "https://octano-sefaz-production.up.railway.app";

// Cliente Supabase global
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Senha do certificado (localStorage, igual ao retaguarda)
function getCertSenha() { return localStorage.getItem("octano_cert_senha") || ""; }
function setCertSenha(s) { localStorage.setItem("octano_cert_senha", s); }
