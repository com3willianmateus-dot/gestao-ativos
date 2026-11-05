/* =========================================================
   CONFIGURAÇÃO DO SUPABASE
   ========================================================= */
const SUPABASE_URL = "https://ekdrkkjexsmuqededneu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OFX9DXZKIkebMqLYI5IjrA_Rzxe7-rA";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = db;

// Nome da tabela (mantenha igual ao criado no SQL)
const TABLE_ATIVOS = "gestao-ativos";

let currentUser = null;

function $(id) { return document.getElementById(id); }

function go(page) {
  if (page.includes('.html') || page.includes('?')) {
    window.location.href = page;
  } else {
    window.location.href = page + ".html";
  }
}

/* =========================================================
   MENU
   ========================================================= */
function toggleSubmenu(submenuId, arrowId) {
  const submenu = document.getElementById(submenuId);
  const arrow = document.getElementById(arrowId);
  if (!submenu) return;

  if (submenu.style.display === "block") {
    submenu.style.display = "none";
    if (arrow) arrow.textContent = "▼";
  } else {
    document.querySelectorAll('.submenu').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.arrow').forEach(el => el.textContent = '▼');
    submenu.style.display = "block";
    if (arrow) arrow.textContent = "▲";
  }
}

async function loadMenu() {
  const menuDiv = $("menu");
  if (!menuDiv) return;

  try {
    const response = await fetch("menu.html", { cache: "no-cache" });
    if (!response.ok) throw new Error("Erro ao carregar menu");
    menuDiv.innerHTML = await response.text();

    const page = document.body.dataset.page;

    document.querySelectorAll(".nav button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
  } catch (error) {
    console.error("Erro no menu:", error);
  }
}

/* =========================================================
   LOGIN / AUTH
   ========================================================= */
async function initLogin() {
  const loginForm = $("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    const message = $("loginMessage");
    const button = loginForm.querySelector('button[type="submit"]');

    if (button) { button.disabled = true; button.textContent = "Entrando..."; }

    const result = await db.auth.signInWithPassword({ email, password });

    if (result.error) {
      if (message) {
        message.innerHTML = '<div class="message error">' + result.error.message + '</div>';
      }
      if (button) { button.disabled = false; button.textContent = "Entrar"; }
      return;
    }

    // Login OK → vai para a área protegida
    window.location.href = "busca_ativos.html";
  });
}

async function requireAuth() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) {
      console.error("Erro ao obter sessão:", error);
      window.location.replace("login.html");
      return false;
    }

    if (!data || !data.session) {
      // Sem sessão → manda para o login
      window.location.replace("login.html");
      return false;
    }

    currentUser = data.session.user;
    window.currentUser = currentUser;

    const userNameElement = document.getElementById("userName");
    if (userNameElement) {
      userNameElement.textContent = currentUser.email || "Usuário Logado";
    }

    return true;
  } catch (err) {
    console.error("Falha no requireAuth:", err);
    window.location.replace("login.html");
    return false;
  }
}

async function logout() {
  await db.auth.signOut();
  window.location.replace("login.html");
}

/* =========================================================
   BUSCA DE ATIVOS
   ========================================================= */
/**
 * Busca ativos por TAG, serial ou contrato.
 * @param {string} termo - Termo digitado pelo usuário
 * @returns {Promise<Array>} Lista de ativos encontrados
 */
async function buscarAtivos(termo) {
  const termoLimpo = (termo || "").trim();
  if (!termoLimpo) return [];

  // Escapa caracteres especiais do filtro .or() do PostgREST
  const safe = termoLimpo.replace(/[,()]/g, " ").trim();

  const { data, error } = await db
    .from(TABLE_ATIVOS)
    .select("id, tag, serial, contrato, created_at")
    .or(`tag.ilike.%${safe}%,serial.ilike.%${safe}%,contrato.ilike.%${safe}%`)
    .order("tag", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Erro na busca:", error);
    throw error;
  }
  return data || [];
}

/* =========================================================
   APAGAR TODOS OS ATIVOS (admin)
   ========================================================= */
async function apagarTodosAtivos() {
  if (!confirm("⚠️ Isso apagará TODOS os registros da tabela " + TABLE_ATIVOS + ".\n\nDeseja continuar?")) {
    return;
  }
  if (!confirm("TEM CERTEZA? Esta ação NÃO pode ser desfeita.")) {
    return;
  }

  const { error, count } = await db
    .from(TABLE_ATIVOS)
    .delete({ count: "exact" })
    .gte("id", 0); // filtro que pega todos os registros

  if (error) {
    console.error("Erro ao apagar:", error);
    alert("Erro ao apagar: " + error.message);
    return;
  }

  alert(`✅ ${count} registros apagados com sucesso.`);
  window.location.reload();
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", async function () {
  // Garante que o Supabase já está carregado
  if (typeof supabase === "undefined" || typeof db === "undefined") {
    console.error("Supabase não carregado. Verifique o <script> do CDN antes do app.js.");
    return;
  }

  const page = document.body.dataset.page || "";

  // ---------- Página de LOGIN ----------
  if (page === "login" || document.getElementById("loginForm")) {
    await initLogin();
    return;
  }

  // ---------- HOME / INDEX → verifica sessão e redireciona ----------
  if (page === "home" || page === "index") {
    const { data } = await db.auth.getSession();
    if (data && data.session) {
      // Já logado → vai direto para a área protegida
      window.location.replace("busca_ativos.html");
    } else {
      // Não logado → vai para o login
      window.location.replace("login.html");
    }
    return;
  }

  // ---------- Páginas PROTEGIDAS ----------
  const paginasProtegidas = [
    "busca_ativos"
  ];

  if (paginasProtegidas.includes(page)) {
    const auth = await requireAuth();
    if (auth) {
      await loadMenu();

      if (page === "busca_ativos" && typeof initBuscaPage === "function") {
        initBuscaPage();
      }
      if (page === "cadastro_ativo" && typeof initCadastroPage === "function") {
        initCadastroPage();
      }
    }
    return;
  }

  // ---------- Página desconhecida → manda para o login por segurança ----------
  window.location.replace("login.html");
});