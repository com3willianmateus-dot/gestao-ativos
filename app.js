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

/* ---------------- MENU ---------------- */
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

/* ---------------- LOGIN / AUTH ---------------- */
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
      if (message) message.innerHTML = '<div class="message error">' + result.error.message + '</div>';
      if (button) { button.disabled = false; button.textContent = "Entrar"; }
      return;
    }

    window.location.href = "busca_ativos.html";
  });
}

async function requireAuth() {
  const result = await db.auth.getSession();

  if (result.error || !result.data.session) {
    window.location.replace("index.html");
    return false;
  }

  currentUser = result.data.session.user;
  window.currentUser = currentUser;

  const userNameElement = document.getElementById("userName");
  if (userNameElement) {
    userNameElement.textContent = currentUser.email || "Usuário Logado";
  }

  return true;
}

async function logout() {
  await db.auth.signOut();
  window.location.replace("index.html");
}

/* ---------------- BUSCA DE ATIVOS ---------------- */
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

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", async function () {
  const page = document.body.dataset.page;

  if (page === "login" || $("loginForm")) {
    await initLogin();
    return;
  }

  const paginasProtegidas = ["busca_ativos", "cadastro_ativo"];

  if (paginasProtegidas.includes(page)) {
    const auth = await requireAuth();
    if (auth) {
      await loadMenu();
      // Se estiver na página de busca, inicializa
      if (page === "busca_ativos" && typeof initBuscaPage === "function") {
        initBuscaPage();
      }
      if (page === "cadastro_ativo" && typeof initCadastroPage === "function") {
        initCadastroPage();
      }
    }
    return;
  }
});