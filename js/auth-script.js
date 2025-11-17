// =================================================================
// ARQUIVO DE AUTENTICAÇÃO E LÓGICA DO FIREBASE (auth-script.js)
// VERSÃO CORRIGIDA - (Corrige o loop de login/logout)
// =================================================================

// Importar funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    signInAnonymously,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc,
    doc,
    updateDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    setDoc,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// =================================================================
// 1. CONFIGURAÇÃO DO FIREBASE (IMPORTANTE!)
// =================================================================
let firebaseConfig, appId, initialAuthToken;

try {
    firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    
    // Se as chaves estiverem vazias (ex: rodando localmente sem o ambiente),
    // você pode colar suas chaves aqui para testar:
    if (Object.keys(firebaseConfig).length === 0) {
        console.warn("Configuração do Firebase não encontrada. Cole suas chaves em auth-script.js para testar localmente.");
        // COLE SUAS CHAVES AQUI PARA TESTE LOCAL
        // firebaseConfig = {
        //     apiKey: "SUA_API_KEY_AQUI",
        //     authDomain: "SEU_AUTH_DOMAIN_AQUI",
        //     projectId: "SEU_PROJECT_ID_AQUI",
        //     storageBucket: "SEU_STORAGE_BUCKET_AQUI",
        //     messagingSenderId: "SEU_MESSAGING_SENDER_ID_AQUI",
        //     appId: "SEU_APP_ID_AQUI"
        // };
    }

} catch (e) {
    console.error("Erro ao carregar configuração do Firebase:", e);
    firebaseConfig = {}; // Evita que o app quebre
}
// =================================================================


// Inicializar Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setLogLevel('Debug');
    console.log("Firebase inicializado com sucesso.");
} catch (e) {
    console.error("Erro ao inicializar o Firebase. Verifique sua configuração:", e);
    alert("Erro crítico ao conectar com o Firebase. O aplicativo não funcionará.");
}


// ===================================
// 2. VARIÁVEIS GLOBAIS E ELEMENTOS DA UI
// ===================================

// Botões da Navbar
const loginBtnNav = document.getElementById('loginBtn');
const logoutBtnNav = document.getElementById('logoutBtn');
const accountBtnNav = document.getElementById('accountBtn');
const financeiroLinkNav = document.getElementById('financeiroLink');

// Modal de Login
const loginModal = document.getElementById('loginModal');
const closeModalBtn = document.querySelector('.close-modal');
const tabBtns = document.querySelectorAll('.tab-btn');

// Formulários
const loginForm = document.getElementById('login-form-real');
const registerForm = document.getElementById('register-form-real');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const loginErrorText = document.getElementById('login-error');
const registerErrorText = document.getElementById('register-error');

// Variável de estado
let currentUser = null;
let currentUserId = null;
let isAdmin = false;
let initialAuthCheckDone = false; // Flag para evitar o loop

// ===================================
// 3. LÓGICA DE AUTENTICAÇÃO (LOGIN, LOGOUT, CADASTRO)
// ===================================

// Monitorar estado da autenticação (a função principal)
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    if (user && !user.isAnonymous) {
        // --- USUÁRIO ESTÁ LOGADO ---
        currentUserId = user.uid;
        isAdmin = (user.email === 'admin@energytech.com'); // Simulação de Admin
        
        updateUINavbar(true, isAdmin);
        
        // Se estiver na página financeira, carregar dados
        if (document.getElementById('dashboard-content')) {
            initFinanceiroPage(user);
        }

    } else {
        // --- USUÁRIO ESTÁ DESLOGADO (ou anônimo) ---
        currentUserId = user ? user.uid : null;
        isAdmin = false;
        
        updateUINavbar(false, false);
        
        // Se estiver na página financeira, redirecionar
        if (document.getElementById('dashboard-content')) {
            redirectToHome();
        }
    }

    // --- Lógica de Auto-Login (CORRIGIDA) ---
    // Só roda UMA VEZ na primeira carga da página
    if (!initialAuthCheckDone && !user) {
        // Se o primeiro check foi feito e NÃO HÁ NENHUM usuário (nem real, nem anônimo)
        // Tenta logar com token ou anonimamente.
        handleInitialAuth(); 
    }
    initialAuthCheckDone = true;
});

// Função que só roda na primeira carga, se ninguém estiver logado
async function handleInitialAuth() {
    if (initialAuthToken) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Usuário autenticado com token customizado.");
        } catch (error) {
            console.error("Erro token:", error);
            await signInAnonymously(auth); // Fallback
        }
    } else {
        try {
            // Loga anonimamente SÓ SE não houver usuário
            if (!auth.currentUser) {
                await signInAnonymously(auth);
                console.log("Usuário autenticado anonimamente.");
            }
        } catch (error) {
            console.error("Erro anônimo:", error);
        }
    }
}

// Função centralizada para atualizar a Navbar
function updateUINavbar(isLoggedIn, isUserAdmin) {
    if (loginBtnNav) loginBtnNav.style.display = isLoggedIn ? 'none' : 'flex';
    if (logoutBtnNav) logoutBtnNav.style.display = isLoggedIn ? 'flex' : 'none';
    if (accountBtnNav) accountBtnNav.style.display = isLoggedIn ? 'flex' : 'none';
    if (financeiroLinkNav) financeiroLinkNav.style.display = isLoggedIn ? 'block' : 'none';

    if (isLoggedIn && accountBtnNav) {
        accountBtnNav.innerHTML = isUserAdmin ? 
            '<i class="fas fa-user-shield"></i> Admin' : 
            '<i class="fas fa-user"></i> Minha Conta';
    }
}

// Função para redirecionar da pág. financeira
function redirectToHome() {
    const authMessage = document.getElementById('auth-message');
    const dashboardContent = document.getElementById('dashboard-content');
    
    if(authMessage) authMessage.innerHTML = '<h2><i class="fas fa-exclamation-triangle"></i> Acesso Negado</h2><p>Você precisa estar logado. Redirecionando...</p>';
    if(authMessage) authMessage.style.display = 'block';
    if(dashboardContent) dashboardContent.style.display = 'none';
    
    setTimeout(() => {
        window.location.href = 'index.html'; // Redireciona para a home
    }, 2500);
}


// Lógica de Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (loginErrorText) loginErrorText.style.display = 'none';
        if (loginSubmitBtn) loginSubmitBtn.disabled = true;
        if (loginSubmitBtn) loginSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification(`Bem-vindo de volta!`, 'success');
            closeModal();
        } catch (error) {
            console.error("Erro de login:", error.code);
            if (loginErrorText) loginErrorText.textContent = getFirebaseErrorMessage(error.code);
            if (loginErrorText) loginErrorText.style.display = 'block';
        } finally {
            if (loginSubmitBtn) loginSubmitBtn.disabled = false;
            if (loginSubmitBtn) loginSubmitBtn.innerHTML = 'Entrar';
        }
    });
}

// Lógica de Cadastro
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name')?.value;
        const email = document.getElementById('register-email')?.value;
        const phone = document.getElementById('register-phone')?.value;
        const password = document.getElementById('register-password')?.value;
        const confirmPassword = document.getElementById('register-confirm-password')?.value;

        if (registerErrorText) registerErrorText.style.display = 'none';

        if (password !== confirmPassword) {
            if (registerErrorText) registerErrorText.textContent = "As senhas não coincidem.";
            if (registerErrorText) registerErrorText.style.display = 'block';
            return;
        }

        if (registerSubmitBtn) registerSubmitBtn.disabled = true;
        if (registerSubmitBtn) registerSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Salvar dados extras do usuário no Firestore
            const userColPath = `artifacts/${appId}/public/data/users`;
            await setDoc(doc(db, userColPath, user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                phone: phone,
                role: "user" // Define um papel padrão
            });
            
            showNotification('Cadastro realizado com sucesso! Bem-vindo!', 'success');
            closeModal();
        } catch (error) {
            console.error("Erro de cadastro:", error.code);
            if (registerErrorText) registerErrorText.textContent = getFirebaseErrorMessage(error.code);
            if (registerErrorText) registerErrorText.style.display = 'block';
        } finally {
            if (registerSubmitBtn) registerSubmitBtn.disabled = false;
            if (registerSubmitBtn) registerSubmitBtn.innerHTML = 'Cadastrar';
        }
    });
}

// Lógica de Logout (Corrigida)
if (logoutBtnNav) {
    logoutBtnNav.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // REMOVIDA A CHAMADA authUser() que causava o loop.
            // O onAuthStateChanged vai lidar com o estado 'null'
            // e o handleInitialAuth vai logar anonimamente DEPOIS.
            showNotification('Você saiu da sua conta.', 'info');
        } catch (error) {
            console.error("Erro ao sair:", error);
            showNotification('Erro ao tentar sair.', 'error');
        }
    });
}

// ===================================
// 4. CONTROLES DO MODAL (UI)
// ===================================

function closeModal() {
    if (loginModal) loginModal.classList.remove('active');
    if (document.body) document.body.style.overflow = 'auto';
    if (loginErrorText) loginErrorText.style.display = 'none';
    if (registerErrorText) registerErrorText.style.display = 'none';
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
}

if (loginBtnNav) {
    loginBtnNav.addEventListener('click', () => {
        if (loginModal) loginModal.classList.add('active');
        if (document.body) document.body.style.overflow = 'hidden';
    });
}
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (loginModal) {
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeModal();
    });
}
if (tabBtns) {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            btn.classList.add('active');
            const formElement = document.getElementById(tabName === 'login' ? 'loginForm' : 'registerForm');
            if (formElement) formElement.classList.add('active');
        });
    });
}

// ===================================
// 5. LÓGICA DA PÁGINA FINANCEIRO
// ===================================

// Caminho da coleção de boletos (Pública para o admin poder escrever)
const boletosCollectionPath = `artifacts/${appId}/public/data/boletos`;
const usersCollectionPath = `artifacts/${appId}/public/data/users`;

async function initFinanceiroPage(user) {
    const authMessage = document.getElementById('auth-message');
    const dashboardContent = document.getElementById('dashboard-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const adminPanel = document.getElementById('admin-panel');

    if (!authMessage || !dashboardContent || !welcomeMessage) return;

    // Mostrar conteúdo
    authMessage.style.display = 'none';
    dashboardContent.style.display = 'block';
    welcomeMessage.textContent = `Bem-vindo(a), ${user.email}!`;

    if (isAdmin) {
        if (adminPanel) adminPanel.style.display = 'block';
        await loadUsersForAdmin(); // Carregar lista de usuários para o admin
    } else {
        if (adminPanel) adminPanel.style.display = 'none';
    }

    // Carregar boletos
    loadBoletos(user.uid);
}

// Carregar boletos (para admin ou usuário)
function loadBoletos(userId) {
    const loadingBoletos = document.getElementById('loading-boletos');
    const boletosContainer = document.getElementById('boletos-container');
    if (!loadingBoletos || !boletosContainer) return;

    let q;
    if (isAdmin) {
        // Admin vê todos os boletos
        console.log("Admin: Carregando todos os boletos");
        q = query(collection(db, boletosCollectionPath));
    } else {
        // Usuário vê apenas os seus
        console.log(`Usuário: Carregando boletos para UID: ${userId}`);
        q = query(collection(db, boletosCollectionPath), where("userId", "==", userId));
    }
    
    onSnapshot(q, (snapshot) => {
        loadingBoletos.style.display = 'none';
        if (snapshot.empty) {
            boletosContainer.innerHTML = "<p>Nenhum boleto encontrado.</p>";
            console.log("Nenhum boleto encontrado.");
            return;
        }
        console.log(`Encontrados ${snapshot.docs.length} boletos.`);

        let boletosPendentes = [];
        let boletosPagos = [];

        snapshot.docs.forEach(doc => {
            const boleto = { id: doc.id, ...doc.data() };
            if (boleto.vencimento && boleto.vencimento.seconds) {
                boleto.vencimento = new Date(boleto.vencimento.seconds * 1000);
            }
            
            if (boleto.status === 'Pendente') {
                boletosPendentes.push(boleto);
            } else {
                boletosPagos.push(boleto);
            }
        });

        // Ordenar (opcional, mas bom)
        boletosPendentes.sort((a, b) => (a.vencimento || 0) - (b.vencimento || 0));
        boletosPagos.sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0));

        renderBoletosTable(boletosPendentes, boletosPagos);

    }, (error) => {
        console.error("Erro ao carregar boletos:", error);
        loadingBoletos.textContent = "Erro ao carregar boletos.";
    });
}

// Renderizar tabela de boletos
function renderBoletosTable(pendentes, pagos) {
    const boletosContainer = document.getElementById('boletos-container');
    if (!boletosContainer) return;
    
    let html = `
        <table class="boletos-table">
            <thead>
                <tr>
                    ${isAdmin ? '<th>Usuário</th>' : ''}
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th>Ação</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    const renderRow = (boleto) => `
        <tr>
            ${isAdmin ? `<td data-label="Usuário">${boleto.userEmail || 'N/D'}</td>` : ''}
            <td data-label="Descrição">${boleto.descricao || 'N/D'}</td>
            <td data-label="Valor">R$ ${parseFloat(boleto.valor || 0).toFixed(2)}</td>
            <td data-label="Vencimento">${formatarData(boleto.vencimento)}</td>
            <td data-label="Status"><span class="status-badge status-${String(boleto.status).toLowerCase()}">${boleto.status || 'N/D'}</span></td>
            <td data-label="Ação">
                ${boleto.status === 'Pendente' ? 
                    `<button class="btn-pagar" data-id="${boleto.id}">
                        <i class="fas fa-dollar-sign"></i> Pagar
                     </button>` : 
                    `<button class="btn-pagar" disabled>
                        <i class="fas fa-check"></i> Pago
                     </button>`}
            </td>
        </tr>
    `;

    pendentes.forEach(boleto => html += renderRow(boleto));
    pagos.forEach(boleto => html += renderRow(boleto));
    
    html += `</tbody></table>`;
    boletosContainer.innerHTML = html;
    
    // Adicionar event listeners aos botões "Pagar"
    document.querySelectorAll('.btn-pagar').forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', handlePagarBoleto);
        }
    });
}

// Função para "Pagar" o boleto
async function handlePagarBoleto(e) {
    const boletoId = e.currentTarget.dataset.id;
    const button = e.currentTarget;
    
    // Simples confirmação (não use window.confirm em produção real)
    // if (!confirm("Deseja realmente pagar este boleto?")) return;

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const boletoRef = doc(db, boletosCollectionPath, boletoId);
        await updateDoc(boletoRef, {
            status: 'Pago',
            pagoEm: serverTimestamp(),
            pagoPor: currentUser.email
        });
        showNotification('Boleto pago com sucesso!', 'success');
        // O onSnapshot vai atualizar a UI automaticamente
    } catch (error) {
        console.error("Erro ao pagar boleto:", error);
        showNotification('Erro ao processar pagamento.', 'error');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-dollar-sign"></i> Pagar';
    }
}

// ===================================
// 6. LÓGICA DO PAINEL ADMIN
// ===================================

// Carregar usuários no dropdown do admin
async function loadUsersForAdmin() {
    const userSelect = document.getElementById('boleto-user');
    if (!userSelect) return;

    try {
        const q = query(collection(db, usersCollectionPath));
        const querySnapshot = await getDocs(q);
        
        userSelect.innerHTML = '<option value="" disabled selected>Selecione um usuário</option>'; // Limpar
        
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            if (user.email !== 'admin@energytech.com') { // Não gerar boleto para o próprio admin
                const option = document.createElement('option');
                option.value = user.uid; // Salvar o UID
                option.dataset.email = user.email; // Salvar o email no dataset
                option.textContent = `${user.name} (${user.email})`; // Mostrar nome e email
                userSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        userSelect.innerHTML = '<option value="" disabled>Erro ao carregar</option>';
    }
}

// Criar novo boleto (Admin)
const adminForm = document.getElementById('admin-boleto-form');
if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin) return;

        const adminSubmitBtn = document.getElementById('admin-submit-btn');
        const selectedUser = document.getElementById('boleto-user');
        const userId = selectedUser.value;
        const userEmail = selectedUser.options[selectedUser.selectedIndex].dataset.email; // Pega o email do dataset
        
        if (!userId) {
            showNotification("Por favor, selecione um usuário.", "error");
            return;
        }

        const newBoleto = {
            userId: userId, // UID do usuário
            userEmail: userEmail, // Email (para display do admin)
            descricao: document.getElementById('boleto-descricao').value,
            valor: parseFloat(document.getElementById('boleto-valor').value),
            vencimento: new Date(document.getElementById('boleto-vencimento').value + "T12:00:00"), // Adiciona T12 para evitar bugs de fuso
            status: 'Pendente',
            criadoEm: serverTimestamp(),
            criadoPor: 'admin@energytech.com'
        };

        adminSubmitBtn.disabled = true;
        adminSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await addDoc(collection(db, boletosCollectionPath), newBoleto);
            showNotification('Boleto gerado com sucesso!', 'success');
            adminForm.reset();
        } catch (error) {
            console.error("Erro ao gerar boleto:", error);
            showNotification('Erro ao gerar boleto.', 'error');
        } finally {
            adminSubmitBtn.disabled = false;
            adminSubmitBtn.innerHTML = '<i class="fas fa-plus"></i> Gerar';
        }
    });
}

// ===================================
// 7. FUNÇÕES UTILITÁRIAS
// ===================================

// Função para formatar data
function formatarData(data) {
    if (data instanceof Date && !isNaN(data)) {
        return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    return 'N/D';
}

// Sistema de Notificação
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    
    // Adiciona estilos de notificação se não existirem
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.innerHTML = `
        .notification {
            position: fixed;
            top: 100px;
            right: 20px;
            background: #333;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            font-family: 'Poppins', sans-serif;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease;
            border-left: 5px solid #555;
        }
        .notification.success { border-left-color: #4CAF50; }
        .notification.error { border-left-color: #f44336; }
        .notification.info { border-left-color: #2196F3; }
        
        .notification i {
            font-size: 1.2rem;
        }
        .notification.success i { color: #4CAF50; }
        .notification.error i { color: #f44336; }
        .notification.info i { color: #2196F3; }

        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Traduzir erros do Firebase
function getFirebaseErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email': return 'Formato de e-mail inválido.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
        case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado.';
        case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
        default: return 'Ocorreu um erro. Tente novamente.';
    }
}
