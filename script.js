const adicionarMotivoButton = document.getElementById('adicionar-motivo');
const motivosAdicionaisContainer = document.getElementById('motivos-adicionais-container');
const salvarMotivosButton = document.getElementById('salvar-motivos');

document.addEventListener('DOMContentLoaded', fetchTarefas);

function fetchTarefas() {
    fetch('/tarefas')
        .then(response => response.json())
        .then(tarefas => {
            renderTarefas(tarefas);
        })
        .catch(error => {
            console.error('Erro ao carregar tarefas:', error);
        });
}

function renderTarefas(tarefas) {
    const tarefasContainer = document.querySelector('#tarefas-container');
    if (!tarefasContainer) {
        console.error("Elemento 'tarefas-container' não encontrado no DOM");
        return;
    }

    tarefasContainer.innerHTML = '';

    tarefas.forEach(tarefa => {
        const tarefaElement = document.createElement('div');
        tarefaElement.classList.add('tarefa');
        tarefaElement.innerHTML = `
            <h3>${tarefa.titulo}</h3>
            <p>${tarefa.descricao}</p>
            <p>Status: ${tarefa.status}</p>
            <p>Responsável: ${tarefa.responsavel}</p>
        `;
        tarefasContainer.appendChild(tarefaElement);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const adicionarMotivoButton = document.getElementById('adicionar-motivo');
    const motivosAdicionaisContainer = document.getElementById('motivos-adicionais-container');
    const salvarMotivosButton = document.getElementById('salvar-motivos');
    
    let counter = 1;
    
    function adicionarMotivo() {
      const motivoDiv = document.createElement('div');
      motivoDiv.classList.add('motivo-item');
      
      const textarea = document.createElement('textarea');
      textarea.placeholder = `Motivo adicional ${counter++}`;
      
      motivoDiv.appendChild(textarea);
      motivosAdicionaisContainer.appendChild(motivoDiv);
    }
    
    adicionarMotivoButton.addEventListener('click', adicionarMotivo);
    
    salvarMotivosButton.addEventListener('click', async () => {
        const motivos = [];
        const textareas = document.querySelectorAll('#motivos-adicionais-container textarea');
        textareas.forEach(textarea => {
            if (textarea.value.trim()) { 
              motivos.push(textarea.value);
            }
        });
      
        console.log("Motivos enviados:", motivos);
      
        try {
          const response = await fetch('/atualizar-motivo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ motivos })
          });
      
          const data = await response.json();
          if (response.ok) {
            alert('Motivos atualizados!');
            fecharModalExibicao();
          } else {
            alert('Erro ao salvar motivos');
          }
        } catch (error) {
          alert('Erro ao enviar dados');
        }
      });
    
    function fecharModalExibicao() {
      document.getElementById('modal-motivo-exibicao').style.display = 'none';
    }
});

async function fetchTarefas() {
    const response = await fetch('/tarefas');
    const tarefas = await response.json();
    renderTarefas(tarefas);
}

function renderTarefas(tarefas) {
    const pendenteList = document.getElementById('tarefas-pendentes');
    const andamentoList = document.getElementById('tarefas-andamento');
    const concluidaList = document.getElementById('tarefas-concluidas');

    pendenteList.innerHTML = '';
    andamentoList.innerHTML = '';
    concluidaList.innerHTML = '';

    tarefas.forEach(tarefa => {
        const listItem = document.createElement('li');

        listItem.innerHTML = `
            <h3>Título: ${tarefa.task}</h3>
            <p>Status: ${tarefa.status}</p>
            <button class="btn-expandir" onclick="toggleDetalhes(${tarefa._id})">Ver Detalhes</button>
            <div id="detalhes-${tarefa._id}" class="detalhes-tarefa">
                <p><strong>Descrição:</strong> ${tarefa.descricao}</p>
                <p><strong>Data de Criação:</strong> ${new Date(tarefa.dataCriacao).toLocaleString()}</p>
            </div>
        `;

        const moveToAndamentoBtn = document.createElement('button');
        moveToAndamentoBtn.textContent = 'Mover para Em Andamento';
        moveToAndamentoBtn.onclick = () => updateStatus(tarefa._id, 'Em Andamento');

        const moveToConcluidaBtn = document.createElement('button');
        moveToConcluidaBtn.textContent = 'Mover para Concluída';
        moveToConcluidaBtn.onclick = () => updateStatus(tarefa._id, 'Concluída');

        switch (tarefa.status) {
            case 'Pendente':
                listItem.appendChild(moveToAndamentoBtn);
                pendenteList.appendChild(listItem);
                break;
            case 'Em Andamento':
                listItem.appendChild(moveToConcluidaBtn);
                listItem.appendChild(moveToAndamentoBtn);
                andamentoList.appendChild(listItem);
                break;
            case 'Concluída':
                concluidaList.appendChild(listItem);
                break;
        }
    });
}

async function updateStatus(tarefaId, novoStatus) {
    const nomeUsuario = sessionStorage.getItem('nomeUsuario');
    const response = await fetch(`/tarefas/${tarefaId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: novoStatus, movimentadoPor: nomeUsuario, movimentadoEm: new Date().toISOString() })
    });
    
    if (response.ok) {
        fetchTarefas();
    } else {
        alert('Erro ao atualizar status da tarefa');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogado = sessionStorage.getItem('nomeUsuario');

    if (usuarioLogado) {
        document.getElementById('nome-usuario-texto').textContent = usuarioLogado;
    } else {
        document.getElementById('nome-usuario-texto').textContent = 'Visitante';
    }
});

function verificarLogin() {
    const usuarioLogado = sessionStorage.getItem('nomeUsuario');
    if (!usuarioLogado) {
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    verificarLogin();
});

document.getElementById('logout-button').addEventListener('click', logout);

document.getElementById('search-icon').addEventListener('click', function() {
    const filtroContainer = document.getElementById('filtro-container');
    filtroContainer.classList.toggle('show');
});

async function fetchMotivos(tarefaId) {
    const response = await fetch(`/motivos/${tarefaId}`);
    const motivos = await response.json();

    if (motivos && motivos.length > 0) {
        mostrarHistoricoMotivos(motivos);  
    } else {
        alert('Nenhum motivo encontrado para esta tarefa.');
    }
}

function mostrarMotivoExibicao(motivo, usuario, dataHora) {
    const motivoTextArea = document.getElementById('motivo-parado-exibicao');
    const usuarioSpan = document.getElementById('usuario-motivo');
    const dataHoraSpan = document.getElementById('data-hora-motivo');

    motivoTextArea.value = motivo || "Motivo não disponível";
    dataHoraSpan.textContent = dataHora ? `às ${new Date(dataHora).toLocaleString()}` : "Data e hora não disponíveis";
    usuarioSpan.textContent = usuario || "Usuário não encontrado";

    const modalExibicao = document.getElementById('modal-motivo-exibicao');
    modalExibicao.style.display = 'flex';
}

function mostrarModalAtualizar() {
    const modalEdicao = document.getElementById('modal-motivo-edicao');
    const motivoTextArea = document.getElementById('motivo-parado-edicao');
    
    motivoTextArea.value = "";
    modalEdicao.style.display = 'flex';
}

async function salvarNovoMotivo() {
    const tarefaId = document.getElementById('tarefa-id').value;
    const motivo = document.getElementById('motivo-parado-edicao').value;

    if (!motivo.trim()) {
        alert("O motivo não pode estar vazio.");
        return;
    }

    if (!tarefaId) {
        alert("ID da tarefa não encontrado.");
        return;
    }

    const nomeUsuario = sessionStorage.getItem('nomeUsuario');
    const dataHora = new Date().toLocaleString();

    const novoMotivo = {
        motivo: motivo,
        usuario: nomeUsuario,
        dataHora: dataHora
    };

    const response = await fetch(`/atualizar-motivo/${tarefaId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(novoMotivo)
    });

    if (response.ok) {
        alert('Motivo atualizado com sucesso!');
        fecharModalEdicao();
        fetchTarefas();
    } else {
        alert('Erro ao atualizar o motivo.');
    }
}

function fecharModalExibicao() {
    const modalExibicao = document.getElementById('modal-motivo-exibicao');
    modalExibicao.style.display = 'none';  
}

function fecharModalEdicao() {
    const modalEdicao = document.getElementById('modal-motivo-edicao');
    modalEdicao.style.display = 'none';
}

let counter = 1;

function adicionarMotivo() {
  const motivoDiv = document.createElement('div');
  motivoDiv.classList.add('motivo-item');
  
  const textarea = document.createElement('textarea');
  textarea.placeholder = `Motivo adicional ${counter++}`;
  
  motivoDiv.appendChild(textarea);
  motivosAdicionaisContainer.appendChild(motivoDiv);
}

adicionarMotivoButton.addEventListener('click', adicionarMotivo);

salvarMotivosButton.addEventListener('click', async () => {
  const motivos = [];
  const textareas = document.querySelectorAll('#motivos-adicionais-container textarea');
  textareas.forEach(textarea => {
    motivos.push(textarea.value);
  });

  try {
    const response = await fetch('/atualizar-motivo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ motivos })
    });

    const data = await response.json();
    if (response.ok) {
      alert('Motivos atualizados!');
      fecharModalExibicao();
    } else {
      alert('Erro ao salvar motivos');
    }
  } catch (error) {
    alert('Erro ao enviar dados');
  }
});

function adicionarMotivo(tarefaId, motivo, usuario) {
    const dataHora = new Date().toISOString();

    fetch(`/atualizar-motivo/${tarefaId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo, usuario, dataHora })
    })
    .then(response => response.json())
    .then(data => {
        if (data.motivo) {
            atualizarMotivosNaInterface(tarefaId);
        } else {
            alert("Erro ao adicionar motivo.");
        }
    })
    .catch(error => {
        console.error("Erro ao salvar motivo:", error);
    });
}

function atualizarMotivosNaInterface(tarefaId) {
    fetch(`/motivos/${tarefaId}`)
    .then(response => response.json())
    .then(motivos => {
        const listaMotivos = document.getElementById('motivos-lista');
        listaMotivos.innerHTML = "";

        motivos.forEach(motivo => {
            const motivoElement = document.createElement('li');
            motivoElement.textContent = `${motivo.usuario}: ${motivo.motivo} (em ${new Date(motivo.dataHora).toLocaleString()})`;
            listaMotivos.appendChild(motivoElement);
        });
    })
    .catch(error => {
        console.error("Erro ao carregar motivos:", error);
    });
}

function fecharModalExibicao() {
  document.getElementById('modal-motivo-exibicao').style.display = 'none';
}

function toggleExpansao(tipo) {
    const lista = document.getElementById(`tarefas-${tipo}`);
    const icone = document.querySelector(`#${tipo} .expand-icon`);
    
    if (lista.style.display === "none") {
        lista.style.display = "block";  
        icone.innerHTML = "&#9650;";  
    } else {
        lista.style.display = "none";  
        icone.innerHTML = "&#9660;";  
    }
}
