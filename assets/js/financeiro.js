// financeiro.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/*
  COLE AQUI SUA firebaseConfig (mesma que usa no auth-script.js)
  Exemplo:
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
*/
const firebaseConfig = {/* COLE AQUI */};

if (!firebaseConfig.apiKey) {
  console.warn('Cole sua firebaseConfig no js/financeiro.js para conectar ao Firestore.');
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// == CONFIG PIX ==
const PIX_KEY = "SUA_CHAVE_PIX_AQUI";          // -> coloque a chave PIX da empresa (CPF/CNPJ/email/telefone/EVP)
const PIX_MERCHANT_NAME = "EnergyTech";
const PIX_MERCHANT_CITY = "SOROCABA";


// ----------------- aux: formatar reais -----------------
function toBRL(v){
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR',{style:'currency', currency:'BRL'});
}

// ----------------- CRC16 (para BRCode) -----------------
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}

// ----------------- Montar BR Code (EMV) -----------------
// baseado nas tags do padrão Pix BRCode (simplificado)
function tag(id, value){
  const v = String(value || '');
  const len = String(v.length).padStart(2,'0');
  return `${id}${len}${v}`;
}

function buildPixPayload({pixKey, merchantName, merchantCity, txid, amount, description}) {
  // 00 - Payload format indicator
  let payload = '';
  payload += tag('00','01');

  // 01 - Merchant Account Information -> sub 00: GUI; 01: chave
  const gui = 'br.gov.bcb.pix';
  let mai = '';
  mai += tag('00', gui);
  // incluir chave
  mai += tag('01', pixKey);
  if (description) {
    // tag 02 description (opcional)
    mai += tag('02', description);
  }
  payload += tag('26', mai);

  // 52 - merchant category code (0000 default)
  payload += tag('52','0000');
  // 53 - moeda (986 = BRL)
  payload += tag('53','986');
  // 54 - valor (opcional)
  if (amount) {
    // formato: 123.45
    payload += tag('54', Number(amount).toFixed(2));
  }
  // 58 - país
  payload += tag('58','BR');
  // 59 - merchant name (max 25)
  payload += tag('59', (merchantName || '').substring(0,25));
  // 60 - merchant city (max 15)
  payload += tag('60', (merchantCity || '').substring(0,15));
  // 62 - Additional Data Field Template -> sub 05 txid
  let add = '';
  add += tag('05', txid || '*');
  payload += tag('62', add);

  // 63 - CRC (calculado sobre tudo + 6304)
  const crcInput = payload + '6304';
  const crc = crc16(crcInput);
  payload += '6304' + crc;
  return payload;
}

// ----------------- UI references -----------------
const paymentsBody = document.getElementById('paymentsBody');
const btnNewPayment = document.getElementById('btnNewPayment');
const btnReload = document.getElementById('btnReload');
const modalForm = document.getElementById('modalForm');
const inputClient = document.getElementById('inputClient');
const inputValue = document.getElementById('inputValue');
const inputDue = document.getElementById('inputDue');
const btnSaveForm = document.getElementById('btnSaveForm');
const btnCancelForm = document.getElementById('btnCancelForm');

const modalPix = document.getElementById('modalPix');
const qrcodeWrap = document.getElementById('qrcode');
const pixKeyShow = document.getElementById('pixKeyShow');
const pixValueShow = document.getElementById('pixValueShow');
const pixDueShow = document.getElementById('pixDueShow');
const pixPayloadInput = document.getElementById('pixPayload');
const btnClosePix = document.getElementById('btnClosePix');
const btnMarkPaid = document.getElementById('btnMarkPaid');
const copyPixKey = document.getElementById('copyPixKey');

let currentOpenPaymentId = null;

// ----------------- CRUD Firestore -----------------
const paymentsCol = collection(db, 'payments');

// realtime listener - ordena por vencimento
const q = query(paymentsCol, ); // você pode ordenar se quiser
onSnapshot(q, (snapshot) => {
  const payments = [];
  snapshot.forEach(docSnap => {
    payments.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderPayments(payments);
});

// render tabela
function renderPayments(payments){
  paymentsBody.innerHTML = '';
  if (!payments.length) {
    paymentsBody.innerHTML = `<tr><td colspan="5" style="color:var(--text-light)">Nenhum lançamento</td></tr>`;
    return;
  }

  payments.forEach(p => {
    const tr = document.createElement('tr');

    const statusHtml = p.status === 'pago' ? `<span class="status-pago">Pago</span>` : `<span class="status-pendente">Pendente</span>`;

    tr.innerHTML = `
      <td data-label="Cliente">${p.client}</td>
      <td data-label="Valor">${toBRL(p.value)}</td>
      <td data-label="Vencimento">${p.dueDate || '-'}</td>
      <td data-label="Status">${statusHtml}</td>
      <td data-label="Ações">
        <button class="btn-small btn-outline" data-id="${p.id}" data-action="view">Ver PIX</button>
        <button class="btn-small btn-primary-sm" data-id="${p.id}" data-action="mark">${p.status === 'pago' ? 'Desmarcar' : 'Marcar Pago'}</button>
      </td>
    `;
    paymentsBody.appendChild(tr);
  });

  // adiciona listeners
  paymentsBody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      const action = btn.dataset.action || btn.textContent.toLowerCase();
      if (btn.dataset.action === 'view') openPixModal(id);
      if (btn.textContent.toLowerCase().includes('marcar') || btn.dataset.action==='mark') toggleMarkPaid(id);
    });
  });
}

// criar novo pagamento
btnNewPayment.addEventListener('click', () => {
  inputClient.value = '';
  inputValue.value = '';
  inputDue.value = '';
  modalForm.classList.add('active');
  document.body.style.overflow = 'hidden';
});

btnCancelForm.addEventListener('click', () => {
  modalForm.classList.remove('active');
  document.body.style.overflow = 'auto';
});

// salvar form
btnSaveForm.addEventListener('click', async () => {
  const client = inputClient.value.trim();
  const value = parseFloat(inputValue.value.replace(',', '.')) || 0;
  const due = inputDue.value.trim();

  if (!client || !value || !due) {
    alert('Preencha todos os campos corretamente.');
    return;
  }

  // adiciona doc no Firestore
  try {
    await addDoc(paymentsCol, {
      client,
      value,
      dueDate: due,
      status: 'pendente',
      createdAt: serverTimestamp()
    });
    modalForm.classList.remove('active');
    document.body.style.overflow = 'auto';
  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert('Erro ao salvar lançamento.');
  }
});

// abrir modal PIX: busca doc e monta payload/QR
async function openPixModal(paymentId){
  currentOpenPaymentId = paymentId;
  // buscar doc
  const docRef = doc(db, 'payments', paymentId);
  // fetch manual (onSnapshot poderia ser usado)
  // simplifico: uso getDoc
  const { getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  const snap = await getDoc(docRef);
  if (!snap.exists()) { alert('Lançamento não encontrado.'); return; }
  const data = snap.data();

  // limpar qrcode anterior
  qrcodeWrap.innerHTML = '';
  pixKeyShow.textContent = PIX_KEY;
  pixValueShow.textContent = toBRL(data.value);
  pixDueShow.textContent = data.dueDate || '-';

  // montar payload
  const payload = buildPixPayload({
    pixKey: PIX_KEY,
    merchantName: PIX_MERCHANT_NAME,
    merchantCity: PIX_MERCHANT_CITY,
    txid: paymentId, // usar id do pagamento como txid
    amount: Number(data.value).toFixed(2),
    description: `Pagamento mensal - ${data.client}`
  });

  pixPayloadInput.value = payload;

  // gerar QR
  // usa qrcode.js (CDN) - já incluído no HTML
  // eslint-disable-next-line no-undef
  new QRCode(qrcodeWrap, {
    text: payload,
    width: 220,
    height: 220,
  });

  modalPix.classList.add('active');
  document.body.style.overflow = 'hidden';
}

btnClosePix.addEventListener('click', () => {
  modalPix.classList.remove('active');
  document.body.style.overflow = 'auto';
  qrcodeWrap.innerHTML = '';
});

// copiar chave PIX
copyPixKey.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(PIX_KEY); copyPixKey.textContent = 'Copiado'; setTimeout(()=>copyPixKey.textContent='Copiar',1500); }
  catch { alert('Não foi possível copiar.'); }
});

// marcar pagamento como pago / desmarcar
async function toggleMarkPaid(paymentId) {
  const docRef = doc(db, 'payments', paymentId);
  const { getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  const snap = await getDoc(docRef);
  if (!snap.exists()) return alert('Lançamento não encontrado.');

  const current = snap.data();
  const newStatus = current.status === 'pago' ? 'pendente' : 'pago';
  await updateDoc(docRef, {
    status: newStatus,
    paidAt: newStatus === 'pago' ? serverTimestamp() : null
  });
  // fechar modal se aberto
  modalPix.classList.remove('active');
  qrcodeWrap.innerHTML = '';
  document.body.style.overflow = 'auto';
}

// reload
btnReload.addEventListener('click', () => {
  // só reativa o snapshot que já fica ativo
  console.log('Atualizar - snapshot ativo.');
});

// proteção: fechar modais ao clicar fora
modalForm.addEventListener('click', (e) => {
  if (e.target === modalForm) { modalForm.classList.remove('active'); document.body.style.overflow='auto'; }
});
modalPix.addEventListener('click', (e) => {
  if (e.target === modalPix) { modalPix.classList.remove('active'); qrcodeWrap.innerHTML=''; document.body.style.overflow='auto'; }
});

// opcional: checar autenticação e só permitir admin (simples)
// ajuste conforme sua regra: por enquanto permite acesso se estiver autenticado
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // se quiser bloquear: window.location.href = 'index.html';
    console.log('Usuário não autenticado (mostrando demo).');
  } else {
    console.log('Usuário autenticado:', user.email);
  }
});

console.log('Financeiro inicializado.');
