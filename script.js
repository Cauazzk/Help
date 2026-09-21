const botoes = document.querySelectorAll("main button");
const botaoInicio = document.querySelector("#inicio");
const status = document.querySelector("#status");
const resultados = document.querySelector("#resultados");
const numeroGeral = document.querySelector("#numeroGeral");
const mapaElemento = document.querySelector("#mapa");
const campoPesquisa = document.querySelector("#campoPesquisa");
const botaoPesquisar = document.querySelector("#botaoPesquisar");
const avisoResultados = document.querySelector("#avisoResultados");

let categoriaSelecionada = null;
let localizacaoAtual = null;
let mapa = null;
let marcadorUsuario = null;
let marcadoresLocais = [];

const categorias = {
    "Posto de Saúde": {
        filtro: '["amenity"="clinic"]',
        nome: "postos de saúde",
        raio: 5000
    },
    "Farmácia": {
        filtro: '["amenity"="pharmacy"]',
        nome: "farmácias",
        raio: 5000
    },
    "Hospital": {
        filtro: '["amenity"="hospital"]',
        nome: "hospitais",
        raio: 5000
    },
    "Delegacia": {
        filtro: '["amenity"="police"]',
        nome: "unidades policiais",
        raio: 5000,
        numeroGeral: "190",
        nomeGeral: "Polícia"
    },
    "Bombeiro": {
        filtro: '["amenity"="fire_station"]',
        nome: "quartéis de bombeiros",
        raio: 10000,
        numeroGeral: "193",
        nomeGeral: "Bombeiros"
    },
    "Posto de Gasolina": {
        filtro: '["amenity"="fuel"]',
        nome: "postos de gasolina",
        raio: 5000
    },
    "Mercado": {
        filtro: '["shop"~"supermarket|convenience|grocery"]',
        nome: "mercados",
        raio: 5000
    },
    "Transporte": {
        filtro: '["public_transport"]',
        nome: "pontos de transporte",
        raio: 5000
    },
    "Restaurantes": {
        filtro: '["amenity"~"restaurant|fast_food|cafe"]',
        nome: "restaurantes",
        raio: 5000
    },
    "Igreja": {
        filtro: '["amenity"="place_of_worship"]',
        nome: "locais religiosos",
        raio: 5000
    }
};

botoes.forEach(function (botao) {
    botao.addEventListener("click", function () {
        botoes.forEach(function (item) {
            item.classList.remove("ativo");
        });

        botao.classList.add("ativo");
        categoriaSelecionada = botao.dataset.categoria;
        resultados.innerHTML = "";
        numeroGeral.innerHTML = "";
        esconderAvisoResultados();

        if (!localizacaoAtual) {
            status.textContent =
                "Não foi possível localizar. Permissão de localização não concedida.";
            return;
        }

        buscarCategoria(categoriaSelecionada);
    });
});

function localizarAutomaticamente() {
    if (!navigator.geolocation) {
        status.textContent =
            "Não foi possível localizar. Seu navegador não permite localização.";
        return;
    }

    status.textContent = "Buscando sua localização...";

    navigator.geolocation.getCurrentPosition(
        function (posicao) {
            localizacaoAtual = {
                latitude: posicao.coords.latitude,
                longitude: posicao.coords.longitude
            };

            status.textContent =
                "Localização encontrada: " +
                localizacaoAtual.latitude.toFixed(5) +
                ", " +
                localizacaoAtual.longitude.toFixed(5);

            criarMapa();
        },
        function (erro) {
            if (erro.code === 1) {
                status.textContent =
                    "Não foi possível localizar. Permissão de localização não concedida.";
            } else {
                status.textContent =
                    "Não foi possível localizar. Tente novamente.";
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function criarMapa() {
    if (!localizacaoAtual) {
        return;
    }

    mapaElemento.style.display = "block";

    if (!mapa) {
        mapa = L.map("mapa").setView(
            [
                localizacaoAtual.latitude,
                localizacaoAtual.longitude
            ],
            15
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution: "&copy; OpenStreetMap"
            }
        ).addTo(mapa);

        const iconeUsuario = L.divIcon({
            className: "",
            html: '<div class="marcador-usuario"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        marcadorUsuario = L.marker(
            [
                localizacaoAtual.latitude,
                localizacaoAtual.longitude
            ],
            {
                icon: iconeUsuario
            }
        )
            .addTo(mapa)
            .bindPopup("Sua localização");
    } else {
        mapa.setView(
            [
                localizacaoAtual.latitude,
                localizacaoAtual.longitude
            ],
            15
        );

        marcadorUsuario.setLatLng([
            localizacaoAtual.latitude,
            localizacaoAtual.longitude
        ]);
    }

    setTimeout(function () {
        mapa.invalidateSize();
    }, 200);
}

async function buscarCategoria(categoria) {
    const configuracao = categorias[categoria];

    if (!configuracao) {
        return;
    }

    status.textContent =
        "Procurando " + configuracao.nome + " próximos...";

    esconderAvisoResultados();
    mostrarNumeroGeral(configuracao);

    const latitude = localizacaoAtual.latitude;
    const longitude = localizacaoAtual.longitude;

    const consulta = `
        [out:json][timeout:25];
        (
            nwr(around:${configuracao.raio},${latitude},${longitude})${configuracao.filtro};
        );
        out center;
    `;

    try {
        const resposta = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                body: consulta
            }
        );

        if (!resposta.ok) {
            throw new Error("Erro na busca");
        }

        const dados = await resposta.json();

        mostrarResultados(
            dados.elements,
            configuracao.nome
        );
    } catch (erro) {
        status.textContent =
            "Não foi possível encontrar " +
            configuracao.nome +
            " próximas.";

        resultados.innerHTML = "";
        limparMarcadores();
        esconderAvisoResultados();
    }
}

function mostrarNumeroGeral(configuracao) {
    numeroGeral.innerHTML = "";

    if (!configuracao.numeroGeral) {
        return;
    }

    const div = document.createElement("div");
    div.className = "numero-geral";

    div.innerHTML = `
        <h2>${configuracao.nomeGeral}</h2>
        <p>Número geral: ${configuracao.numeroGeral}</p>
        <a href="tel:${configuracao.numeroGeral}">
            Ligar ${configuracao.numeroGeral}
        </a>
    `;

    numeroGeral.appendChild(div);
}

function criarLinkGoogleMaps(
    nome,
    endereco,
    latitude,
    longitude
) {
    let pesquisa = "";

    if (
        nome &&
        nome !== "Local encontrado"
    ) {
        pesquisa = nome;
    }

    if (
        endereco &&
        endereco !== "Endereço não informado"
    ) {
        if (pesquisa) {
            pesquisa += ", ";
        }

        pesquisa += endereco;
    }

    if (!pesquisa) {
        pesquisa =
            latitude + "," + longitude;
    }

    return (
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(pesquisa)
    );
}

function mostrarResultados(
    locais,
    nomeCategoria
) {
    resultados.innerHTML = "";
    limparMarcadores();
    esconderAvisoResultados();

    if (locais.length === 0) {
        status.textContent =
            "Nenhum resultado encontrado próximo da sua localização.";
        return;
    }

    const locaisOrdenados = locais
        .map(function (local) {
            const latitude =
                local.lat ||
                (local.center && local.center.lat);

            const longitude =
                local.lon ||
                (local.center && local.center.lon);

            if (
                latitude === undefined ||
                longitude === undefined
            ) {
                return null;
            }

            const distancia = calcularDistancia(
                localizacaoAtual.latitude,
                localizacaoAtual.longitude,
                latitude,
                longitude
            );

            return {
                local: local,
                latitude: latitude,
                longitude: longitude,
                distancia: distancia
            };
        })
        .filter(function (item) {
            return item !== null;
        })
        .sort(function (a, b) {
            return a.distancia - b.distancia;
        });

    status.textContent =
        locaisOrdenados.length +
        " resultado(s) encontrado(s).";

    const locaisExibidos =
        locaisOrdenados.slice(0, 10);

    locaisExibidos.forEach(function (item, indice) {
        const numero = indice + 1;
        const tags = item.local.tags || {};

        const nome =
            tags.name ||
            tags.brand ||
            nomeCategoria;

        const endereco =
            montarEndereco(tags);

        const mapaLink =
            criarLinkGoogleMaps(
                nome,
                endereco,
                item.latitude,
                item.longitude
            );

        const telefone =
            tags.phone ||
            tags["contact:phone"] ||
            null;

        let botaoTelefone = "";

        if (telefone) {
            const telefoneLimpo =
                telefone.replace(/[^\d+]/g, "");

            botaoTelefone =
                '<a href="tel:' +
                telefoneLimpo +
                '">Ligar para unidade</a>';
        }

        const div =
            document.createElement("div");

        div.className = "resultado";

        div.innerHTML = `
            <h3>${numero}. ${nome}</h3>
            <p>${endereco}</p>
            <p>${formatarDistancia(item.distancia)}</p>

            <div class="acoes">
                ${botaoTelefone}
                <a href="${mapaLink}" target="_blank">Ver no mapa</a>
            </div>
        `;

        div.addEventListener("click", function (evento) {
            if (evento.target.tagName === "A") {
                return;
            }

            if (mapa) {
                mapa.setView(
                    [
                        item.latitude,
                        item.longitude
                    ],
                    17
                );

                const marcador =
                    marcadoresLocais[indice];

                if (marcador) {
                    marcador.openPopup();
                }
            }
        });

        resultados.appendChild(div);

        adicionarMarcador(
            item.latitude,
            item.longitude,
            numero,
            nome,
            endereco,
            item.distancia
        );
    });

    if (
        mapa &&
        locaisExibidos.length > 0
    ) {
        ajustarMapa(locaisExibidos);
    }

    mostrarAvisoResultados();
}

function adicionarMarcador(
    latitude,
    longitude,
    numero,
    nome,
    endereco,
    distancia
) {
    const icone = L.divIcon({
        className: "",
        html:
            '<div class="marcador-numero">' +
            numero +
            "</div>",
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    const marcador =
        L.marker(
            [latitude, longitude],
            {
                icon: icone
            }
        ).addTo(mapa);

    marcador.bindPopup(
        "<strong>" +
        numero +
        ". " +
        nome +
        "</strong><br>" +
        endereco +
        "<br>" +
        formatarDistancia(distancia)
    );

    marcadoresLocais.push(marcador);
}

function limparMarcadores() {
    marcadoresLocais.forEach(function (marcador) {
        if (mapa) {
            mapa.removeLayer(marcador);
        }
    });

    marcadoresLocais = [];
}

function ajustarMapa(locais) {
    const pontos = [
        [
            localizacaoAtual.latitude,
            localizacaoAtual.longitude
        ]
    ];

    locais.forEach(function (item) {
        pontos.push([
            item.latitude,
            item.longitude
        ]);
    });

    const limites =
        L.latLngBounds(pontos);

    mapa.fitBounds(limites, {
        padding: [30, 30]
    });
}

async function pesquisarEndereco() {
    const texto =
        campoPesquisa.value.trim();

    if (!texto) {
        status.textContent =
            "Digite algo para pesquisar.";

        esconderAvisoResultados();
        return;
    }

    status.textContent =
        "Pesquisando: " +
        texto +
        "...";

    resultados.innerHTML = "";
    numeroGeral.innerHTML = "";
    limparMarcadores();
    esconderAvisoResultados();

    try {
        const url =
            "https://nominatim.openstreetmap.org/search?format=json&limit=10&addressdetails=1&q=" +
            encodeURIComponent(texto);

        const resposta =
            await fetch(
                url,
                {
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        if (!resposta.ok) {
            throw new Error(
                "Erro na pesquisa"
            );
        }

        const dados =
            await resposta.json();

        mostrarPesquisa(
            dados,
            texto
        );
    } catch (erro) {
        status.textContent =
            "Não foi possível realizar a pesquisa.";

        resultados.innerHTML = "";
        esconderAvisoResultados();
    }
}

function mostrarPesquisa(
    dados,
    texto
) {
    limparMarcadores();
    resultados.innerHTML = "";

    if (
        !dados ||
        dados.length === 0
    ) {
        status.textContent =
            "Nenhum resultado encontrado para: " +
            texto;

        esconderAvisoResultados();
        return;
    }

    status.textContent =
        dados.length +
        " resultado(s) encontrado(s).";

    dados.forEach(function (item, indice) {
        const numero = indice + 1;

        const latitude =
            parseFloat(item.lat);

        const longitude =
            parseFloat(item.lon);

        const nomeCompleto =
            item.display_name ||
            "Local encontrado";

        const nome =
            nomeCompleto.split(",")[0];

        const endereco =
            nomeCompleto;

        const distancia =
            localizacaoAtual
                ? calcularDistancia(
                    localizacaoAtual.latitude,
                    localizacaoAtual.longitude,
                    latitude,
                    longitude
                )
                : null;

        const mapaLink =
            criarLinkGoogleMaps(
                nome,
                endereco,
                latitude,
                longitude
            );

        const div =
            document.createElement("div");

        div.className =
            "resultado";

        div.innerHTML = `
            <h3>${numero}. ${nome}</h3>
            <p>${endereco}</p>
            ${
                distancia !== null
                    ? "<p>" +
                      formatarDistancia(distancia) +
                      "</p>"
                    : ""
            }

            <div class="acoes">
                <a href="${mapaLink}" target="_blank">
                    Ver no mapa
                </a>
            </div>
        `;

        div.addEventListener(
            "click",
            function (evento) {
                if (
                    evento.target.tagName ===
                    "A"
                ) {
                    return;
                }

                if (mapa) {
                    mapa.setView(
                        [
                            latitude,
                            longitude
                        ],
                        17
                    );

                    if (
                        marcadoresLocais[
                            indice
                        ]
                    ) {
                        marcadoresLocais[
                            indice
                        ].openPopup();
                    }
                }
            }
        );

        resultados.appendChild(div);

        adicionarMarcador(
            latitude,
            longitude,
            numero,
            nome,
            endereco,
            distancia
        );
    });

    const pontos =
        dados.map(function (item) {
            return [
                parseFloat(item.lat),
                parseFloat(item.lon)
            ];
        });

    if (localizacaoAtual) {
        pontos.push([
            localizacaoAtual.latitude,
            localizacaoAtual.longitude
        ]);
    }

    if (
        mapa &&
        pontos.length > 0
    ) {
        mapa.fitBounds(
            L.latLngBounds(pontos),
            {
                padding: [30, 30]
            }
        );
    }

    mostrarAvisoResultados();
}

function montarEndereco(tags) {
    const partes = [];

    if (tags["addr:street"]) {
        let endereco =
            tags["addr:street"];

        if (tags["addr:housenumber"]) {
            endereco +=
                ", " +
                tags["addr:housenumber"];
        }

        partes.push(endereco);
    }

    if (tags["addr:suburb"]) {
        partes.push(
            tags["addr:suburb"]
        );
    }

    if (tags["addr:city"]) {
        partes.push(
            tags["addr:city"]
        );
    }

    if (partes.length === 0) {
        return "Endereço não informado";
    }

    return partes.join(" - ");
}

function calcularDistancia(
    lat1,
    lon1,
    lat2,
    lon2
) {
    const raioTerra = 6371;

    const diferencaLat =
        (lat2 - lat1) *
        Math.PI /
        180;

    const diferencaLon =
        (lon2 - lon1) *
        Math.PI /
        180;

    const a =
        Math.sin(
            diferencaLat / 2
        ) *
        Math.sin(
            diferencaLat / 2
        ) +
        Math.cos(
            lat1 * Math.PI / 180
        ) *
        Math.cos(
            lat2 * Math.PI / 180
        ) *
        Math.sin(
            diferencaLon / 2
        ) *
        Math.sin(
            diferencaLon / 2
        );

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return raioTerra * c;
}

function formatarDistancia(
    distancia
) {
    if (distancia === null) {
        return "";
    }

    if (distancia < 1) {
        return Math.round(
            distancia * 1000
        ) +
        " m de distância";
    }

    return distancia.toFixed(2) +
        " km de distância";
}

function mostrarAvisoResultados() {
    if (!avisoResultados) {
        return;
    }

    avisoResultados.classList.add(
        "visivel"
    );

    verificarResultadosNaTela();
}

function esconderAvisoResultados() {
    if (!avisoResultados) {
        return;
    }

    avisoResultados.classList.remove(
        "visivel"
    );
}

function verificarResultadosNaTela() {
    if (
        !avisoResultados ||
        !resultados
    ) {
        return;
    }

    if (
        !resultados.innerHTML.trim()
    ) {
        esconderAvisoResultados();
        return;
    }

    const rect =
        resultados.getBoundingClientRect();

    const alturaTela =
        window.innerHeight ||
        document.documentElement.clientHeight;

    const resultadosNaTela =
        rect.top < alturaTela &&
        rect.bottom > 0;

    if (resultadosNaTela) {
        esconderAvisoResultados();
    } else {
        avisoResultados.classList.add(
            "visivel"
        );
    }
}

botaoPesquisar.addEventListener(
    "click",
    pesquisarEndereco
);

campoPesquisa.addEventListener(
    "keydown",
    function (evento) {
        if (evento.key === "Enter") {
            pesquisarEndereco();
        }
    }
);

botaoInicio.addEventListener(
    "click",
    function () {
        categoriaSelecionada = null;

        resultados.innerHTML = "";
        numeroGeral.innerHTML = "";
        campoPesquisa.value = "";

        limparMarcadores();
        esconderAvisoResultados();

        botoes.forEach(function (botao) {
            botao.classList.remove("ativo");
        });

        if (localizacaoAtual) {
            status.textContent =
                "Localização encontrada: " +
                localizacaoAtual.latitude.toFixed(5) +
                ", " +
                localizacaoAtual.longitude.toFixed(5);

            criarMapa();
        } else {
            localizarAutomaticamente();
        }
    }
);

window.addEventListener(
    "scroll",
    verificarResultadosNaTela
);

window.addEventListener(
    "resize",
    verificarResultadosNaTela
);

localizarAutomaticamente();