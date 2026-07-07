const API_URL = "http://127.0.0.1:8000";
let LOGGED_USER_ID = null;
let meuGrafico = null; // Guarda a instância do gráfico para podermos atualizá-lo

// Elementos das Telas
const authScreen = document.getElementById("authScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

// Elementos de Autenticação
const tabLogin = document.getElementById("tabLogin");
const tabCadastro = document.getElementById("tabCadastro");
const loginForm = document.getElementById("loginForm");
const cadastroForm = document.getElementById("cadastroForm");
const authFeedback = document.getElementById("authFeedback");
const userNameDisplay = document.getElementById("userNameDisplay");

// Elementos do Dashboard
const financeForm = document.getElementById("financeForm");
const transacoesTabela = document.getElementById("transacoesTabela");
const formFeedback = document.getElementById("formFeedback");

// Alternar Abas de Autenticação
tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabCadastro.classList.remove("active");
    loginForm.classList.remove("hidden");
    cadastroForm.classList.add("hidden");
});

tabCadastro.addEventListener("click", () => {
    tabCadastro.classList.add("active");
    tabLogin.classList.remove("active");
    cadastroForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
});

// Ação de Cadastrar Usuário
cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        nome: document.getElementById("cadNome").value,
        email: document.getElementById("cadEmail").value,
        senha: document.getElementById("cadSenha").value
    };
    const res = await fetch(`${API_URL}/usuarios/cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const dados = await res.json();
    if (res.ok) {
        authFeedback.innerText = "✓ Conta criada! Faça login.";
        authFeedback.style.color = "#23c55e";
        cadastroForm.reset();
        tabLogin.click();
    } else {
        authFeedback.innerText = "❌ " + dados.detail;
        authFeedback.style.color = "#f84f31";
    }
});

// Ação de Fazer Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        email: document.getElementById("loginEmail").value,
        senha: document.getElementById("loginSenha").value
    };
    const res = await fetch(`${API_URL}/usuarios/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const dados = await res.json();
    if (res.ok) {
        LOGGED_USER_ID = dados.usuario_id;
        userNameDisplay.innerText = dados.nome;
        
        authScreen.classList.add("hidden");
        dashboardScreen.classList.remove("hidden");
        carregarTransacoes();
    } else {
        authFeedback.innerText = "❌ " + dados.detail;
        authFeedback.style.color = "#f84f31";
    }
});

// FUNÇÃO PARA ATUALIZAR OU CRIAR O GRÁFICO NA TELA
function renderizarGrafico(totalReceitas, totalDespesas) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    // Se o gráfico já existir, a gente destrói ele antes de criar um novo para não dar bug visual
    if (meuGrafico) {
        meuGrafico.destroy();
    }

    // Se não houver dados, bota valores padrão só para o gráfico não sumir
    if (totalReceitas === 0 && totalDespesas === 0) {
        totalReceitas = 1; 
    }

    meuGrafico = new Chart(ctx, {
        type: 'doughnut', // Formato de Rosca / Pizza
        data: {
            labels: ['Ganhos (Receitas)', 'Gastos (Despesas)'],
            datasets: [{
                data: [totalReceitas, totalDespesas],
                backgroundColor: ['#23c55e', '#f84f31'], // Verde ciber e Vermelho ciber
                borderColor: '#0d1117',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#c9d1d9', // Cor do texto das legendas igual ao CSS
                        font: { family: 'Courier New' }
                    }
                }
            }
        }
    });
}

// Buscar Transações do Usuário Logado e Calcular Totais
async function carregarTransacoes() {
    if (!LOGGED_USER_ID) return;
    const res = await fetch(`${API_URL}/transacoes/${LOGGED_USER_ID}`);
    const transacoes = await res.json();
    
    transacoesTabela.innerHTML = "";
    
    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach(t => {
        const classeTipo = t.tipo === "receita" ? "txt-receita" : "txt-despesa";
        const sinal = t.tipo === "receita" ? "+" : "-";
        
        // Vai somando os totais para alimentar o gráfico
        if (t.tipo === "receita") {
            totalReceitas += t.valor;
        } else {
            totalDespesas += t.valor;
        }

        transacoesTabela.innerHTML += `
            <tr>
                <td>${t.data}</td>
                <td>${t.descricao}</td>
                <td class="${classeTipo}">${t.tipo.toUpperCase()}</td>
                <td class="${classeTipo}">${sinal} R$ ${t.valor.toFixed(2)}</td>
            </tr>
        `;
    });

    // Renderiza o gráfico com os valores reais que vieram do banco do usuário
    renderizarGrafico(totalReceitas, totalDespesas);
}

// Inserir Nova Transação
financeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        usuario_id: LOGGED_USER_ID,
        tipo: document.getElementById("tipo").value,
        valor: parseFloat(document.getElementById("valor").value),
        descricao: document.getElementById("descricao").value,
        data: document.getElementById("data").value
    };
    const res = await fetch(`${API_URL}/transacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (res.ok) {
        formFeedback.innerText = "✓ Gravado!";
        formFeedback.style.color = "#23c55e";
        financeForm.reset();
        carregarTransacoes(); // Recarrega os dados e atualiza o gráfico na hora!
    }
    setTimeout(() => { formFeedback.innerText = ""; }, 3000);
});
// ==========================================
// FUNÇÃO PARA EXPORTAR A TABELA PARA EXCEL
// ==========================================
const btnExportar = document.getElementById("btnExportar");

btnExportar.addEventListener("click", () => {
    // 1. Pega a tabela HTML do histórico
    const tabela = document.getElementById("tabelaFinanceira");
    
    // 2. Converte a tabela HTML em uma planilha de dados da biblioteca SheetJS
    const planilha = XLSX.utils.table_to_sheet(tabela);
    
    // 3. Cria um arquivo de "Livro de Trabalho" (Workbook) do Excel vazio
    const livro = XLSX.utils.book_new();
    
    // 4. Joga a nossa planilha para dentro desse livro com o nome de "Extrato"
    XLSX.utils.book_append_sheet(livro, planilha, "Extrato");
    
    // 5. Força o navegador a baixar o arquivo gerado na hora
    XLSX.writeFile(livro, "isuke_finance_extrato.xlsx");
});
// ==========================================
// FUNÇÃO DE LOGOUT (SAIR DO SISTEMA)
// ==========================================
const btnLogout = document.getElementById("btnLogout");

btnLogout.addEventListener("click", () => {
    // 1. Apaga o ID do usuário da memória
    LOGGED_USER_ID = null;
    
    // 2. Limpa o formulário e a tabela para não sobrar rastro visual
    financeForm.reset();
    transacoesTabela.innerHTML = "";
    
    // 3. Esconde o Painel e mostra a tela de Login novamente
    dashboardScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    
    // 4. Limpa mensagens de erro antigas da tela de login
    authFeedback.innerText = "";
});