import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMSE_COMPLETO = {
  titulo: "Soldado PMSE",
  banca: "SELECON (Edital 2024)",
  logoUrl: "/logosEditais/logo-pmse.png", // Certifique-se de ter essa imagem
  instituicao: "PMSE",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso_sugerido: 2,
      assuntos: [
        "1. Leitura e compreensão de textos variados",
        "2. Modos de organização do discurso: descritivo, narrativo, argumentativo, injuntivo, expositivo e dissertativo",
        "3. Gêneros do discurso: definição, reconhecimento dos elementos básicos",
        "4. Coesão e coerência: mecanismos, efeitos de sentido no texto",
        "5. Relação entre as partes do texto: causa, consequência, comparação, conclusão, generalização, exemplificação, particularização",
        "6. Conectivos: classificação, uso, efeitos de sentido",
        "7. Verbos: pessoa, número, tempo e modo",
        "8. Vozes verbais",
        "9. Transitividade verbal e nominal",
        "10. Estrutura, classificação e formação de palavras",
        "11. Funções e classes de palavras",
        "12. Flexão nominal e verbal",
        "13. Regência verbal e nominal",
        "14. Pronomes: emprego, formas de tratamento e colocação",
        "15. Figuras de linguagem",
        "16. Funções da linguagem",
        "17. Sinônimos, antônimos, parônimos e homônimos",
        "18. Acentuação gráfica",
        "19. Pontuação: regras e efeitos de sentido",
        "20. Recursos gráficos: regras, efeitos de sentido",
        "21. Sintaxe do Período Simples",
        "22. Coordenação e subordinação",
        "23. Crase",
        "24. Ortografia"
      ]
    },
    {
      nome: "Matemática",
      peso_sugerido: 1,
      assuntos: [
        "1. Sistema de numeração decimal: classe e ordens",
        "2. Números reais: operações (adição, subtração, multiplicação, divisão, potenciação e radiciação)",
        "3. Múltiplos e divisores, MDC, MMC, números primos, porcentagem",
        "4. Média aritmética e ponderada",
        "5. Proporcionalidade direta e inversa. Regra de 3 simples",
        "7. Equação e sistema do 1º e 2º grau",
        "8. Funções Algébricas: afim, quadrática, exponencial e logarítmica",
        "9. Progressão Aritmética e Geométrica",
        "10. Análise Combinatória: Princípio Multiplicativo, Arranjos e Combinações",
        "11. Sistema legal de medidas: comprimento, área, volume, massa, capacidade e tempo",
        "12. Cálculo de áreas das principais figuras planas",
        "13. Áreas e volumes dos principais sólidos geométricos",
        "14. Comprimento da circunferência",
        "15. Relações métricas no triângulo retângulo",
        "16. Probabilidade: união de dois eventos, condicional, eventos independentes",
        "17. Noções de estatística: interpretação de gráficos e tabelas"
      ]
    },
    {
      nome: "Noções de Informática",
      peso_sugerido: 1,
      assuntos: [
        "1. Modalidades de processamento",
        "2. Organização e Arquitetura de computadores: hardware, periféricos, armazenamento, conectores",
        "3. Software: Software Livre, software básico e utilitários, sistemas operacionais",
        "4. Ambientes Windows (XP a 10) e Linux: instalação, configuração, utilitários, comandos",
        "5. Sistemas de arquivos, operações, permissões e segurança",
        "6. Editores de texto e softwares de apresentação: conceitos e atalhos",
        "7. Pacote MS Office (Word, Excel, PowerPoint) e LibreOffice (Writer, Calc, Impress)",
        "8. Edição e formatação de textos",
        "9. Criação e uso de planilhas de cálculos",
        "10. Criação e exibição de apresentações de slides",
        "11. Segurança: vírus, antivírus, backup, firewall, criptografia",
        "12. Redes Sociais e Computação em nuvem",
        "13. Redes de computadores: topologias, tecnologias, TCP/IP, redes cabeadas e wireless",
        "14. Internet x Web: navegadores (Edge, Chrome, Firefox), correio eletrônico, busca e pesquisa"
      ]
    },
    {
      nome: "Atualidades",
      peso_sugerido: 1,
      assuntos: [
        "1. Domínio de tópicos atuais (desenvolvimento sustentável, ecologia, tecnologia, energia, política, economia, sociedade, etc)",
        "2. Atualidades e contextos históricos, geográficos, sociais e noções de cidadania (Brasil e Mundo)"
      ]
    },
    {
      nome: "Direitos Humanos",
      peso_sugerido: 2,
      assuntos: [
        "1. Histórico, Direitos Fundamentais, Sociais, Difusos, Civis e Políticos",
        "2. Constituição Federal Brasileira de 1988 e suas Emendas",
        "3. Título I - Dos Princípios Fundamentais",
        "4. Título II - Dos Direitos e Garantias Fundamentais",
        "5. Emenda Constitucional nº 45/2004",
        "6. Declaração Universal dos Direitos do Homem de 1948 (ONU)",
        "7. Convenção Americana de Direitos Humanos (Pacto de San José da Costa Rica)",
        "8. Decreto nº 4.229/2002 (Programa Nacional de Direitos Humanos - PNDH)"
      ]
    },
    {
      nome: "Direito Constitucional",
      peso_sugerido: 2,
      assuntos: [
        "1. Formação Constitucional do Brasil, Constituição de 1988 (origem e objetivos)",
        "2. Estrutura e organização do Estado Brasileiro",
        "3. Organização dos poderes: Executivo, Legislativo e Judiciário",
        "4. Funções essenciais à justiça",
        "5. Artigo 144 da CF/88 (Missão constitucional das Polícias Militares)"
      ]
    },
    {
      nome: "Direito Processual Penal",
      peso_sugerido: 2,
      assuntos: [
        "1. Inquérito policial",
        "2. Ação penal"
      ]
    },
    {
      nome: "Direito Administrativo",
      peso_sugerido: 2,
      assuntos: [
        "1. Princípios",
        "2. Regime jurídico administrativo",
        "3. Poderes da administração pública",
        "4. Serviço público",
        "5. Atos administrativos",
        "6. Contratos administrativos",
        "7. Licitações",
        "8. Bens públicos",
        "9. Administração direta e indireta",
        "10. Controle da administração pública",
        "11. Responsabilidade do Estado"
      ]
    },
    {
      nome: "Conhecimentos Gerais de Sergipe",
      peso_sugerido: 1,
      assuntos: [
        "1. Indígenas em Sergipe",
        "2. Processo de ocupação e povoamento do território sergipano",
        "3. Economias fundadoras",
        "4. Regiões geoeconômicas",
        "5. Estrutura do poder e a sociedade colonial sergipana",
        "6. Sergipe nas sucessivas fases da República Brasileira",
        "7. Condicionantes geoambientais (clima, relevo, hidrografia, vegetação)",
        "8. Dinâmica populacional",
        "9. Rede urbana e organização do espaço",
        "10. Formação metropolitana de Aracaju",
        "11. Política, sociedade e economia no Sergipe contemporâneo",
        "12. Potencialidades e perspectivas de desenvolvimento",
        "13. Formação e expressão da cultura sergipana",
        "14. Educação em Sergipe"
      ]
    },
    {
      nome: "Legislação Específica da PMSE",
      peso_sugerido: 2,
      assuntos: [
        "1. Estatuto da PMSE (Lei nº 2.066/1976)",
        "2. Lei de Remuneração PMSE (Lei nº 5.699/2005)",
        "3. Lei de Organização Básica da PMSE (Lei nº 3.669/1995)",
        "4. Lei de fixação de efetivo da PMSE (Lei nº 7.823/2014)",
        "5. Código de ética e disciplina da PMSE (Lei Complementar nº 291/2017)",
        "6. Sistema de Proteção Social dos Militares (Lei Complementar nº 360/2022)"
      ]
    }
  ]
};

const SeedEditalPMSE = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital PMSE?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmse_soldado"), EDITAL_PMSE_COMPLETO);
        alert("Sucesso! Edital PMSE 2024 gravado.");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
        onClick={handleSeed}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${
            isInstalled
            ? 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default SeedEditalPMSE;