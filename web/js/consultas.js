let listaConsultas = [];
let consultaSelecionada = null;

const consultas = {

    async carregar() {

        const aba = document.getElementById("aba-consultas");

        aba.innerHTML = `
            <div class="consultas-container">

                <h2>Consultas</h2>

                <div class="consulta-controle">

                    <label for="select-consulta">
                        Consulta:
                    </label>

                    <select id="select-consulta">
                        <option value="">
                            Selecione uma consulta
                        </option>
                    </select>

                </div>

                <div id="consulta-detalhes" style="display:none;">

                    <div class="consulta-pergunta">
                        <h3>Pergunta</h3>
                        <p id="consulta-pergunta"></p>
                    </div>

                    <div id="consulta-parametros"></div>

                    <div class="consulta-sql">
                        <h3>SQL</h3>
                        <pre id="consulta-sql"></pre>
                    </div>

                    <button id="btn-executar-consulta">
                        Executar consulta
                    </button>

                    <div id="consulta-mensagem"></div>

                    <div class="consulta-resultado">
                        <h3>Resultado</h3>
                        <div id="consulta-tabela"></div>
                    </div>

                </div>

            </div>
        `;

        await carregarConsultas();
    }
};


async function carregarConsultas() {

    try {

        const resposta = await fetch("/api/consultas");

        if (!resposta.ok) {
            throw new Error("Erro ao carregar consultas.");
        }

        listaConsultas = await resposta.json();

        preencherSeletorConsultas();

    } catch (erro) {

        console.error(erro);

        mostrarMensagemConsulta(
            "Não foi possível carregar as consultas.",
            "erro"
        );
    }
}


function preencherSeletorConsultas() {

    const select =
        document.getElementById("select-consulta");

    select.innerHTML = `
        <option value="">
            Selecione uma consulta
        </option>
    `;

    listaConsultas.forEach(consulta => {

        const option =
            document.createElement("option");

        option.value = consulta.id;

        option.textContent =
            `${consulta.id} - ${consulta.titulo}`;

        if ([2, 6, 8, 10].includes(Number(consulta.id))) {
            option.textContent += " ★";
        }

        select.appendChild(option);
    });

    select.addEventListener(
        "change",
        selecionarConsulta
    );
}


function selecionarConsulta(event) {

    const id = Number(event.target.value);

    if (!id) {

        consultaSelecionada = null;

        document.getElementById(
            "consulta-detalhes"
        ).style.display = "none";

        return;
    }

    consultaSelecionada =
        listaConsultas.find(
            consulta => Number(consulta.id) === id
        );

    if (!consultaSelecionada) {
        return;
    }

    mostrarDetalhesConsulta();
}


function mostrarDetalhesConsulta() {

    const detalhes =
        document.getElementById("consulta-detalhes");

    detalhes.style.display = "block";

    document.getElementById(
        "consulta-pergunta"
    ).textContent =
        consultaSelecionada.pergunta;

    document.getElementById(
        "consulta-sql"
    ).textContent =
        consultaSelecionada.sql;

    montarParametros();

    document.getElementById(
        "consulta-tabela"
    ).innerHTML = "";

    document.getElementById(
        "consulta-mensagem"
    ).innerHTML = "";
}


function montarParametros() {

    const container =
        document.getElementById(
            "consulta-parametros"
        );

    container.innerHTML = "";

    if (!consultaSelecionada) {
        return;
    }

    const id =
        Number(consultaSelecionada.id);

    if (id === 3) {
        montarParametroPaciente(container);
    }

    if (id === 6) {
        montarParametroLote(container);
    }
}


async function montarParametroPaciente(container) {

    container.innerHTML = `
        <label for="param-cns">
            Paciente:
        </label>

        <select id="param-cns">
            <option value="">
                Carregando pacientes...
            </option>
        </select>
    `;

    const select =
        document.getElementById("param-cns");

    try {

        const resposta =
            await fetch("/api/pacientes");

        if (!resposta.ok) {
            throw new Error(
                "Erro ao carregar pacientes."
            );
        }

        const pacientes =
            await resposta.json();

        select.innerHTML = `
            <option value="">
                Selecione o paciente
            </option>
        `;

        pacientes.forEach(paciente => {

            const option =
                document.createElement("option");

            option.value =
                paciente.cns;

            option.textContent =
                `${paciente.nome} - ${paciente.cns}`;

            select.appendChild(option);
        });

    } catch (erro) {

        console.error(erro);

        select.innerHTML = `
            <option value="">
                Erro ao carregar pacientes
            </option>
        `;
    }
}


async function montarParametroLote(container) {

    container.innerHTML = `
        <label for="param-lote">
            Lote:
        </label>

        <select id="param-lote">
            <option value="">
                Carregando lotes...
            </option>
        </select>
    `;

    const select =
        document.getElementById("param-lote");

    try {

        const resposta =
            await fetch("/api/lotes");

        if (!resposta.ok) {
            throw new Error(
                "Erro ao carregar lotes."
            );
        }

        const lotes =
            await resposta.json();

        select.innerHTML = `
            <option value="">
                Selecione o lote
            </option>
        `;

        lotes.forEach(lote => {

            const option =
                document.createElement("option");

            option.value =
                lote.id_lote;

            option.textContent =
                `${lote.numero_lote} - ${lote.fabricante}`;

            select.appendChild(option);
        });

    } catch (erro) {

        console.error(erro);

        select.innerHTML = `
            <option value="">
                Erro ao carregar lotes
            </option>
        `;
    }
}


document.addEventListener("click", event => {

    if (
        event.target.id ===
        "btn-executar-consulta"
    ) {
        executarConsulta();
    }

});


async function executarConsulta() {

    if (!consultaSelecionada) {
        return;
    }

    const id =
        Number(consultaSelecionada.id);

    let url =
        `/api/consultas/${id}`;

    if (id === 3) {

        const cns =
            document.getElementById(
                "param-cns"
            ).value;

        if (!cns) {

            mostrarMensagemConsulta(
                "Selecione um paciente.",
                "erro"
            );

            return;
        }

        url +=
            `?cns=${encodeURIComponent(cns)}`;
    }

    if (id === 6) {

        const idLote =
            document.getElementById(
                "param-lote"
            ).value;

        if (!idLote) {

            mostrarMensagemConsulta(
                "Selecione um lote.",
                "erro"
            );

            return;
        }

        url +=
            `?id_lote=${encodeURIComponent(idLote)}`;
    }

    try {

        mostrarMensagemConsulta(
            "Executando consulta...",
            "info"
        );

        const resposta =
            await fetch(url);

        if (!resposta.ok) {
            throw new Error(
                "Erro ao executar consulta."
            );
        }

        const resultado =
            await resposta.json();

        renderizarResultado(resultado);

    } catch (erro) {

        console.error(erro);

        mostrarMensagemConsulta(
            "Não foi possível executar a consulta.",
            "erro"
        );
    }
}


function renderizarResultado(resultado) {

    const container =
        document.getElementById(
            "consulta-tabela"
        );

    container.innerHTML = "";

    if (!resultado) {

        mostrarMensagemConsulta(
            "A consulta não retornou dados.",
            "info"
        );

        return;
    }

    const colunas =
        resultado.colunas || [];

    const linhas =
        resultado.linhas || [];

    if (linhas.length === 0) {

        mostrarMensagemConsulta(
            "A consulta não retornou nenhuma linha.",
            "info"
        );

        return;
    }

    const tabela =
        document.createElement("table");

    tabela.classList.add(
        "tabela-consulta"
    );

    const thead =
        document.createElement("thead");

    const trCabecalho =
        document.createElement("tr");

    colunas.forEach(coluna => {

        const th =
            document.createElement("th");

        th.textContent = coluna;

        trCabecalho.appendChild(th);
    });

    thead.appendChild(trCabecalho);

    tabela.appendChild(thead);

    const tbody =
        document.createElement("tbody");

    linhas.forEach(linha => {

        const tr =
            document.createElement("tr");

        linha.forEach(valor => {

            const td =
                document.createElement("td");

            td.textContent =
                valor === null
                    ? "—"
                    : valor;

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    tabela.appendChild(tbody);

    container.appendChild(tabela);

    mostrarMensagemConsulta(
        `${linhas.length} registro(s) encontrado(s).`,
        "sucesso"
    );
}


function mostrarMensagemConsulta(
    texto,
    tipo
) {

    const elemento =
        document.getElementById(
            "consulta-mensagem"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent = texto;

    elemento.className =
        `consulta-mensagem ${tipo}`;
}